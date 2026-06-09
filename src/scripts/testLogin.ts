import { AuthService } from "../services/authService.js";

async function test() {
  try {
    // Attempting to log in as one of the known users
    const result = await AuthService.login("admin_dexter", "MySecurePassword123!");
    console.log("Login successful:", result);
  } catch (e) {
    console.log("Login failed:", e instanceof Error ? e.message : e);
  }
}
test();
