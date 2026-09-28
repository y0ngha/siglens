import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bucketizePosition } from '@y0ngha/siglens-core';

const mocks = vi.hoisted(() => ({
    findByUserAndSymbol: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: class {
        findByUserAndSymbol = mocks.findByUserAndSymbol;
    },
}));

import { resolveHoldingPositionBucket } from '@/entities/portfolio/lib/resolveHoldingPositionBucket';

function holding(fmpSymbol: string | null, averagePrice = '100') {
    return {
        id: 'h1',
        userId: 'user-1',
        symbol: 'AAPL',
        companyName: null,
        fmpSymbol,
        quantity: '1',
        averagePrice,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function providerAt(price: number | null) {
    return {
        getQuote: vi.fn(async () =>
            price === null ? null : ({ price } as never)
        ),
    };
}

describe('resolveHoldingPositionBucket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('free 티어나 비로그인은 DB를 읽지 않고 undefined', async () => {
        const provider = providerAt(120);
        await expect(
            resolveHoldingPositionBucket({
                userId: 'user-1',
                tier: 'free',
                symbol: 'AAPL',
                marketDataProvider: provider,
                logTag: '[t]',
            })
        ).resolves.toBeUndefined();
        await expect(
            resolveHoldingPositionBucket({
                userId: null,
                tier: 'pro',
                symbol: 'AAPL',
                marketDataProvider: provider,
                logTag: '[t]',
            })
        ).resolves.toBeUndefined();
        expect(mocks.findByUserAndSymbol).not.toHaveBeenCalled();
    });

    it('보유 행은 대문자 정규 심볼로 조회하고, 평단·현재가로 버킷을 만든다', async () => {
        mocks.findByUserAndSymbol.mockResolvedValue(holding(null, '100'));
        const bucket = await resolveHoldingPositionBucket({
            userId: 'user-1',
            tier: 'pro',
            symbol: 'aapl',
            marketDataProvider: providerAt(120),
            logTag: '[t]',
        });
        expect(mocks.findByUserAndSymbol).toHaveBeenCalledWith(
            'user-1',
            'AAPL'
        );
        expect(bucket).toBe(bucketizePosition(100, 120) ?? undefined);
        expect(bucket).toBeDefined();
    });

    it('보유가 없으면 undefined', async () => {
        mocks.findByUserAndSymbol.mockResolvedValue(null);
        await expect(
            resolveHoldingPositionBucket({
                userId: 'user-1',
                tier: 'pro',
                symbol: 'AAPL',
                marketDataProvider: providerAt(120),
                logTag: '[t]',
            })
        ).resolves.toBeUndefined();
    });

    it('시세 심볼은 호출자가 해석한 fmpSymbol → 보유 행 fmpSymbol → 심볼 순이다', async () => {
        mocks.findByUserAndSymbol.mockResolvedValue(holding('AAPL.HOLD'));
        const p1 = providerAt(120);
        await resolveHoldingPositionBucket({
            userId: 'user-1',
            tier: 'pro',
            symbol: 'AAPL',
            quoteSymbol: 'AAPL.RESOLVED',
            marketDataProvider: p1,
            logTag: '[t]',
        });
        expect(p1.getQuote).toHaveBeenCalledWith('AAPL.RESOLVED');

        const p2 = providerAt(120);
        await resolveHoldingPositionBucket({
            userId: 'user-1',
            tier: 'pro',
            symbol: 'AAPL',
            marketDataProvider: p2,
            logTag: '[t]',
        });
        expect(p2.getQuote).toHaveBeenCalledWith('AAPL.HOLD');

        mocks.findByUserAndSymbol.mockResolvedValue(holding(null));
        const p3 = providerAt(120);
        await resolveHoldingPositionBucket({
            userId: 'user-1',
            tier: 'pro',
            symbol: 'AAPL',
            marketDataProvider: p3,
            logTag: '[t]',
        });
        expect(p3.getQuote).toHaveBeenCalledWith('AAPL');
    });

    it('DB 실패는 undefined로 degrade하고 raw 에러 메시지를 로그에 남기지 않는다', async () => {
        mocks.findByUserAndSymbol.mockRejectedValue(
            Object.assign(new Error('Failed query: params: user-1,AAPL'), {
                name: 'DrizzleQueryError',
            })
        );
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            await expect(
                resolveHoldingPositionBucket({
                    userId: 'user-1',
                    tier: 'pro',
                    symbol: 'AAPL',
                    marketDataProvider: providerAt(120),
                    logTag: '[t]',
                })
            ).resolves.toBeUndefined();
            expect(errorSpy).toHaveBeenCalledWith('[t]', {
                name: 'DrizzleQueryError',
                code: undefined,
            });
        } finally {
            errorSpy.mockRestore();
        }
    });
});
