import { describe, expect, it } from 'vitest';
import {
    AGENT_X_POSTS_WINDOW_DAYS,
    AGENT_X_POST_TEXT_MAX_CHARS,
} from '@/entities/x-posts/lib/xPostsConstants';
import { toXPostItems, xPostsWindowStart } from '../toXPostItems';

const NOW = new Date('2026-11-16T12:00:00Z');
const account = { handle: 'Tesla', role: 'company' as const };
const post = (
    over: Partial<{ id: string; text: string; createdAt: string }> = {}
) => ({
    id: '1900000000000000001',
    text: 'Model Y deliveries begin',
    createdAt: '2026-11-15T10:00:00.000Z',
    likes: 12,
    reposts: 3,
    ...over,
});

describe('toXPostItems', () => {
    it('출력 행 모양: 핸들·역할·링크·지표를 싣고 최신순이다', () => {
        const items = toXPostItems(
            account,
            [
                post({ id: '2', createdAt: '2026-11-10T00:00:00.000Z' }),
                post({ id: '3', createdAt: '2026-11-14T00:00:00.000Z' }),
            ],
            NOW
        );
        expect(items.map(i => i.url)).toEqual([
            'https://x.com/Tesla/status/3',
            'https://x.com/Tesla/status/2',
        ]);
        expect(items[0]).toEqual({
            handle: 'Tesla',
            role: 'company',
            postedAt: '2026-11-14T00:00:00.000Z',
            text: 'Model Y deliveries begin',
            truncated: false,
            url: 'https://x.com/Tesla/status/3',
            likes: 12,
            reposts: 3,
        });
    });

    it(`기간(${AGENT_X_POSTS_WINDOW_DAYS}일) 밖의 글은 응답에 있어도 버린다 — 경계 시각은 포함`, () => {
        const start = xPostsWindowStart(NOW).toISOString();
        expect(start).toBe('2026-11-02T12:00:00.000Z');
        const items = toXPostItems(
            account,
            [
                post({ id: '4', createdAt: start }),
                post({ id: '5', createdAt: '2026-11-02T11:59:59.000Z' }),
            ],
            NOW
        );
        expect(items.map(i => i.url)).toEqual(['https://x.com/Tesla/status/4']);
    });

    it('X의 HTML 엔티티를 풀되 &amp;lt;를 <로 두 번 풀지 않는다', () => {
        const [item] = toXPostItems(
            account,
            [post({ text: 'Q&amp;A: 1 &lt; 2 &gt; 0, literal &amp;lt;' })],
            NOW
        );
        expect(item?.text).toBe('Q&A: 1 < 2 > 0, literal &lt;');
    });

    it(`${AGENT_X_POST_TEXT_MAX_CHARS}자를 넘는 본문은 자르고 truncated, 서로게이트 쌍은 쪼개지 않는다`, () => {
        const long = 'a'.repeat(AGENT_X_POST_TEXT_MAX_CHARS - 1) + '😀tail';
        const [item] = toXPostItems(account, [post({ text: long })], NOW);
        expect(item?.truncated).toBe(true);
        expect(item?.text).toBe('a'.repeat(AGENT_X_POST_TEXT_MAX_CHARS - 1));
        const exact = 'b'.repeat(AGENT_X_POST_TEXT_MAX_CHARS);
        const [whole] = toXPostItems(account, [post({ text: exact })], NOW);
        expect(whole).toMatchObject({ text: exact, truncated: false });
    });

    it('공백뿐인 본문과 날짜를 읽을 수 없는 글은 버린다', () => {
        expect(
            toXPostItems(
                account,
                [post({ text: '   ' }), post({ createdAt: 'not-a-date' })],
                NOW
            )
        ).toEqual([]);
    });
});
