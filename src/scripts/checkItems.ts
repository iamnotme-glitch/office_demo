import { db } from "../config/db.js";
const items = db.prepare("SELECT * FROM invoice_items").all();
console.log("Items:", items);
