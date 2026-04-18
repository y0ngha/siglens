jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/cache/redis');
jest.mock('@/infrastructure/market/submitBriefingAction', () =>
    jest.requireActual('@/infrastructure/market/submitBriefingAction')
);

import { submitBriefingAction } from '@/infrastructure/market/submitBriefingAction';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import type { MarketSummaryData } from '@/domain/types';

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheProvider = {
    get: mockCacheGet,
    set: mockCacheSet,
    delete: jest.fn(),
};
const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockData: MarketSummaryData = {
    indices: [
        {
            symbol: 'GSPC',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: '미국 대형주 500',
            price: 5200,
            changesPercentage: 0.5,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 210,
            changesPercentage: 1.2,
        },
    ],
};

describe('submitBriefingAction 함수는', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            WORKER_URL: 'https://worker.test',
            WORKER_SECRET: 'test-secret',
        };
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
        mockCacheGet.mockResolvedValue(null);
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('캐시 히트일 때', () => {
        it('cached 상태와 함께 브리핑을 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(
                '시장이 강세를 보이고 있습니다.'
            );

            const result = await submitBriefingAction(mockData);

            expect(result.status).toBe('cached');
            if (result.status === 'cached') {
                expect(result.briefing).toBe('시장이 강세를 보이고 있습니다.');
            }
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('캐시 미스일 때', () => {
        it('submitted 상태와 jobId를 반환한다', async () => {
            const result = await submitBriefingAction(mockData);

            expect(result.status).toBe('submitted');
            if (result.status === 'submitted') {
                expect(typeof result.jobId).toBe('string');
                expect(result.jobId.length).toBeGreaterThan(0);
            }
        });

        it('worker /briefing 엔드포인트에 요청을 보낸다', async () => {
            await submitBriefingAction(mockData);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://worker.test/briefing',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-Worker-Secret': 'test-secret',
                    }),
                })
            );
        });
    });

    describe('환경변수가 없을 때', () => {
        it('WORKER_URL이 없으면 에러를 던진다', async () => {
            delete process.env.WORKER_URL;

            await expect(submitBriefingAction(mockData)).rejects.toThrow(
                'WORKER_URL and WORKER_SECRET environment variables are required'
            );
        });

        it('WORKER_SECRET이 없으면 에러를 던진다', async () => {
            delete process.env.WORKER_SECRET;

            await expect(submitBriefingAction(mockData)).rejects.toThrow(
                'WORKER_URL and WORKER_SECRET environment variables are required'
            );
        });
    });

    describe('캐시 프로바이더가 없을 때', () => {
        it('캐시 조회를 건너뛰고 submitted 상태를 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);

            const result = await submitBriefingAction(mockData);

            expect(result.status).toBe('submitted');
            expect(mockCacheGet).not.toHaveBeenCalled();
        });
    });

    describe('캐시 읽기가 실패할 때', () => {
        it('에러를 무시하고 submitted 상태를 반환한다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockCacheGet.mockRejectedValueOnce(new Error('Redis error'));

            const result = await submitBriefingAction(mockData);

            expect(result.status).toBe('submitted');
            consoleSpy.mockRestore();
        });
    });
});
