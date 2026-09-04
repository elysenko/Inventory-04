import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MovementType } from '@prisma/client';

interface MovementShape {
  type?: MovementType;
  fromLocId?: string | null;
  toLocId?: string | null;
}

/**
 * Cross-field shape rule for a movement. Expressed as one constraint rather
 * than stacked `@ValidateIf`s on each property, because class-validator ANDs
 * multiple conditions on the same property — stacking them would silently
 * disable validation instead of switching between rules.
 */
function checkShape(dto: MovementShape): string | null {
  const from = dto.fromLocId ?? null;
  const to = dto.toLocId ?? null;

  switch (dto.type) {
    case MovementType.IN:
      if (!to) return 'toLocId is required for an IN movement';
      if (from) return 'fromLocId must not be supplied for an IN movement';
      return null;
    case MovementType.OUT:
      if (!from) return 'fromLocId is required for an OUT movement';
      if (to) return 'toLocId must not be supplied for an OUT movement';
      return null;
    case MovementType.TRANSFER:
      if (!from) return 'fromLocId is required for a TRANSFER movement';
      if (!to) return 'toLocId is required for a TRANSFER movement';
      if (from === to) {
        return 'A TRANSFER must move stock between two different locations';
      }
      return null;
    default:
      // `type` itself is invalid; @IsEnum already reports that.
      return null;
  }
}

@ValidatorConstraint({ name: 'movementShape', async: false })
class MovementShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return checkShape(args.object as MovementShape) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return checkShape(args.object as MovementShape) ?? 'Invalid movement shape';
  }
}

export function IsValidMovementShape(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: MovementShapeConstraint,
    });
  };
}
