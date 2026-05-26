export class FmpHttpError extends Error {
    readonly status: number;
    readonly retryAfterSeconds: number | null;

    constructor(
        path: string,
        status: number,
        retryAfterSeconds: number | null
    ) {
        super(`FMP ${path} ${status}`);
        this.name = 'FmpHttpError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
