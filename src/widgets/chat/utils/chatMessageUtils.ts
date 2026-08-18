import type { ChatMessage } from '@y0ngha/siglens-core';
import type { DisplayMessage } from '@/shared/lib/types';

export function isChatMessage(
    m: DisplayMessage
): m is ChatMessage & { uiId: string } {
    return m.role !== 'system';
}

/**
 * 렌더 전용 식별자 발급기. 세션 안에서만 유일하면 되므로 단조 증가 카운터로 충분하다
 * (localStorage에 저장되지 않고, 목록 key로만 쓰인다).
 */
let messageUiSeq = 0;

export function nextMessageUiId(): string {
    messageUiSeq += 1;
    return `m${String(messageUiSeq)}`;
}

/** localStorage에서 복원한 메시지(식별자 없음)에 렌더용 id를 부여한다. */
export function withUiIds(messages: readonly ChatMessage[]): DisplayMessage[] {
    return messages.map(message => ({ ...message, uiId: nextMessageUiId() }));
}
