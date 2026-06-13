import express from 'express';
import crypto from 'crypto';
import { InvoiceService } from '../services/invoiceService.js';
import { FinanceService } from '../services/financeService.js';
import * as PdfService from '../services/pdfService.js';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';
import { CreateInvoiceDTO, UpdateInvoiceDTO, RateSegment, DemurrageEntry, VehicleEntry } from '../models/types.js';

export const invoiceRouter = express.Router();

const buildInvoiceDto = (body: any, entities: any[]) => {
  const sender = body.sender_id ? entities.find((item) => item.id === Number(body.sender_id)) : null;
  const receiver = body.receiver_id ? entities.find((item) => item.id === Number(body.receiver_id)) : null;

  if (!sender || !receiver) {
    throw new Error('Sender and receiver are required');
  }

  const rateValues = Array.isArray(body.vehicle_rate_per_vehicle) ? body.vehicle_rate_per_vehicle : [body.vehicle_rate_per_vehicle];
  const rateCounts = Array.isArray(body.vehicle_rate_vehicles) ? body.vehicle_rate_vehicles : [body.vehicle_rate_vehicles];

  const vehicleRates: RateSegment[] = rateValues
    .map((rate: string, index: number) => {
      const rate_per_vehicle = Number(rate ?? 0);
      const vehicles = Number(rateCounts[index] ?? 0);
      return {
        description: `Rate segment ${index + 1}`,
        rate_per_vehicle,
        vehicles,
        amount: FinanceService.calculateVehicleRate({ vehicles, rate_per_vehicle })
      };
    })
    .filter((segment: RateSegment) => segment.rate_per_vehicle > 0 && segment.vehicles > 0);

  const demurrageRates = Array.isArray(body.demurrage_rate) ? body.demurrage_rate : [body.demurrage_rate];
  const demurrageVehicles = Array.isArray(body.demurrage_vehicles) ? body.demurrage_vehicles : [body.demurrage_vehicles];
  const demurrageDays = Array.isArray(body.demurrage_days) ? body.demurrage_days : [body.demurrage_days];

  const demurrageEntries: DemurrageEntry[] = demurrageRates
    .map((rate: string, index: number) => {
      const demurrageRate = Number(rate ?? 0);
      const vehicles = Number(demurrageVehicles[index] ?? 0);
      const days = Number(demurrageDays[index] ?? 0);
      return {
        rate: demurrageRate,
        vehicles,
        days,
        amount: FinanceService.calculateDemurrage({ rate: demurrageRate, vehicles, days })
      };
    })
    .filter((entry: DemurrageEntry) => entry.rate > 0 || entry.vehicles > 0 || entry.days > 0);

  const itemDescriptions = Array.isArray(body.description) ? body.description : [body.description];
  const itemQuantities = Array.isArray(body.quantity) ? body.quantity : [body.quantity];
  const itemRates = Array.isArray(body.rate) ? body.rate : [body.rate];

  const items = itemDescriptions
    .map((desc: string, index: number) => ({
      description: desc ?? '',
      quantity: Number(itemQuantities[index] ?? 0),
      rate: Number(itemRates[index] ?? 0),
    }))
    .filter((item: any) => item.description.trim() && item.quantity > 0);

  const registrationPrefixes: string[] = Array.isArray(body.vehicle_registration_prefixes)
    ? body.vehicle_registration_prefixes
    : body.vehicle_registration_prefixes ? [body.vehicle_registration_prefixes] : [];

  const registrationPhonetics: string[] = Array.isArray(body.vehicle_registration_phonetic)
    ? body.vehicle_registration_phonetic
    : body.vehicle_registration_phonetic ? [body.vehicle_registration_phonetic] : [];

  const registrationNumbers: string[] = Array.isArray(body.vehicle_registration_nos)
    ? body.vehicle_registration_nos
    : body.vehicle_registration_nos ? [body.vehicle_registration_nos] : [];

  const fullRegistrations: string[] = registrationNumbers.map((number: string, index: number) => {
    const prefix = (registrationPrefixes[index] || '').trim();
    const phonetic = (registrationPhonetics[index] || '').trim();
    const value = [prefix, phonetic, (number || '').trim()].filter(Boolean).join(' ');
    return value;
  });

  const vehicleTypes: string[] = Array.isArray(body.vehicle_type)
    ? body.vehicle_type
    : body.vehicle_type ? [body.vehicle_type] : [];

  const vehicleSizes: string[] = Array.isArray(body.vehicle_size)
    ? body.vehicle_size
    : body.vehicle_size ? [body.vehicle_size] : [];

  const loadTypes: string[] = Array.isArray(body.vehicle_load_type)
    ? body.vehicle_load_type
    : body.vehicle_load_type ? [body.vehicle_load_type] : [];

  const vehicleEntries: VehicleEntry[] = fullRegistrations
    .map((registration: string, index: number) => ({
      registration: (registration || '').trim(),
      vehicle_type: (Array.isArray(body.vehicle_type) ? body.vehicle_type[index] : (index === 0 ? body.vehicle_type : undefined)) as 'Covered Van' | 'Container' | undefined,
      vehicle_size: (Array.isArray(body.vehicle_size) ? body.vehicle_size[index] : (index === 0 ? body.vehicle_size : undefined))?.trim() || undefined,
      load_type: (Array.isArray(body.vehicle_load_type) ? body.vehicle_load_type[index] : (index === 0 ? body.vehicle_load_type : undefined))?.trim() || undefined as 'Lcl' | 'Fcl' | 'Hcl' | undefined,
    }))
    .filter((entry) => Boolean(entry.registration));

  return {
    sender_id: sender.id,
    receiver_id: receiver.id,
    sender_name: sender.company || sender.name,
    sender_address: sender.address || '',
    sender_type: sender.entity_type,
    receiver_name: receiver.company || receiver.name,
    receiver_address: receiver.address || '',
    receiver_type: receiver.entity_type,
    invoice_number: body.invoice_number || `INV-${Date.now()}`,
    issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
    notes: body.notes || '',
    transport_condition: body.transport_condition,
    vehicle_entries: vehicleEntries,
    vehicle_registration_nos: vehicleEntries.map((e) => e.registration),
    // Use first element for top-level fields if appropriate, or handle as needed
    vehicle_type: vehicleEntries[0]?.vehicle_type,
    vehicle_size: vehicleEntries[0]?.vehicle_size || '',
    load_type: vehicleEntries[0]?.load_type,
    good_volume: body.good_volume,
    vehicle_count: vehicleEntries.length,
    quantity_unit: body.quantity_unit,
    company_invoice_no: body.company_invoice_no,
    challan_no: body.challan_no,
    particulars_source: body.particulars_source,
    particulars_destination: body.particulars_destination,
    particulars_notes: body.particulars_notes,
    folder_id: body.folder_id || undefined,
    vehicle_rates: vehicleRates,
    demurrage_entries: demurrageEntries,
    items,
    invoice_uuid: body.invoice_uuid || undefined,
  } as CreateInvoiceDTO;
};

