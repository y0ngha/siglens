import type { ChatMessage } from '@y0ngha/siglens-core';
import type { DisplayMessage } from '@/shared/lib/types';

export function isChatMessage(m: DisplayMessage): m is ChatMessage {
    return m.role !== 'system';
}
