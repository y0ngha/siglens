/** SSE `error` frame — an `AgentErrorCode` the turn itself reported after it started. */
export class TurnFrameError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

/** Non-2xx HTTP response — the JSON `{ error }` body the route sent before any turn started. */
export class HttpError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}
