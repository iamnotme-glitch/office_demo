import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient } from 'pg';

const postgresUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const usePostgres = Boolean(postgresUrl);
const isServerless = process.env.VERCEL === '1';
const dataDir = process.env.SQLJS_DB_DIR || (isServerless ? path.join('/tmp', 'office-invoice-app-data') : path.join(process.cwd(), 'data'));

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const normalizeParams = (params: any): any[] => {
  if (params === undefined || params === null) return [];
  return Array.isArray(params) ? params : [params];
};

const convertPlaceholders = (sql: string): string => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

type DbStatement = {
  all(params?: any): Promise<any[]>;
  get(params?: any): Promise<any | null>;
  run(params?: any): Promise<{ lastInsertRowid?: number }>;
  free(): void;
};

type DbClient = {
  prepare(sql: string): DbStatement;
  exec(sql: string): Promise<void>;
  transaction<T extends (...args: any[]) => Promise<any>>(fn: T): (...args: Parameters<T>) => Promise<ReturnType<T>>;
};

let rawDb: any;
let saveDatabase: () => void;
let db: DbClient;

if (usePostgres) {
  const pool = new Pool({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  const transactionStorage = new AsyncLocalStorage<PoolClient>();

  const getClient = async (): Promise<PoolClient> => {
    const current = transactionStorage.getStore();
    if (current) return current;
    return await pool.connect();
  };

  const buildStatement = (sql: string): DbStatement => {
    const text = convertPlaceholders(sql);

    return {
      async all(params?: any) {
        const client = await getClient();
        try {
          const result = await client.query(text, normalizeParams(params));
          return result.rows;
        } finally {
          if (!transactionStorage.getStore()) client.release();
        }
      },
      async get(params?: any) {
        const rows = await this.all(params);
        return rows[0] ?? null;
      },
      async run(params?: any) {
        const client = await getClient();
        try {
          const result = await client.query(text, normalizeParams(params));
          return {
            lastInsertRowid: typeof result.rows?.[0]?.id === 'number' ? result.rows[0].id : undefined
          };
        } finally {
          if (!transactionStorage.getStore()) client.release();
        }
      },
      free() {
        // no-op for Postgres
      }
    };
  };

  db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },
    async exec(sql: string) {
      const client = await getClient();
      try {
        await client.query(sql);
      } finally {
        if (!transactionStorage.getStore()) client.release();
      }
    },
    transaction<T extends (...args: any[]) => Promise<any>>(fn: T) {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const client = await pool.connect();
        return transactionStorage.run(client, async () => {
          try {
            await client.query('BEGIN');
            const result = await fn(...args);
            await client.query('COMMIT');
            return result;
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        });
      };
    }
  };

  const ensureSchema = async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT,
        address TEXT,
        entity_type TEXT CHECK(entity_type IN ('company', 'cf_agent')),
        trade_license_no TEXT,
        bin_no TEXT,
        email TEXT,
        phone TEXT,
        uuid_hash TEXT UNIQUE,
        folders TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        sender_id INTEGER,
        receiver_id INTEGER,
        sender_name TEXT,
        sender_address TEXT,
        sender_type TEXT,
        receiver_name TEXT,
        receiver_address TEXT,
        receiver_type TEXT,
        invoice_number TEXT,
        issue_date TEXT,
        status TEXT DEFAULT 'Draft',
        notes TEXT,
        transport_condition TEXT,
        invoice_uuid TEXT UNIQUE,
        vehicle_registration_nos TEXT,
        vehicle_entries TEXT,
        vehicle_type TEXT,
        vehicle_size TEXT,
        load_type TEXT,
        good_volume TEXT,
        vehicle_count INTEGER,
        quantity_unit TEXT,
        company_invoice_no TEXT,
        challan_no TEXT,
        particulars_source TEXT,
        particulars_destination TEXT,
        particulars_notes TEXT,
        folder_id TEXT,
        monthly_sequence INTEGER,
        total_amount REAL,
        vehicle_rates TEXT,
        demurrage_entries TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receiver_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER,
        description TEXT,
        quantity REAL,
        rate REAL,
        amount REAL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
        avatar TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const miscClient = await db.prepare("SELECT * FROM clients WHERE name = 'Miscellaneous'").get();
    if (!miscClient) {
      await db.prepare(`
        INSERT INTO clients (name, company, address, entity_type, uuid_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(['Miscellaneous', 'Miscellaneous Billing', '', 'company', '04c56a', new Date().toISOString()]);
    }
  };

  await ensureSchema();
} else {
  if (isServerless && !process.env.SQLJS_DB_DIR) {
    console.warn('[DB] Running on Vercel serverless: local SQLite storage is ephemeral and may not persist across function instances. For stable data, use an external persistent database or mount a persistent storage path.');
  }

  const dbFile = path.join(dataDir, 'invoice.db');
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  });

  const fileData = fs.existsSync(dbFile) ? fs.readFileSync(dbFile) : undefined;
  rawDb = fileData ? new SQL.Database(new Uint8Array(fileData)) : new SQL.Database();

  saveDatabase = () => {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFile, buffer);
  };

  let transactionDepth = 0;

  const buildStatement = (sql: string): DbStatement => {
    const stmt = rawDb.prepare(sql);
    return {
      async all(params?: any) {
        stmt.bind(normalizeParams(params));
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      async get(params?: any) {
        stmt.bind(normalizeParams(params));
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        return row;
      },
      async run(params?: any) {
        stmt.bind(normalizeParams(params));
        stmt.step();
        stmt.free();
        const lastInsertRowid = rawDb.exec('SELECT last_insert_rowid() AS id;')[0]?.values?.[0]?.[0] as number | undefined;
        if (transactionDepth === 0) saveDatabase();
        return { lastInsertRowid };
      },
      free() {
        stmt.free();
      }
    };
  };

  db = {
    prepare(sql: string) {
      return buildStatement(sql);
    },
    async exec(sql: string) {
      rawDb.exec(sql);
      if (transactionDepth === 0) saveDatabase();
    },
    transaction<T extends (...args: any[]) => Promise<any>>(fn: T) {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        transactionDepth += 1;
        if (transactionDepth === 1) rawDb.exec('BEGIN');
        try {
          const result = await fn(...args);
          if (transactionDepth === 1) {
            rawDb.exec('COMMIT');
            saveDatabase();
          }
          return result;
        } catch (error) {
          if (transactionDepth === 1) {
            rawDb.exec('ROLLBACK');
          }
          throw error;
        } finally {
          transactionDepth -= 1;
        }
      };
    }
  };

  rawDb.exec('PRAGMA foreign_keys = ON;');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      address TEXT,
      entity_type TEXT CHECK(entity_type IN ('company', 'cf_agent')),
      trade_license_no TEXT,
      bin_no TEXT,
      email TEXT,
      phone TEXT,
      uuid_hash TEXT UNIQUE,
      folders TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      sender_id INTEGER,
      receiver_id INTEGER,
      sender_name TEXT,
      sender_address TEXT,
      sender_type TEXT,
      receiver_name TEXT,
      receiver_address TEXT,
      receiver_type TEXT,
      invoice_number TEXT,
      issue_date TEXT,
      status TEXT DEFAULT 'Draft',
      notes TEXT,
      transport_condition TEXT,
      invoice_uuid TEXT UNIQUE,
      vehicle_registration_nos TEXT,
      vehicle_entries TEXT,
      vehicle_type TEXT,
      vehicle_size TEXT,
      load_type TEXT,
      good_volume TEXT,
      vehicle_count INTEGER,
      quantity_unit TEXT,
      company_invoice_no TEXT,
      challan_no TEXT,
      particulars_source TEXT,
      particulars_destination TEXT,
      particulars_notes TEXT,
      folder_id TEXT,
      monthly_sequence INTEGER,
      total_amount REAL,
      vehicle_rates TEXT,
      demurrage_entries TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receiver_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      description TEXT,
      quantity REAL,
      rate REAL,
      amount REAL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
      avatar TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const invoiceTableInfo = rawDb.exec('PRAGMA table_info(invoices);')[0]?.values || [];
  const invoiceColumns = invoiceTableInfo.map((row: any) => row[1]);
  const requiredInvoiceColumns = [
    { name: 'vehicle_entries', definition: 'TEXT' },
    { name: 'vehicle_type', definition: 'TEXT' },
    { name: 'vehicle_size', definition: 'TEXT' },
    { name: 'load_type', definition: 'TEXT' },
  ];
  for (const column of requiredInvoiceColumns) {
    if (!invoiceColumns.includes(column.name)) {
      rawDb.exec(`ALTER TABLE invoices ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const miscClient = await db.prepare("SELECT * FROM clients WHERE name = 'Miscellaneous'").get();
  if (!miscClient) {
    await db.prepare(`
      INSERT INTO clients (name, company, address, entity_type, uuid_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(['Miscellaneous', 'Miscellaneous Billing', '', 'company', '04c56a', new Date().toISOString()]);
  }

  saveDatabase();
}

export { db };
