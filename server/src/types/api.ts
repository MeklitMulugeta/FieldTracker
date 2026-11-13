export interface HealthCheckResponse {
  success: true;
  message: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
