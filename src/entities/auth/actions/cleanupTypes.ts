/** Result of {@link cleanupExpiredSessionsAction}. */
export interface CleanupExpiredSessionsResult {
    /** Number of session rows actually deleted. */
    deleted: number;
}

/** Thrown when the action is invoked without a valid CRON_SECRET bearer. */
export class CleanupUnauthorizedError extends Error {
    constructor() {
        super('cleanup_unauthorized');
        this.name = 'CleanupUnauthorizedError';
    }
}
