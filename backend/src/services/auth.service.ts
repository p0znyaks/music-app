import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { AppDataSource } from './dataSource';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES = '7d';

function signUserToken(user: User): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role.name },
    secret,
    { expiresIn: JWT_EXPIRES },
  );
}

export class AuthService {
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ token: string }> {
    const userRepo = AppDataSource.getRepository(User);
    const existingByEmail = await userRepo.findOne({ where: { email } });
    if (existingByEmail) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' });
    }

    const existingByUsername = await userRepo.findOne({ where: { username } });
    if (existingByUsername) {
      throw Object.assign(new Error('Username is already in use'), { code: 'USERNAME_TAKEN' });
    }

    const roleRepo = AppDataSource.getRepository(Role);
    const userRole = await roleRepo.findOne({ where: { id: 2 } });
    if (!userRole) {
      throw new Error('Default user role not found');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = userRepo.create({
      username,
      email,
      passwordHash,
      role: userRole,
      isBlocked: false,
    });
    await userRepo.save(user);

    const full = await userRepo.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    if (!full) {
      throw new Error('Failed to load created user');
    }

    return { token: signUserToken(full) };
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email },
      relations: ['role'],
    });

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }

    if (user.isBlocked) {
      throw Object.assign(new Error('Account is blocked'), { code: 'BLOCKED' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }

    return { token: signUserToken(user) };
  }
}
