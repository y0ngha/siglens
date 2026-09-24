import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const topViewed = vi.fn();
const findAll = vi.fn();
const selectFrom = vi.fn();
const getDatabaseClient = vi.fn();

vi.mock('@/entities/symbol-view/api', () => ({
    DrizzleSymbolViewRepository: class {
        topViewed = topViewed;
    },
}));

vi.mock('@/entities/ticker/api', () => ({
    DrizzleKoreanTickerRepository: class {
        findAll = findAll;
    },
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => getDatabaseClient(),
}));

import { loadVisitSources } from '../visitSources';
import { MIN_WEEKLY_VIEWS } from '../visitCandidates';

/** 2026-09-24 12:00 KST. */
const NOW = new Date('2026-09-24T03:00:00Z');

describe('loadVisitSources', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDatabaseClient.mockReturnValue({
            db: { select: () => ({ from: selectFrom }) },
        });
        topViewed.mockResolvedValue([{ symbol: 'NVDA', views: 9 }]);
        findAll.mockResolvedValue([
            { symbol: '005930.KS', koreanName: '삼성전자' },
            { symbol: '000660.KS', koreanName: 'SK하이닉스' },
        ]);
        selectFrom.mockResolvedValue([
            { symbol: 'BTCUSD' },
            { symbol: 'ETHUSD' },
        ]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('최근 7일 합계를 임계값으로 조회하고 KR 이름·크립토 심볼을 묶어 돌려준다', async () => {
        const result = await loadVisitSources(NOW);

        expect(topViewed).toHaveBeenCalledWith('2026-09-17', MIN_WEEKLY_VIEWS);
        expect(result).not.toBeNull();
        expect(result?.tallies).toEqual([{ symbol: 'NVDA', views: 9 }]);
        expect(result?.krNames.get('005930.KS')).toBe('삼성전자');
        expect(result?.krNames.size).toBe(2);
        expect([...(result?.cryptoSymbols ?? [])]).toEqual([
            'BTCUSD',
            'ETHUSD',
        ]);
    });

    it('조회 하나라도 실패하면 경고만 남기고 null — 스크립트 주 기능은 계속된다', async () => {
        topViewed.mockRejectedValue(
            new Error('relation "symbol_views_daily" does not exist')
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(loadVisitSources(NOW)).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('symbol_views_daily')
        );
    });

    it('DB 클라이언트 생성이 던져도(DATABASE_URL 부재) null', async () => {
        getDatabaseClient.mockImplementation(() => {
            throw new Error('DATABASE_URL is not set');
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(loadVisitSources(NOW)).resolves.toBeNull();
        expect(topViewed).not.toHaveBeenCalled();
    });
});
