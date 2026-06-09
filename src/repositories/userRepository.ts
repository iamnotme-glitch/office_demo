import { db } from '../config/db.js';
import { User } from '../models/types.js';

export class UserRepository {
  static getUserByUsername(username: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get([username]) as User;
    return row || null;
  }

  static getUserByEmail(email: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get([email]) as User;
    return row || null;
  }

  static getUserById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get([id]) as User;
    return row || null;
  }

  static createUser(user: Omit<User, 'id' | 'created_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role, avatar)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run([
      user.username,
      user.email,
      user.password,
      user.role || 'user',
      user.avatar || null
    ]);

    return result.lastInsertRowid as number;
  }

  static getAllUsers(): User[] {
    return db.prepare('SELECT id, username, email, role, avatar, created_at FROM users').all() as User[];
  }

  static updateUser(id: number, data: Partial<User>): void {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    
    db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run([...values, id]);
  }

  static deleteUser(id: number): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}
