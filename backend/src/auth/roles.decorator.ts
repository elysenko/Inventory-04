import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a handler to the listed roles; RolesGuard answers 403 otherwise. */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
