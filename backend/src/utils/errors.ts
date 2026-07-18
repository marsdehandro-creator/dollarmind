/**
 * Typed HTTP errors. The error handler maps `status` to the response code.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'error',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Invalid request') {
    super(400, message, 'validation_error');
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'unauthorized');
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message, 'forbidden');
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, message, 'conflict');
  }
}
