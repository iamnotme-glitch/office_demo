import { db } from "../config/db.js";
const stmt = db.prepare("DELETE FROM invoices WHERE invoice_uuid IS NULL");
stmt.run();
console.log("Deleted invoices with NULL UUID");
