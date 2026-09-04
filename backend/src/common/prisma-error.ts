import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Prisma error codes we translate into HTTP-meaningful exceptions. */
export const P2002_UNIQUE = 'P2002';
export const P2025_NOT_FOUND = 'P2025';
export const P2003_FK = 'P2003';

export function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

/**
 * Maps Prisma's known request errors onto the status contract the frontend
 * relies on: unique violations and FK violations are user-correctable input
 * problems (400 `{message}`), a missing row is 404. Anything else is rethrown
 * so it surfaces as a genuine 500 rather than being silently swallowed.
 */
export function rethrowPrisma(
  error: unknown,
  messages: { unique?: string; notFound?: string; fk?: string } = {},
): never {
  if (isPrismaError(error, P2002_UNIQUE)) {
    throw new BadRequestException(messages.unique ?? 'Value already exists');
  }
  if (isPrismaError(error, P2025_NOT_FOUND)) {
    throw new NotFoundException(messages.notFound ?? 'Not found');
  }
  if (isPrismaError(error, P2003_FK)) {
    throw new BadRequestException(messages.fk ?? 'Referenced record not found');
  }
  throw error;
}
