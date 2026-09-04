import { BadRequestException, ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

function flatten(errors: ValidationError[], prefix = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    const nested = flatten(error.children ?? [], field);
    return [...own, ...nested];
  });
}

/**
 * Nest's default ValidationPipe returns `message` as a string array, which the
 * Angular error interceptor would render as `[object Object]`-ish noise. This
 * collapses it to a single human-readable `message` (the contract every 400,
 * 401 and 403 in this API honours) while keeping the per-field breakdown under
 * `errors` so a form can attach a message to the control that caused it.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const fieldErrors = flatten(errors);
  const message =
    fieldErrors.map((e) => e.message).join('; ') || 'Validation failed';
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message,
    errors: fieldErrors,
  });
}
