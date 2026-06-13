import { db } from '../config/db.js';
import { Client, InvoiceItem, InvoiceRecord } from '../models/types.js';
import { CacheService } from '../services/cacheService.js';

export class InvoiceRepository {
  static getClients(): Client[] {
    const cacheKey = 'all_clients';
    const cached = CacheService.get<Client[]>(cacheKey);
    if (cached) return cached;

    const rows = db.prepare('SELECT * FROM clients').all() as any[];
    const clients = rows.map(row => ({
      ...row,
      folders: row.folders ? JSON.parse(row.folders) : []
    }));

    CacheService.set(cacheKey, clients, 60); // Cache for 60 seconds
    return clients;
  }

  static getInvoices(): InvoiceRecord[] {
    const cacheKey = 'all_invoices';
    const cached = CacheService.get<InvoiceRecord[]>(cacheKey);
    if (cached) return cached;

    const rows = db.prepare('SELECT * FROM invoices').all() as any[];
    const invoices = rows.map(row => this.mapInvoiceRow(row));

    CacheService.set(cacheKey, invoices, 30); // Cache for 30 seconds
    return invoices;
  }

  static getInvoiceItems(): InvoiceItem[] {
    return db.prepare('SELECT * FROM invoice_items').all() as InvoiceItem[];
  }

  static getInvoiceById(id: number): InvoiceRecord | null {
    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get([id]) as any;
    return row ? this.mapInvoiceRow(row) : null;
  }

  static getInvoiceByUuid(uuid: string): InvoiceRecord | null {
    const row = db.prepare('SELECT * FROM invoices WHERE invoice_uuid = ?').get([uuid]) as any;
    return row ? this.mapInvoiceRow(row) : null;
  }

  static getItemsByInvoiceId(invoiceId: number): InvoiceItem[] {
    return db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all([invoiceId]) as InvoiceItem[];
  }

  static getClientById(id: number): Client | null {
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get([id]) as any;
    return row ? { ...row, folders: row.folders ? JSON.parse(row.folders) : [] } : null;
  }

  static getClientByHash(hash: string): Client | null {
    const row = db.prepare('SELECT * FROM clients WHERE uuid_hash = ?').get([hash]) as any;
    return row ? { ...row, folders: row.folders ? JSON.parse(row.folders) : [] } : null;
  }

