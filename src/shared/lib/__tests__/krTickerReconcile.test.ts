import { describe, expect, it } from 'vitest';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import {
    KR_RECONCILE_DELIST_ABORT_THRESHOLD,
    KR_RECONCILE_MIN_COUNT,
    planKrTickerReconcile,
    type KrTickerListingRow,
} from '@/shared/lib/krTickerReconcile';

/** 절대 하한을 넘기는 더미 심볼 집합 — 가드를 통과시키고 싶을 때 쓴다. */
function padSymbols(count: number, prefix = 'PAD'): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}${i}.KS`);
}

function listed(symbols: readonly string[]): KrTickerListingRow[] {
    return symbols.map(symbol => ({ symbol, delistedAt: null }));
}

describe('planKrTickerReconcile — 상폐 판정', () => {
    it('응답에서 사라진 상장 종목을 상폐 대상으로 잡는다', () => {
        const pad = padSymbols(KR_RECONCILE_MIN_COUNT);
        const plan = planKrTickerReconcile(pad, listed([...pad, 'GONE.KQ']));

        expect(plan.guardTrip).toBeNull();
        expect(plan.delist).toEqual(['GONE.KQ']);
        expect(plan.relist).toEqual([]);
    });

    it('이미 상폐로 표시된 종목이 다시 관측되면 relist한다', () => {
        const pad = padSymbols(KR_RECONCILE_MIN_COUNT);
        const plan = planKrTickerReconcile(
            [...pad, 'BACK.KS'],
            [...listed(pad), { symbol: 'BACK.KS', delistedAt: new Date() }]
        );

        expect(plan.relist).toEqual(['BACK.KS']);
        expect(plan.delist).toEqual([]);
    });

    it('이미 상폐로 표시된 종목은 다시 상폐 대상이 되지 않는다', () => {
        const pad = padSymbols(KR_RECONCILE_MIN_COUNT);
        const plan = planKrTickerReconcile(pad, [
            ...listed(pad),
            { symbol: 'OLD.KQ', delistedAt: new Date('2026-01-01') },
        ]);

        // 재실행이 상폐 시각을 밀지 않도록, 이미 표시된 행은 계획에서 빠진다.
        expect(plan.delist).toEqual([]);
    });

    it('변화가 없으면 계획이 비어 있다', () => {
        const pad = padSymbols(KR_RECONCILE_MIN_COUNT);
        const plan = planKrTickerReconcile(pad, listed(pad));

        expect(plan).toMatchObject({
            delist: [],
            relist: [],
            guardTrip: null,
            delistedPopular: [],
        });
    });
});

/**
 * 부분 응답으로 멀쩡한 종목이 대량으로 사라지는 것이 이 기능의 유일한 파괴적 실패 모드다.
 * API가 200에 빈 목록을 주거나 페이지네이션이 중간에 끊기는 일은 실제로 일어난다.
 */
describe('planKrTickerReconcile — 부분 응답 가드', () => {
    it('절대 하한 미만이면 상폐 처리를 통째로 건너뛴다', () => {
        const existing = listed(padSymbols(2_500));
        const plan = planKrTickerReconcile(
            padSymbols(KR_RECONCILE_MIN_COUNT - 1),
            existing
        );

        expect(plan.guardTrip).toContain('absolute floor');
        expect(plan.delist).toEqual([]);
    });

    it('빈 응답도 상폐 처리를 하지 않는다', () => {
        const plan = planKrTickerReconcile([], listed(padSymbols(2_500)));

        expect(plan.guardTrip).not.toBeNull();
        expect(plan.delist).toEqual([]);
    });

    it('한 번에 사라진 종목이 상한을 넘으면 건너뛴다', () => {
        const existing = listed(padSymbols(2_000));
        // 절대 하한(1,000)은 넘지만 500종목이 한꺼번에 사라졌다 — 시장 사건이 아니라 사고다.
        const plan = planKrTickerReconcile(padSymbols(1_500), existing);

        expect(plan.guardTrip).toContain('vanished in one sync');
        expect(plan.delist).toEqual([]);
    });

    it('상한 경계: 정확히 상한만큼 사라지면 통과한다', () => {
        const existing = listed(padSymbols(2_000));
        const plan = planKrTickerReconcile(
            padSymbols(2_000 - KR_RECONCILE_DELIST_ABORT_THRESHOLD),
            existing
        );

        expect(plan.guardTrip).toBeNull();
        expect(plan.delist).toHaveLength(KR_RECONCILE_DELIST_ABORT_THRESHOLD);
    });

    it('상한을 하나 넘기면 통째로 건너뛴다 — 부분 적용은 하지 않는다', () => {
        const existing = listed(padSymbols(2_000));
        const plan = planKrTickerReconcile(
            padSymbols(2_000 - KR_RECONCILE_DELIST_ABORT_THRESHOLD - 1),
            existing
        );

        expect(plan.guardTrip).not.toBeNull();
        expect(plan.delist).toEqual([]);
    });

    /**
     * 종전 가드는 "수신 건수 < 기존 상장 수 × 0.9"였다. 2,595종목 기준 그 틈은
     * **하루 259종목**이다 — 실제 상폐(0~2종목)의 두 자릿수 배라, 마지막 몇 페이지만
     * 빠지는 페이지네이션 결함이 그대로 통과했다.
     */
    it('[회귀] 5% 누락 같은 부분 응답도 잡는다 — 옛 비율 가드는 통과시켰다', () => {
        const existing = listed(padSymbols(2_000));
        const plan = planKrTickerReconcile(padSymbols(1_900), existing);

        // 1,900 / 2,000 = 0.95 → 옛 0.9 비율 가드는 통과. 지금은 100종목 소실로 잡힌다.
        expect(plan.guardTrip).toContain('vanished in one sync');
        expect(plan.delist).toEqual([]);
    });

    it('가드가 걸려도 relist는 그대로 진행한다', () => {
        // 지우는 방향만 막는다 — 되살리는 방향은 부분 응답에서도 손실이 없다.
        const plan = planKrTickerReconcile(
            ['BACK.KS'],
            [
                { symbol: 'BACK.KS', delistedAt: new Date() },
                ...listed(padSymbols(2_500)),
            ]
        );

        expect(plan.guardTrip).not.toBeNull();
        expect(plan.relist).toEqual(['BACK.KS']);
    });

    it('DB가 비어 있는 최초 실행에서는 비율 가드가 작동하지 않는다', () => {
        // 기존 상장 수가 0이면 어떤 응답도 비율 조건을 만족한다 — 절대 하한만 남는다.
        const plan = planKrTickerReconcile(
            padSymbols(KR_RECONCILE_MIN_COUNT),
            []
        );

        expect(plan.guardTrip).toBeNull();
        expect(plan.delist).toEqual([]);
    });
});

describe('planKrTickerReconcile — POPULAR_TICKERS 경고', () => {
    const KR_POPULAR = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t));

    it('하드코딩된 인기 종목이 상폐되면 따로 표시한다', () => {
        expect(KR_POPULAR.length).toBeGreaterThan(0);
        const victim = KR_POPULAR[0]!;
        const pad = padSymbols(KR_RECONCILE_MIN_COUNT);

        const plan = planKrTickerReconcile(pad, listed([...pad, victim]));

        // sitemap은 POPULAR_TICKERS를 하드코딩해 싣는다 — 사람이 목록에서 빼기 전까지
        // 404 URL이 계속 나간다. 조용히 상폐만 표시하면 아무도 모른다.
        expect(plan.delistedPopular).toEqual([victim]);
        expect(plan.delist).toContain(victim);
    });

    it('가드가 걸리면 인기 종목 경고도 나오지 않는다', () => {
        const victim = KR_POPULAR[0]!;
        const plan = planKrTickerReconcile(
            [],
            listed([...padSymbols(2_500), victim])
        );

        expect(plan.delistedPopular).toEqual([]);
    });
});

/**
 * 소실 상한이 걸린 날은 크론이 스스로 수렴하지 못한다 — 다음 날도 같은 후보가 나온다.
 * 진짜 대량 정리였다면 사람이 목록을 확인한 뒤 한 번 통과시켜야 한다.
 */
describe('planKrTickerReconcile — 대량 상폐 수동 승인', () => {
    it('allowLargeDelist면 상한을 넘겨도 상폐를 적용한다', () => {
        const existing = listed(padSymbols(2_000));
        const plan = planKrTickerReconcile(padSymbols(1_500), existing, {
            allowLargeDelist: true,
        });

        expect(plan.guardTrip).toBeNull();
        expect(plan.delist).toHaveLength(500);
    });

    it('절대 하한은 오버라이드되지 않는다 — 빈 응답으로 테이블을 비울 수 없다', () => {
        const plan = planKrTickerReconcile([], listed(padSymbols(2_500)), {
            allowLargeDelist: true,
        });

        expect(plan.guardTrip).toContain('absolute floor');
        expect(plan.delist).toEqual([]);
    });

    it('기본값은 승인 없음이다', () => {
        const existing = listed(padSymbols(2_000));
        expect(
            planKrTickerReconcile(padSymbols(1_500), existing).guardTrip
        ).not.toBeNull();
    });
});
