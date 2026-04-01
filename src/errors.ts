export class OstiumError extends Error {
  readonly code?: string;
  readonly suggestion?: string;

  constructor(message: string, options?: { code?: string; cause?: unknown; suggestion?: string }) {
    super(message, { cause: options?.cause });
    this.name = "OstiumError";
    this.code = options?.code;
    this.suggestion = options?.suggestion;
  }
}
