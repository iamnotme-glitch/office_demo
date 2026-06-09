import crypto from 'crypto';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';
import { FinanceService } from './financeService.js';
import { Client, Invoice, InvoiceItem, InvoiceRecord, CreateInvoiceDTO, UpdateInvoiceDTO, RateSegment, DemurrageEntry } from '../models/types.js';

export class InvoiceService {
  static getAllInvoices(): Invoice[] {
    const invoices = InvoiceRepository.getInvoices();
    const clients = InvoiceRepository.getClients();

    return invoices
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((invoice) => {
        const client = clients.find((item) => item.id === invoice.client_id || item.id === invoice.receiver_id);
        return {
          ...invoice,
          client_name: client?.name ?? 'Miscellaneous',
        };
      });
  }

  static getInvoiceDetails(id: number): (Invoice & { items: InvoiceItem[] }) | null {
    const record = InvoiceRepository.getInvoiceById(id);
    if (!record) return null;
    return this.mapToInvoiceDetails(record);
  }

  static getInvoiceDetailsByUuid(uuid: string): (Invoice & { items: InvoiceItem[] }) | null {
    const record = InvoiceRepository.getInvoiceByUuid(uuid);
    if (!record) return null;
    return this.mapToInvoiceDetails(record);
  }

  private static mapToInvoiceDetails(record: InvoiceRecord): (Invoice & { items: InvoiceItem[] }) {
    const sender = InvoiceRepository.getClientById(record.sender_id || -1);
    const receiver = InvoiceRepository.getClientById(record.receiver_id || -1);
    const items = InvoiceRepository.getItemsByInvoiceId(record.id);

    // Reconstruct vehicle_entries if missing or null in DB
    const vehicle_entries = record.vehicle_entries && record.vehicle_entries.length > 0
      ? record.vehicle_entries
      : (record.vehicle_registration_nos || []).map(registration => ({
          registration,
          vehicle_type: record.vehicle_type,
          vehicle_size: record.vehicle_size,
          load_type: record.load_type
        }));

    return {
      ...record,
      items,
      vehicle_entries,
      client_name: receiver?.name ?? record.receiver_name ?? 'Miscellaneous',
      company: receiver?.company ?? record.receiver_name,
      address: receiver?.address ?? record.receiver_address,
      tax_id: receiver?.trade_license_no ? `TL:${receiver.trade_license_no}|BIN:${receiver.bin_no}` : undefined,
      email: receiver?.email,
      phone: receiver?.phone,
      sender_name: record.sender_name ?? sender?.name ?? '',
      sender_address: record.sender_address ?? sender?.address ?? '',
      sender_type: record.sender_type ?? sender?.entity_type,
      receiver_name: record.receiver_name ?? receiver?.name ?? '',
      receiver_address: record.receiver_address ?? receiver?.address ?? '',
      receiver_type: record.receiver_type ?? receiver?.entity_type,
    };
  }

  static createInvoice(dto: CreateInvoiceDTO): string {
    const nextInvoiceId = InvoiceRepository.getNextInvoiceId();
    // Ensure a truly random UUID is generated if not provided
    const invoiceUuid = (dto.invoice_uuid && dto.invoice_uuid.trim().length > 0) 
      ? dto.invoice_uuid.trim() 
      : crypto.randomUUID();

    // Calculate monthly sequence
    const issueDate = new Date(dto.issue_date);
    const month = issueDate.getMonth();
    const year = issueDate.getFullYear();
    const monthYearStr = `${String(month + 1).padStart(2, '0')}${String(year).slice(-2)}`;

    const receiver = InvoiceRepository.getClientById(dto.receiver_id || -1);
    const companyShortName = (receiver?.company || receiver?.name?.slice(0, 4).toUpperCase() || 'INV').replace(/\s+/g, '-').toUpperCase();

    const monthlyInvoices = InvoiceRepository.getInvoices().filter(inv => {
      const d = new Date(inv.issue_date);
      return d.getMonth() === month && d.getFullYear() === year && inv.receiver_id === dto.receiver_id;
    });

    const sequence = monthlyInvoices.length + 1;
    
    let folderPart = '';
    if (dto.folder_id && receiver?.folders) {
      const folder = receiver.folders.find(f => f.id === dto.folder_id);
      if (folder) {
        folderPart = `-${folder.name.toUpperCase().replace(/\s+/g, '-')}`;
      }
    }

    const generatedInvoiceNumber = `${companyShortName}${folderPart}-${monthYearStr}-${String(sequence).padStart(3, '0')}`;

    const preparedItems = dto.items
      .map(item => ({
        ...item,
        amount: FinanceService.calculateLineItem(item)
      }));

    const total_amount = FinanceService.calculateGrandTotal(
      preparedItems,
      dto.vehicle_rates,
      dto.demurrage_entries
    );

    const record: InvoiceRecord = {
      id: nextInvoiceId,
      client_id: dto.receiver_id ?? undefined,
      sender_id: dto.sender_id ?? undefined,
      receiver_id: dto.receiver_id ?? undefined,
      sender_name: dto.sender_name,
      sender_address: dto.sender_address,
      sender_type: dto.sender_type,
      receiver_name: dto.receiver_name,
      receiver_address: dto.receiver_address,
      receiver_type: dto.receiver_type,
      invoice_number: dto.invoice_number || generatedInvoiceNumber,
      issue_date: dto.issue_date,
      status: 'Draft',
      notes: dto.notes,
      transport_condition: dto.transport_condition,
      invoice_uuid: invoiceUuid,
      vehicle_registration_nos: dto.vehicle_registration_nos,
      vehicle_type: dto.vehicle_type,
      vehicle_size: dto.vehicle_size,
      load_type: dto.load_type,
      good_volume: dto.good_volume,
      vehicle_count: dto.vehicle_count,
      quantity_unit: dto.quantity_unit,
      company_invoice_no: dto.company_invoice_no,
      challan_no: dto.challan_no,
      particulars_source: dto.particulars_source,
      particulars_destination: dto.particulars_destination,
      particulars_notes: dto.particulars_notes,
      folder_id: dto.folder_id,
      monthly_sequence: sequence,
      vehicle_entries: dto.vehicle_entries,
      vehicle_rates: dto.vehicle_rates,
      demurrage_entries: dto.demurrage_entries,
      total_amount,
      created_at: new Date().toISOString(),
    };

    InvoiceRepository.saveInvoice(record);

    let nextItemId = InvoiceRepository.getNextItemId();
    const itemsToSave: InvoiceItem[] = preparedItems.map(item => ({
      id: nextItemId++,
      invoice_id: nextInvoiceId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
    }));

    InvoiceRepository.saveInvoiceItems(itemsToSave);

    return invoiceUuid;
  }

