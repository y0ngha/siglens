import { selectUnanalyzed } from '../../lib/selectUnanalyzed';

/** `selectUnanalyzed`가 읽는 두 필드만 갖춘 최소 형상. */
const item = (id: string, publishedAt: string) =>
    ({ id, publishedAt }) as unknown as Parameters<
        typeof selectUnanalyzed
    >[0][number];

describe('selectUnanalyzed 함수는', () => {
    /**
     * `fresh`는 조회 창 **전체**라 이 필터가 없으면 이미 라벨이 달린 기사를 매번
     * 다시 LLM에 태운다 — 프로덕션 실측으로 잡은 결함(신규 0건인데 17건 재분석).
     */
    it('이미 보강된 기사를 뺀다', () => {
        const fresh = [
            item('old', '2026-09-01T00:00:00Z'),
            item('new', '2026-09-02T00:00:00Z'),
        ];
        const rows = [
            { id: 'old', analyzedAt: new Date() },
            { id: 'new', analyzedAt: null },
        ];

        expect(selectUnanalyzed(fresh, rows).map(i => i.id)).toEqual(['new']);
    });

    /**
     * `ingestNewsForSymbol`은 과반 미만의 upsert 실패를 삼키므로 `fresh`에는
     * 있지만 DB에 없는 항목이 남을 수 있다. 분석하면 존재하지 않는 id에 no-op
     * update를 날려 LLM 비용만 쓴다.
     */
    it('DB에 없는 기사를 뺀다', () => {
        const fresh = [
            item('missing', '2026-09-02T00:00:00Z'),
            item('present', '2026-09-01T00:00:00Z'),
        ];
        const rows = [{ id: 'present', analyzedAt: null }];

        expect(selectUnanalyzed(fresh, rows).map(i => i.id)).toEqual([
            'present',
        ]);
    });

    /** 호출부가 상한으로 자를 때 잘리는 쪽이 오래된 기사가 되도록. */
    it('최신순으로 정렬해 돌려준다', () => {
        const fresh = [
            item('mid', '2026-09-02T00:00:00Z'),
            item('newest', '2026-09-03T00:00:00Z'),
            item('oldest', '2026-09-01T00:00:00Z'),
        ];
        const rows = fresh.map(f => ({ id: f.id, analyzedAt: null }));

        expect(selectUnanalyzed(fresh, rows).map(i => i.id)).toEqual([
            'newest',
            'mid',
            'oldest',
        ]);
    });

    it('보강할 게 없으면 빈 배열', () => {
        const fresh = [item('a', '2026-09-01T00:00:00Z')];
        const rows = [{ id: 'a', analyzedAt: new Date() }];

        expect(selectUnanalyzed(fresh, rows)).toEqual([]);
    });
});
