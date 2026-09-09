export class FreshchatError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public fatal = false,
  ) {
    super(message);
    this.name = "FreshchatError";
  }
}

export function isFatalAuth(status?: number): boolean {
  return status === 401 || status === 403;
}