invoiceRouter.get('/', (req, res) => {
  const invoices = InvoiceService.getAllInvoices();
  res.render('index', { invoices, FinanceService, currentPage: 'invoices', pageTitle: 'Dashboard' });
});

invoiceRouter.get('/invoices/new', (req, res) => {
  const entities = InvoiceRepository.getClients();
  const preselectedReceiverId = req.query.receiver_id as string;
  res.render('new-invoice', { 
    entities, 
    editing: false, 
    invoice: null, 
    preselectedReceiverId,
    currentPage: 'new-invoice',
    pageTitle: 'New Invoice'
  });
});

invoiceRouter.post('/invoices', (req, res) => {
  try {
    const entities = InvoiceRepository.getClients();
    const dto = buildInvoiceDto(req.body, entities);
    const createdUuid = InvoiceService.createInvoice(dto);
    res.redirect(`/invoices/${createdUuid}`);
  } catch (error) {
    res.status(400).send((error as Error).message);
  }
});

invoiceRouter.get('/invoices/:uuid/edit', (req, res) => {
  const invoiceUuid = req.params.uuid;
  const invoice = InvoiceService.getInvoiceDetailsByUuid(invoiceUuid);
  if (!invoice) {
    return res.status(404).send('Invoice not found');
  }

  const entities = InvoiceRepository.getClients();
  res.render('new-invoice', { 
    entities, 
    invoice, 
    editing: true, 
    preselectedReceiverId: null,
    currentPage: 'invoices',
    pageTitle: 'Edit Invoice'
  });
});