  static updateInvoice(dto: UpdateInvoiceDTO): string {
    const existing = InvoiceRepository.getInvoiceById(dto.id);
    if (!existing) {
      throw new Error('Invoice not found');
    }

    const preparedItems = dto.items
      .map(item => ({
        ...item,
        amount: FinanceService.calculateLineItem(item)
      }));

    const total_amount = FinanceService.calculateGrandTotal(
      preparedItems,
      dto.vehicle_rates,
      dto.demurrage_entries
    );

    // Keep existing UUID if no new one is provided in the DTO
    const invoiceUuid = (dto.invoice_uuid && dto.invoice_uuid.trim().length > 0)
      ? dto.invoice_uuid.trim()
      : (existing.invoice_uuid || crypto.randomUUID());

    const record: InvoiceRecord = {
      id: dto.id,
      client_id: dto.receiver_id ?? undefined,
      sender_id: dto.sender_id ?? undefined,
      receiver_id: dto.receiver_id ?? undefined,
      sender_name: dto.sender_name,
      sender_address: dto.sender_address,
      sender_type: dto.sender_type,
      receiver_name: dto.receiver_name,
      receiver_address: dto.receiver_address,
      receiver_type: dto.receiver_type,
      invoice_number: dto.invoice_number,
      issue_date: dto.issue_date,
      status: dto.status ?? existing.status,
      notes: dto.notes,
      transport_condition: dto.transport_condition,
      invoice_uuid: invoiceUuid,
      vehicle_registration_nos: dto.vehicle_registration_nos,
      vehicle_type: dto.vehicle_type,
      vehicle_size: dto.vehicle_size,
      load_type: dto.load_type,
      good_volume: dto.good_volume,
      vehicle_count: dto.vehicle_count,
      quantity_unit: dto.quantity_unit,
      company_invoice_no: dto.company_invoice_no,
      challan_no: dto.challan_no,
      particulars_source: dto.particulars_source,
      particulars_destination: dto.particulars_destination,
      particulars_notes: dto.particulars_notes,
      folder_id: dto.folder_id || existing.folder_id,
      monthly_sequence: existing.monthly_sequence,
      vehicle_entries: dto.vehicle_entries,
      vehicle_rates: dto.vehicle_rates,
      demurrage_entries: dto.demurrage_entries,
      total_amount,
      created_at: dto.created_at ?? existing.created_at,
    };

    InvoiceRepository.updateInvoice(record);

    let nextItemId = InvoiceRepository.getNextItemId();
    const itemsToSave: InvoiceItem[] = preparedItems.map(item => ({
      id: nextItemId++,
      invoice_id: dto.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
    }));

    InvoiceRepository.replaceInvoiceItems(dto.id, itemsToSave);
    return invoiceUuid;
  }

  static deleteInvoiceByUuid(uuid: string): void {
    const record = InvoiceRepository.getInvoiceByUuid(uuid);
    if (!record) throw new Error('Invoice not found');
    InvoiceRepository.deleteInvoice(record.id);
  }

  private static generateClientHash(): string {
    return crypto.randomBytes(3).toString('hex').toLowerCase();
  }

  static getAllCompanies(): Client[] {
    const clients = InvoiceRepository.getClients();
    let updated = false;
    
    clients.forEach(client => {
      if (!client.uuid_hash) {
        client.uuid_hash = this.generateClientHash();
        updated = true;
      }
    });

    if (updated) {
      clients.forEach(c => InvoiceRepository.updateClient(c));
    }

    return clients
      .filter((client) => client.name !== 'Miscellaneous')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static createCompany(data: Omit<Client, 'id' | 'created_at' | 'uuid_hash'>): string {
    const nextClientId = InvoiceRepository.getNextClientId();
    const hash = this.generateClientHash();
    const newClient: Client = {
      ...data,
      id: nextClientId,
      uuid_hash: hash,
      created_at: new Date().toISOString(),
    };

    InvoiceRepository.saveClient(newClient);
    return hash;
  }
}
