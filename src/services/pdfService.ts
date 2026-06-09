import PDFDocument from 'pdfkit';
import type { Invoice, InvoiceItem } from '../models/types.js';
import { FinanceService } from './financeService.js';

type PDFDocumentInstance = InstanceType<typeof PDFDocument>;

type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

function addHeader(doc: PDFDocumentInstance, invoice: InvoiceWithItems) {
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111').text('FreightLedger', { continued: true });
  doc.fillColor('#2563eb').text(' Professional');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text('Professional logistics invoice generation system.');
  doc.moveDown(1);

  const top = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text('Invoice Number', 40, top);
  doc.font('Helvetica').fillColor('#111').text(invoice.invoice_number || 'N/A');

  doc.font('Helvetica-Bold').fillColor('#64748b').text('Issue Date', 320, top);
  doc.font('Helvetica').fillColor('#111').text(new Date(invoice.issue_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

  doc.moveDown(1.7);
}

function addAddressBoxes(doc: PDFDocumentInstance, invoice: InvoiceWithItems) {
  const leftX = 40;
  const rightX = 300;
  const rowY = doc.y;

  doc.rect(leftX - 10, rowY - 8, 240, 110).fillOpacity(0.04).fill('#2563eb').fillOpacity(1).stroke('#e2e8f0');
  doc.rect(rightX - 10, rowY - 8, 240, 110).fillOpacity(0.04).fill('#111').fillOpacity(1).stroke('#e2e8f0');

  doc.fillColor('#2563eb').font('Helvetica-Bold').fontSize(10).text('Bill To', leftX, rowY);
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(14).text(invoice.receiver_name || 'Miscellaneous Client', leftX, doc.y + 6);
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(invoice.receiver_address || 'No address provided', { width: 220 });
  if (invoice.tax_id) {
    doc.moveDown(0.4).font('Helvetica-Bold').fillColor('#111').text('Tax ID');
    doc.font('Helvetica').fillColor('#475569').text(invoice.tax_id);
  }

  const rightTop = rowY;
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(10).text('Bill From', rightX, rightTop);
  doc.font('Helvetica-Bold').fontSize(14).text(invoice.sender_name || 'FreightLedger Limited', rightX, doc.y + 6);
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(invoice.sender_address || 'Registered logistics hub', { width: 220 });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fillColor('#111').text('Status', rightX);
  doc.font('Helvetica').fillColor('#475569').text(invoice.status || 'Draft');
  doc.moveDown(1);
}

function addSectionTitle(doc: PDFDocumentInstance, title: string) {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#2563eb').text(title.toUpperCase());
  doc.moveDown(0.5);
}

function checkPageBreak(doc: PDFDocumentInstance) {
  if (doc.y > 700) {
    doc.addPage();
  }
}

function drawChargesTable(doc: PDFDocumentInstance, invoice: InvoiceWithItems) {
  const tableTop = doc.y;
  const itemX = 40;
  const qtyX = 310;
  const unitX = 380;
  const amountX = 470;

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
  doc.text('Description', itemX, tableTop);
  doc.text('Qty', qtyX, tableTop, { width: 60, align: 'right' });
  doc.text('Unit', unitX, tableTop, { width: 70, align: 'right' });
  doc.text('Amount', amountX, tableTop, { width: 90, align: 'right' });
  doc.moveTo(itemX, doc.y + 8).lineTo(550, doc.y + 8).strokeColor('#e2e8f0').stroke();
  doc.moveDown(1);

  doc.font('Helvetica').fontSize(10).fillColor('#111');

  const rows: Array<{ description: string; qty: string; unit: string; amount: string }> = [];

  if (invoice.vehicle_rates && invoice.vehicle_rates.length > 0) {
    invoice.vehicle_rates.forEach((rate) => {
      rows.push({
        description: `Transportation — ${rate.description}`,
        qty: `${rate.vehicles}`,
        unit: FinanceService.formatCurrency(rate.rate_per_vehicle),
        amount: FinanceService.formatCurrency(rate.amount),
      });
    });
  }

  if (invoice.demurrage_entries && invoice.demurrage_entries.length > 0) {
    invoice.demurrage_entries.forEach((entry) => {
      rows.push({
        description: `Demurrage — ${entry.days} days`,
        qty: `${entry.vehicles}`,
        unit: FinanceService.formatCurrency(entry.rate),
        amount: FinanceService.formatCurrency(entry.amount ?? 0),
      });
    });
  }

  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item) => {
      rows.push({
        description: item.description,
        qty: `${item.quantity}`,
        unit: FinanceService.formatCurrency(item.rate),
        amount: FinanceService.formatCurrency(item.amount),
      });
    });
  }

  rows.forEach((row) => {
    checkPageBreak(doc);
    doc.text(row.description, itemX, doc.y, { continued: false, width: 250 });
    doc.text(row.qty, qtyX, doc.y, { width: 60, align: 'right' });
    doc.text(row.unit, unitX, doc.y, { width: 70, align: 'right' });
    doc.text(row.amount, amountX, doc.y, { width: 90, align: 'right' });
    doc.moveDown(0.7);
  });

  doc.moveTo(itemX, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.7);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111');
  doc.text('TOTAL', itemX, doc.y, { continued: false, width: 250 });
  doc.text('', qtyX, doc.y, { width: 60, align: 'right' });
  doc.text('', unitX, doc.y, { width: 70, align: 'right' });
  doc.text(FinanceService.formatCurrency(invoice.total_amount), amountX, doc.y, { width: 90, align: 'right' });
  doc.moveDown(1);
}

export async function generateInvoicePdfBuffer(invoice: InvoiceWithItems): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  addHeader(doc, invoice);
  addAddressBoxes(doc, invoice);
  addSectionTitle(doc, 'Operational details');

  const details = [
    { label: 'Route', value: invoice.particulars_source && invoice.particulars_destination ? `${invoice.particulars_source.toUpperCase()} → ${invoice.particulars_destination.toUpperCase()}` : 'UNDEFINED' },
    { label: 'Challan', value: invoice.challan_no || 'N/A' },
    { label: 'Priority', value: invoice.transport_condition || 'STANDARD' },
    { label: 'Load volume', value: invoice.good_volume || '—' },
  ];

  details.forEach((detail) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text(detail.label.toUpperCase());
    doc.font('Helvetica').fontSize(11).fillColor('#111').text(detail.value);
    doc.moveDown(0.4);
  });

  addSectionTitle(doc, 'Charges summary');
  drawChargesTable(doc, invoice);

  if (invoice.notes) {
    addSectionTitle(doc, 'Notes');
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text(invoice.notes, { lineGap: 4 });
  }

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Thank you for your business. Please contact us with any questions.', { align: 'left' });

  doc.end();
  return result;
}
