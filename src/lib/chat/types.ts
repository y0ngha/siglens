import type { ChatMessage } from '@y0ngha/siglens-core';

/** UI-only system message emitted on chatbot page-context switch; filtered out before LLM prompt construction. */
export interface ContextSwitchMessage {
    role: 'system';
    kind: 'context_switch';
    /** Korean label of the page the chatbot context switched to. */
    label: string;
}

/** Chat display history union — `ChatMessage` (LLM-bound) + UI-only `ContextSwitchMessage`. */
export type DisplayMessage = ChatMessage | ContextSwitchMessage;