  static saveInvoice(record: InvoiceRecord): number {
    CacheService.delete('all_invoices');
    const stmt = db.prepare(`
      INSERT INTO invoices (
        client_id, sender_id, receiver_id, sender_name, sender_address, sender_type,
        receiver_name, receiver_address, receiver_type, invoice_number, issue_date,
        status, notes, transport_condition, invoice_uuid, vehicle_registration_nos,
        vehicle_entries, vehicle_type, vehicle_size, load_type, good_volume, vehicle_count,
        quantity_unit, company_invoice_no, challan_no, particulars_source,
        particulars_destination, particulars_notes, folder_id, monthly_sequence,
        total_amount, vehicle_rates, demurrage_entries, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run([
      record.client_id || null, record.sender_id || null, record.receiver_id || null,
      record.sender_name || null, record.sender_address || null, record.sender_type || null,
      record.receiver_name || null, record.receiver_address || null, record.receiver_type || null,
      record.invoice_number, record.issue_date, record.status, record.notes || null,
      record.transport_condition || null, record.invoice_uuid,
      JSON.stringify(record.vehicle_registration_nos || []),
      JSON.stringify(record.vehicle_entries || []),
      record.vehicle_type || null, record.vehicle_size || null, record.load_type || null,
      record.good_volume || null, record.vehicle_count || 0, record.quantity_unit || null,
      record.company_invoice_no || null, record.challan_no || null,
      record.particulars_source || null, record.particulars_destination || null,
      record.particulars_notes || null, record.folder_id || null, record.monthly_sequence || null,
      record.total_amount, JSON.stringify(record.vehicle_rates || []),
      JSON.stringify(record.demurrage_entries || []), record.created_at
    ]);

    return result.lastInsertRowid as number;
  }

  static updateInvoice(record: InvoiceRecord): void {
    CacheService.delete('all_invoices');
    const stmt = db.prepare(`
      UPDATE invoices SET
        client_id = ?, sender_id = ?, receiver_id = ?, sender_name = ?, sender_address = ?,
        sender_type = ?, receiver_name = ?, receiver_address = ?, receiver_type = ?,
        invoice_number = ?, issue_date = ?, status = ?, notes = ?,
        transport_condition = ?, invoice_uuid = ?, vehicle_registration_nos = ?,
        vehicle_entries = ?, vehicle_type = ?, vehicle_size = ?, load_type = ?, good_volume = ?,
        vehicle_count = ?, quantity_unit = ?, company_invoice_no = ?,
        challan_no = ?, particulars_source = ?, particulars_destination = ?,
        particulars_notes = ?, folder_id = ?, monthly_sequence = ?,
        total_amount = ?, vehicle_rates = ?, demurrage_entries = ?, created_at = ?
      WHERE id = ?
    `);

    stmt.run([
      record.client_id || null, record.sender_id || null, record.receiver_id || null,
      record.sender_name || null, record.sender_address || null, record.sender_type || null,
      record.receiver_name || null, record.receiver_address || null, record.receiver_type || null,
      record.invoice_number, record.issue_date, record.status, record.notes || null,
      record.transport_condition || null, record.invoice_uuid,
      JSON.stringify(record.vehicle_registration_nos || []),
      JSON.stringify(record.vehicle_entries || []),
      record.vehicle_type || null, record.vehicle_size || null, record.load_type || null,
      record.good_volume || null, record.vehicle_count || 0, record.quantity_unit || null,
      record.company_invoice_no || null, record.challan_no || null,
      record.particulars_source || null, record.particulars_destination || null,
      record.particulars_notes || null, record.folder_id || null, record.monthly_sequence || null,
      record.total_amount, JSON.stringify(record.vehicle_rates || []),
      JSON.stringify(record.demurrage_entries || []), record.created_at, record.id
    ]);
  }

  static deleteInvoice(id: number): void {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
  }

  static saveInvoiceItems(items: InvoiceItem[]): void {
    const stmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items: InvoiceItem[]) => {
      for (const item of items) {
        stmt.run([item.invoice_id, item.description, item.quantity, item.rate, item.amount]);
      }
    });

    transaction(items);
  }

  static replaceInvoiceItems(invoiceId: number, items: InvoiceItem[]): void {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    this.saveInvoiceItems(items);
  }

  static saveClient(client: Client): number {
    CacheService.delete('all_clients');
    const stmt = db.prepare(`
      INSERT INTO clients (name, company, address, entity_type, trade_license_no, bin_no, email, phone, uuid_hash, folders, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run([
      client.name, client.company || null, client.address || null, client.entity_type,
      client.trade_license_no || null, client.bin_no || null, client.email || null,
      client.phone || null, client.uuid_hash, JSON.stringify(client.folders || []), client.created_at
    ]);

    return result.lastInsertRowid as number;
  }

  static updateClient(client: Client): void {
    CacheService.delete('all_clients');
    const stmt = db.prepare(`
      UPDATE clients SET
        name = ?, company = ?, address = ?, entity_type = ?, trade_license_no = ?,
        bin_no = ?, email = ?, phone = ?, uuid_hash = ?, folders = ?, created_at = ?
      WHERE id = ?
    `);

    stmt.run([
      client.name, client.company || null, client.address || null, client.entity_type,
      client.trade_license_no || null, client.bin_no || null, client.email || null,
      client.phone || null, client.uuid_hash, JSON.stringify(client.folders || []), client.created_at, client.id
    ]);
  }

  static getInvoicesByClientId(clientId: number): InvoiceRecord[] {
    const rows = db.prepare('SELECT * FROM invoices WHERE receiver_id = ?').all([clientId]) as any[];
    return rows.map(row => this.mapInvoiceRow(row));
  }

  static getInvoicesByFolderId(clientId: number, folderId: string): InvoiceRecord[] {
    const rows = db.prepare('SELECT * FROM invoices WHERE receiver_id = ? AND folder_id = ?').all([clientId, folderId]) as any[];
    return rows.map(row => this.mapInvoiceRow(row));
  }

  static getNextInvoiceId(): number {
    // This is less critical with AUTOINCREMENT, but kept for compatibility
    const row = db.prepare('SELECT MAX(id) as maxId FROM invoices').get() as any;
    return (row.maxId || 0) + 1;
  }

  static getNextItemId(): number {
    const row = db.prepare('SELECT MAX(id) as maxId FROM invoice_items').get() as any;
    return (row.maxId || 0) + 1;
  }

  static getNextClientId(): number {
    const row = db.prepare('SELECT MAX(id) as maxId FROM clients').get() as any;
    return (row.maxId || 0) + 1;
  }

  private static mapInvoiceRow(row: any): InvoiceRecord {
    return {
      ...row,
      vehicle_registration_nos: row.vehicle_registration_nos ? JSON.parse(row.vehicle_registration_nos) : [],
      vehicle_rates: row.vehicle_rates ? JSON.parse(row.vehicle_rates) : [],
      demurrage_entries: row.demurrage_entries ? JSON.parse(row.demurrage_entries) : [],
      vehicle_entries: row.vehicle_entries ? JSON.parse(row.vehicle_entries) : []
    };
  }
}
