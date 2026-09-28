import { describe, expect, it, vi } from 'vitest';
import { DrizzleSymbolViewRepository } from '@/entities/symbol-view/api';
import { symbolViewsDaily } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

describe('DrizzleSymbolViewRepository', () => {
    it('recordView는 (date, symbol) 충돌 시 views를 올리는 upsert를 건다', async () => {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        const db = { insert } as unknown as SiglensDatabase;

        await new DrizzleSymbolViewRepository(db).recordView(
            '2026-09-24',
            'AAPL'
        );

        expect(values).toHaveBeenCalledWith({
            date: '2026-09-24',
            symbol: 'AAPL',
        });
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const arg = onConflictDoUpdate.mock.calls.find(Boolean)?.[0] as {
            target: unknown[];
            set: Record<string, unknown>;
        };
        expect(arg.target).toEqual([
            symbolViewsDaily.date,
            symbolViewsDaily.symbol,
        ]);
        // 덮어쓰기(views: 1)가 아니라 SQL 증가식이어야 한다.
        expect(typeof arg.set.views).toBe('object');
    });

    it('pruneOlderThan은 삭제를 한 번 건다', async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const db = {
            delete: vi.fn(() => ({ where })),
        } as unknown as SiglensDatabase;
        await new DrizzleSymbolViewRepository(db).pruneOlderThan('2026-06-26');
        expect(where).toHaveBeenCalledTimes(1);
    });

    it('topViewed는 기간 필터 → 종목별 합계 → 임계값(HAVING) → 내림차순 체인을 탄다', async () => {
        const rows = [
            { symbol: 'NVDA', views: 9 },
            { symbol: 'AAPL', views: 4 },
        ];
        const orderBy = vi.fn().mockResolvedValue(rows);
        const having = vi.fn(() => ({ orderBy }));
        const groupBy = vi.fn(() => ({ having }));
        const where = vi.fn(() => ({ groupBy }));
        const from = vi.fn(() => ({ where }));
        const db = {
            select: vi.fn(() => ({ from })),
        } as unknown as SiglensDatabase;

        const result = await new DrizzleSymbolViewRepository(db).topViewed(
            '2026-09-17',
            3
        );

        expect(result).toEqual(rows);
        expect(groupBy).toHaveBeenCalledWith(symbolViewsDaily.symbol);
        expect(having).toHaveBeenCalledTimes(1);
    });
});
