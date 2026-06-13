import { db } from '../config/db.js';
import { User } from '../models/types.js';

export class UserRepository {
  static async getUserByUsername(username: string): Promise<User | null> {
    const row = await db.prepare('SELECT * FROM users WHERE username = ?').get([username]) as User;
    return row || null;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const row = await db.prepare('SELECT * FROM users WHERE email = ?').get([email]) as User;
    return row || null;
  }

  static async getUserById(id: number): Promise<User | null> {
    const row = await db.prepare('SELECT * FROM users WHERE id = ?').get([id]) as User;
    return row || null;
  }

  static async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<number> {
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role, avatar)
      VALUES (?, ?, ?, ?, ?) RETURNING id
    `);

    const result = await stmt.run([
      user.username,
      user.email,
      user.password,
      user.role || 'user',
      user.avatar || null
    ]);

    return result.lastInsertRowid as number;
  }

  static async getAllUsers(): Promise<User[]> {
    return await db.prepare('SELECT id, username, email, role, avatar, created_at FROM users').all() as User[];
  }

  static async updateUser(id: number, data: Partial<User>): Promise<void> {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    await db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run([...values, id]);
  }

  static async deleteUser(id: number): Promise<void> {
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}
