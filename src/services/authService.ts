import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/userRepository.js';
import { User } from '../models/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-freight-ledger-key';
const JWT_EXPIRES_IN = '24h';

export class AuthService {
  static async register(username: string, email: string, password: string, role: 'admin' | 'user' = 'user'): Promise<number> {
    const existingUser = (await UserRepository.getUserByUsername(username)) || (await UserRepository.getUserByEmail(email));
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return await UserRepository.createUser({
      username,
      email,
      password: hashedPassword,
      role,
      avatar: username.substring(0, 2).toUpperCase()
    });
  }

  static async login(username: string, password: string): Promise<{ token: string; user: Omit<User, 'password'> }> {
    const user = await UserRepository.getUserByUsername(username);
    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}
