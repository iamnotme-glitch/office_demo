import { db } from "../config/db.js";
const users = db.prepare("SELECT * FROM users").all();
console.log("Users:", users);
