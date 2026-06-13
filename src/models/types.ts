export type ClientFolder = {
  id: string;
  name: string;
  created_at: string;
};

export type Client = {
  id: number;
  name: string;
  company?: string;
  address?: string;
  entity_type: 'company' | 'cf_agent';
  trade_license_no?: string;
  bin_no?: string;
  email?: string;
  phone?: string;
  uuid_hash?: string;
  visitor_id?: string;
  created_at: string;
  folders?: ClientFolder[];
};

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type RateSegment = {
  description: string;
  rate_per_vehicle: number;
  vehicles: number;
  amount: number;
};

export type VehicleEntry = {
  registration: string;
  vehicle_type?: 'Covered Van' | 'Container';
  vehicle_size?: string;
  load_type?: 'Lcl' | 'Fcl' | 'Hcl';
};

export type DemurrageEntry = {
  vehicles: number;
  rate: number;
  days: number;
  amount?: number;
};

export type InvoiceRecord = {
  id: number;
  client_id?: number;
  sender_id?: number;
  receiver_id?: number;
  sender_name?: string;
  sender_address?: string;
  sender_type?: 'company' | 'cf_agent';
  receiver_name?: string;
  receiver_address?: string;
  receiver_type?: 'company' | 'cf_agent';
  invoice_number: string;
  issue_date: string;
  status: string;
  notes?: string;
  visitor_id?: string;
  transport_condition?: 'Normal' | 'Urgent' | 'Fragile' | 'Special';
  invoice_uuid?: string;
  vehicle_registration_nos?: string[];
  vehicle_entries?: VehicleEntry[];
  vehicle_type?: 'Covered Van' | 'Container';
  vehicle_size?: string;
  load_type?: 'Lcl' | 'Fcl' | 'Hcl';
  good_volume?: string;
  vehicle_count?: number;
  quantity_unit?: 'Cartons' | 'Packages';
  company_invoice_no?: string;
  challan_no?: string;
  particulars_source?: string;
  particulars_destination?: string;
  particulars_notes?: string;
  folder_id?: string;
  monthly_sequence?: number;
  vehicle_rates?: RateSegment[];
  demurrage_entries?: DemurrageEntry[];
  total_amount: number;
  created_at: string;
};

export type Invoice = InvoiceRecord & {
  client_name: string;
  company?: string;
  address?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
};

export interface CreateInvoiceDTO {
  sender_id: number | null;
  receiver_id: number | null;
  sender_name: string;
  sender_address: string;
  sender_type?: 'company' | 'cf_agent';
  receiver_name: string;
  receiver_address: string;
  receiver_type?: 'company' | 'cf_agent';
  invoice_number: string;
  visitor_id?: string;
  issue_date: string;
  notes: string;
  transport_condition?: 'Normal' | 'Urgent' | 'Fragile' | 'Special';
  vehicle_entries: VehicleEntry[];
  vehicle_registration_nos: string[];
  vehicle_type?: 'Covered Van' | 'Container';
  vehicle_size: string;
  load_type?: 'Lcl' | 'Fcl' | 'Hcl';
  good_volume: string;
  vehicle_count: number;
  quantity_unit?: 'Cartons' | 'Packages';
  company_invoice_no: string;
  challan_no: string;
  particulars_source: string;
  particulars_destination: string;
  particulars_notes: string;
  folder_id?: string;
  vehicle_rates: RateSegment[];
  demurrage_entries: DemurrageEntry[];
  items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'amount'>[];
  invoice_uuid?: string;
}
export interface UpdateInvoiceDTO extends CreateInvoiceDTO {
  id: number;
  invoice_uuid?: string;
  status?: string;
  created_at?: string;
}
export type User = {
  id: number;
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  avatar?: string;
  created_at: string;
};

export type AuthToken = {
  token: string;
  expiresAt: number;
};

export type DatabaseSchema = {
  clients: Client[];
  invoices: InvoiceRecord[];
  invoice_items: InvoiceItem[];
  users: User[];
};
