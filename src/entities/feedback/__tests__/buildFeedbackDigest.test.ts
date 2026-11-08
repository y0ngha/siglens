import { buildFeedbackDigest } from '../lib/buildFeedbackDigest';
import type { FeedbackDigestRow } from '../lib/types';

function row(partial: Partial<FeedbackDigestRow>): FeedbackDigestRow {
    return {
        surface: 'siglens',
        vote: 'up',
        reasons: null,
        comment: null,
        targetType: 'technical',
        symbol: 'AAPL',
        createdAt: new Date('2026-11-08T00:00:00Z'),
        ...partial,
    };
}

describe('buildFeedbackDigest', () => {
    it('빈 입력은 0 으로 채운 요약이다', () => {
        expect(buildFeedbackDigest([])).toEqual({
            total: 0,
            up: 0,
            down: 0,
            groups: [],
            downs: [],
            omittedDowns: 0,
        });
    });

    it('표면·종류별 👍/👎 를 센다', () => {
        const digest = buildFeedbackDigest([
            row({ vote: 'up' }),
            row({ vote: 'up' }),
            row({ vote: 'down' }),
            row({
                surface: 'siglens_ai',
                targetType: 'agent_message',
                vote: 'down',
            }),
        ]);
        expect(digest).toMatchObject({ total: 4, up: 2, down: 2 });
        expect(digest.groups).toContainEqual({
            surface: 'siglens',
            target: 'technical',
            up: 2,
            down: 1,
        });
        expect(digest.groups).toContainEqual({
            surface: 'siglens_ai',
            target: 'agent_message',
            up: 0,
            down: 1,
        });
    });

    it('그룹은 👎 많은 순으로 정렬한다', () => {
        const digest = buildFeedbackDigest([
            row({ targetType: 'news', vote: 'down' }),
            row({ targetType: 'overall', vote: 'down' }),
            row({ targetType: 'overall', vote: 'down' }),
        ]);
        expect(digest.groups.map(g => g.target)).toEqual(['overall', 'news']);
    });

    it('up/down 이 아닌 투표는 집계에서 뺀다', () => {
        const digest = buildFeedbackDigest([
            row({ vote: null }),
            row({ vote: 'x' }),
        ]);
        expect(digest.total).toBe(0);
    });

    it('targetType 이 없으면 unknown 으로 묶는다', () => {
        const digest = buildFeedbackDigest([row({ targetType: null })]);
        expect(digest.groups[0]?.target).toBe('unknown');
    });

    it('👎 항목에 알려진 사유 코드만 싣는다', () => {
        const digest = buildFeedbackDigest([
            row({
                vote: 'down',
                reasons: ['inaccurate', 'bogus', 3],
                comment: '틀림',
            }),
        ]);
        expect(digest.downs[0]).toEqual({
            surface: 'siglens',
            target: 'technical',
            symbol: 'AAPL',
            reasons: ['inaccurate'],
            comment: '틀림',
        });
    });

    it('reasons 가 배열이 아니면 빈 배열로 본다', () => {
        const digest = buildFeedbackDigest([
            row({ vote: 'down', reasons: 'x' }),
        ]);
        expect(digest.downs[0]?.reasons).toEqual([]);
    });

    it('👎 목록은 50건으로 자르고 나머지 수를 알린다', () => {
        const rows = Array.from({ length: 60 }, (_, i) =>
            row({ vote: 'down', comment: `c${i}` })
        );
        const digest = buildFeedbackDigest(rows);
        expect(digest.down).toBe(60);
        expect(digest.downs).toHaveLength(50);
        expect(digest.downs[0]?.comment).toBe('c0');
        expect(digest.omittedDowns).toBe(10);
    });
});
