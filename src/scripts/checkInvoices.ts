import { db } from "../config/db.js";
const invoices = db.prepare("SELECT * FROM invoices").all();
console.log("Invoices:", JSON.stringify(invoices, null, 2));
