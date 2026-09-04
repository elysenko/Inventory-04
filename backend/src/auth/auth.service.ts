import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { P2002_UNIQUE, isPrismaError } from '../common/prisma-error';
import type { AuthUser, JwtPayload } from './auth-user';
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';

const BCRYPT_ROUNDS = 10;

/** Deliberately identical for "no such user" and "wrong password" so the
 *  endpoint cannot be used to enumerate registered accounts. */
const INVALID_CREDENTIALS = 'Invalid email or password';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Compare against a dummy hash when the user is unknown so the response
    // time does not distinguish the two failure modes.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !ok) throw new UnauthorizedException(INVALID_CREDENTIALS);

    return this.issue(user);
  }

  /** Self-service signup always creates a clerk — the role is never taken from
   *  the request, so it cannot be used to escalate to manager. */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash, role: Role.clerk },
      });
      return this.issue(user);
    } catch (error) {
      if (isPrismaError(error, P2002_UNIQUE)) {
        throw new BadRequestException('An account with that email already exists');
      }
      throw error;
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return user;
  }

  private issue(user: {
    id: string;
    email: string;
    role: Role;
    createdAt?: Date;
  }): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
