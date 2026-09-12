import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupConversationsByDay } from '@/features/agent-chat';

// Local-time noon so day arithmetic is unaffected by the runner's TZ offset.
const NOW = new Date(2026, 8, 12, 12, 0, 0);
const at = (daysAgo: number, hour = 9) =>
    new Date(2026, 8, 12 - daysAgo, hour).toISOString();

describe('groupConversationsByDay', () => {
    // Pin a non-zero UTC offset: on a UTC runner, local-midnight arithmetic is
    // byte-identical to a UTC implementation and the boundary test below would
    // no longer catch a `setHours` → `setUTCHours` regression. Node re-reads
    // `TZ` when `process.env.TZ` changes, so the pin is per-file and restored.
    const originalTz = process.env.TZ;
    beforeAll(() => {
        process.env.TZ = 'Asia/Seoul';
    });
    afterAll(() => {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
    });

    it('buckets by local day, omits empty groups, newest first inside a group', () => {
        const groups = groupConversationsByDay(
            [
                { id: 'w', lastMessageAt: at(3) },
                { id: 't1', lastMessageAt: at(0, 8) },
                { id: 'o', lastMessageAt: at(30) },
                { id: 't2', lastMessageAt: at(0, 11) },
                { id: 'y', lastMessageAt: at(1, 23) },
            ],
            NOW
        );
        expect(groups.map(g => g.key)).toEqual([
            'today',
            'yesterday',
            'week',
            'older',
        ]);
        expect(groups[0]!.items.map(i => i.id)).toEqual(['t2', 't1']);
        expect(groups[1]!.items.map(i => i.id)).toEqual(['y']);
        expect(groups[2]!.items.map(i => i.id)).toEqual(['w']);
        expect(groups[3]!.items.map(i => i.id)).toEqual(['o']);
    });

    it('a chat from 00:10 today is today, one from 23:50 yesterday is yesterday (local midnight, not UTC)', () => {
        const groups = groupConversationsByDay(
            [
                {
                    id: 'a',
                    lastMessageAt: new Date(2026, 8, 12, 0, 10).toISOString(),
                },
                {
                    id: 'b',
                    lastMessageAt: new Date(2026, 8, 11, 23, 50).toISOString(),
                },
            ],
            NOW
        );
        expect(groups.map(g => [g.key, g.items.map(i => i.id)])).toEqual([
            ['today', ['a']],
            ['yesterday', ['b']],
        ]);
    });

    it('six days ago is still "last 7 days"; seven days ago is older', () => {
        const groups = groupConversationsByDay(
            [
                { id: 'six', lastMessageAt: at(6, 1) },
                { id: 'seven', lastMessageAt: at(7, 23) },
            ],
            NOW
        );
        expect(groups.map(g => [g.key, g.items.map(i => i.id)])).toEqual([
            ['week', ['six']],
            ['older', ['seven']],
        ]);
    });

    it('unparseable timestamps land in older instead of throwing; empty input → no groups', () => {
        expect(
            groupConversationsByDay([{ lastMessageAt: 'nope' }], NOW)
        ).toEqual([{ key: 'older', items: [{ lastMessageAt: 'nope' }] }]);
        expect(groupConversationsByDay([], NOW)).toEqual([]);
    });
});