invoiceRouter.post('/invoices/:id', (req, res) => {
  const invoiceId = Number(req.params.id);
  const existing = InvoiceRepository.getInvoiceById(invoiceId);
  if (!existing) {
    return res.status(404).send('Invoice not found');
  }

  try {
    const entities = InvoiceRepository.getClients();
    const dto = buildInvoiceDto(req.body, entities) as UpdateInvoiceDTO;
    dto.id = invoiceId;
    dto.status = existing.status;
    dto.created_at = existing.created_at;

    const updatedUuid = InvoiceService.updateInvoice(dto);
    res.redirect(`/invoices/${updatedUuid}`);
  } catch (error) {
    res.status(400).send((error as Error).message);
  }
});

invoiceRouter.get('/invoices/:uuid', (req, res) => {
  const invoiceUuid = req.params.uuid;
  const invoice = InvoiceService.getInvoiceDetailsByUuid(invoiceUuid);

  if (!invoice) {
    return res.status(404).send('Invoice not found');
  }

  res.render('show-invoice', {
    invoice,
    FinanceService,
    currentPage: 'invoices',
    pageTitle: `Invoice ${invoice.invoice_number}`
  });
});

invoiceRouter.get('/invoices/:uuid/pdf', async (req, res) => {
  const invoiceUuid = req.params.uuid;
  const invoice = InvoiceService.getInvoiceDetailsByUuid(invoiceUuid);

  if (!invoice) {
    return res.status(404).send('Invoice not found');
  }

  try {
    const pdfBuffer = await PdfService.generateInvoicePdfBuffer(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number || 'invoice'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).send('Unable to generate PDF at this time');
  }
});

invoiceRouter.post('/invoices/:uuid/delete', (req, res) => {
  try {
    const uuid = req.params.uuid;
    InvoiceService.deleteInvoiceByUuid(uuid);
    res.redirect('/');
  } catch (error) {
    res.status(400).send((error as Error).message);
  }
});

invoiceRouter.get('/companies', (req, res) => {
  const companies = InvoiceService.getAllCompanies();
  res.render('companies', { companies, currentPage: 'companies' });
});

invoiceRouter.get('/companies/new', (req, res) => {
  res.render('company-enlist', { currentPage: 'new-company', pageTitle: 'Enlist New Entity' });
});

invoiceRouter.post('/companies', (req, res) => {
  const { name, address, phone, tradeLicenseNo, binNo, email, company, entityType } = req.body;

  if (!name || !address || !phone || !tradeLicenseNo || !binNo || !entityType) {
    return res.status(400).send('Missing required fields');
  }

  const companyHash = InvoiceService.createCompany({
    name,
    address,
    phone,
    trade_license_no: tradeLicenseNo,
    bin_no: binNo,
    entity_type: entityType,
    email,
    company
  });
  res.redirect(`/companies/${companyHash}`);
});

invoiceRouter.get('/companies/:hash', (req, res) => {
  const companyHash = req.params.hash;
  const company = InvoiceRepository.getClientByHash(companyHash);

  if (!company) {
    return res.status(404).send('Company not found');
  }

  const invoices = InvoiceRepository.getInvoicesByClientId(company.id);
  const currentFolder = req.query.folder as string || 'all';

  res.render('company-detail', { 
    company, 
    invoices,
    currentFolder,
    currentPage: 'companies', 
    pageTitle: company.name,
    FinanceService
  });
});

invoiceRouter.get('/companies/:hash/monthly-summary', (req, res) => {
  const companyHash = req.params.hash;
  const company = InvoiceRepository.getClientByHash(companyHash);

  if (!company) {
    return res.status(404).send('Company not found');
  }

  const monthlySummaries = InvoiceService.getCompanyMonthlySummary(company.id);

  res.render('company-monthly-summary', {
    company,
    monthlySummaries,
    currentPage: 'companies',
    pageTitle: `${company.name} Monthly Summary`,
    FinanceService
  });
});

invoiceRouter.post('/companies/:hash/folders', (req, res) => {
  const companyHash = req.params.hash;
  const { name } = req.body;
  const company = InvoiceRepository.getClientByHash(companyHash);
  
  if (!company) return res.status(404).send('Company not found');
  
  const folders = company.folders || [];
  folders.push({
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString()
  });
  
  company.folders = folders;
  InvoiceRepository.updateClient(company);
  res.redirect(`/companies/${companyHash}`);
});
