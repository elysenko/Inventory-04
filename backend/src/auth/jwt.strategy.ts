import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_SECRET } from './jwt.constants';
import type { AuthUser, JwtPayload } from './auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /**
   * Re-reads the user on every request so a deleted account, or one whose role
   * changed after the token was minted, cannot keep acting on the stale claim.
   * A missing row is a 401, never an unhandled 500.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
