import { ChatSkeleton } from '@/widgets/agent-chat';

/**
 * Kept (unlike the parent `[locale]` route): conversations are
 * private/noindex, so there is no crawler-visibility concern here, and a
 * skeleton while switching conversations is an accepted UX (user decision
 * 2026-09-14).
 */
export default function Loading() {
    return <ChatSkeleton />;
}
