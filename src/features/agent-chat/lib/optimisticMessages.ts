import type { AgentUiMessage } from '../model/types';

// Intentional module state: a process-wide counter is the cheapest way to make
// same-millisecond client ids unique; tests match ids by pattern, not by value.
let sequence = 0;

/**
 * Id for a bubble that exists only on the client (an optimistic user message,
 * a pending assistant answer) until `done` brings the stored id. The counter
 * keeps two bubbles created in the same millisecond (a double submit, a
 * question plus its pending answer) from sharing a React key.
 */
export function localMessageId(prefix: 'local' | 'pending'): string {
    sequence += 1;
    return `${prefix}-${Date.now()}-${sequence}`;
}

/** The user's question as shown right away, before the server stores it and `meta` brings its `seq`. */
export function optimisticUserMessage(content: string): AgentUiMessage {
    return {
        id: localMessageId('local'),
        role: 'user',
        content,
        tools: [],
        status: 'complete',
    };
}
