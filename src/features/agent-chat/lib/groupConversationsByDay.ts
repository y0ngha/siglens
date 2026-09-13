export type ConversationGroupKey = 'today' | 'yesterday' | 'week' | 'older';

export interface ConversationGroup<T> {
    readonly key: ConversationGroupKey;
    readonly items: readonly T[];
}

const DAY_MS = 86_400_000;

/**
 * Buckets a conversation list into Today / Yesterday / Last 7 days / Older,
 * the grouping chat products use in their history rail. Day boundaries are
 * the viewer's local midnight (`setHours(0)`), not UTC — a chat from 23:30
 * last night must read as "yesterday" wherever the user is. Empty groups are
 * omitted; items keep newest-first order within a group.
 */
export function groupConversationsByDay<T extends { lastMessageAt: string }>(
    items: readonly T[],
    now: Date = new Date()
): ConversationGroup<T>[] {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    const yesterday = today - DAY_MS;
    const weekAgo = today - 6 * DAY_MS;
    const keyFor = (item: T): ConversationGroupKey => {
        const at = Date.parse(item.lastMessageAt);
        if (Number.isNaN(at) || at < weekAgo) return 'older';
        if (at >= today) return 'today';
        if (at >= yesterday) return 'yesterday';
        return 'week';
    };
    const empty: Record<ConversationGroupKey, readonly T[]> = {
        today: [],
        yesterday: [],
        week: [],
        older: [],
    };
    const buckets = items
        .toSorted(
            (a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)
        )
        .reduce((acc, item) => {
            const key = keyFor(item);
            return { ...acc, [key]: [...acc[key], item] };
        }, empty);
    return (['today', 'yesterday', 'week', 'older'] as const)
        .filter(key => buckets[key].length > 0)
        .map(key => ({ key, items: buckets[key] }));
}
