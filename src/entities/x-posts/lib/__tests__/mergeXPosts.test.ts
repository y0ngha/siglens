import { describe, expect, it } from 'vitest';
import type { XPostItem } from '../../model';
import { mergeXPosts } from '../mergeXPosts';

const item = (handle: string, day: number): XPostItem => ({
    handle,
    role: handle === 'ceo' ? 'ceo' : 'company',
    postedAt: `2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`,
    text: `${handle} ${day}`,
    truncated: false,
    url: `https://x.com/${handle}/status/${day}`,
    likes: 0,
    reposts: 0,
});
const days = (handle: string, from: number, to: number) =>
    Array.from({ length: from - to + 1 }, (_, i) => item(handle, from - i));

describe('mergeXPosts', () => {
    it('글이 잦은 계정이 다른 계정을 밀어내지 않는다: 계정마다 max/계정 수건을 보장한다', () => {
        // CEO는 최근 10일 동안 매일, 회사는 그보다 전에만 올렸다.
        const merged = mergeXPosts(
            [days('ceo', 15, 6), days('company', 5, 1)],
            6
        );
        expect(merged.filter(p => p.handle === 'company')).toHaveLength(3);
        expect(merged.filter(p => p.handle === 'ceo')).toHaveLength(3);
        expect(merged.map(p => p.postedAt)).toEqual(
            merged
                .map(p => p.postedAt)
                .toSorted()
                .toReversed()
        );
    });

    it('보장분을 못 채운 계정의 자리는 다른 계정의 최신 글로 채운다', () => {
        const merged = mergeXPosts(
            [days('ceo', 15, 6), [item('company', 1)]],
            6
        );
        expect(merged).toHaveLength(6);
        expect(merged.filter(p => p.handle === 'ceo').map(p => p.text)).toEqual(
            ['ceo 15', 'ceo 14', 'ceo 13', 'ceo 12', 'ceo 11']
        );
    });

    it('글이 없는 계정은 몫을 차지하지 않고, 합쳐서 max 이하면 전부 싣는다', () => {
        expect(mergeXPosts([[], days('company', 3, 1)], 12)).toHaveLength(3);
        expect(mergeXPosts([[], []], 12)).toEqual([]);
    });
});
