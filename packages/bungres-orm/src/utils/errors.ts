export class BungresError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BungresError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class QueryError extends BungresError {
  public readonly sql?: string | undefined;
  public readonly params?: unknown[] | undefined;

  constructor(message: string, options?: { sql?: string; params?: unknown[]; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "QueryError";
    this.sql = options?.sql;
    this.params = options?.params;
  }
}

export class ConnectionError extends BungresError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ConnectionError";
  }
}

export class ValidationError extends BungresError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class TransactionError extends BungresError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "TransactionError";
  }
}
