import { AuthService } from '../services/authService.js';

const [username, email, password] = process.argv.slice(2);

if (!username || !email || !password) {
  console.error('Usage: npx tsx src/scripts/createAdmin.ts <username> <email> <password>');
  process.exit(1);
}

async function createAdmin() {
  try {
    const userId = await AuthService.register(username, email, password, 'admin');
    console.log(`Admin user '${username}' created successfully with ID: ${userId}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

createAdmin();
