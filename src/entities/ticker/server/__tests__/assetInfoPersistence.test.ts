import type { CacheProvider } from '@y0ngha/siglens-core';

const { tryGetDatabaseClientMock, repositoryMock } = vi.hoisted(() => ({
    tryGetDatabaseClientMock: vi.fn(),
    repositoryMock: { findBySymbol: vi.fn(), upsert: vi.fn() },
}));

vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => tryGetDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleAssetTranslationRepository: class {
        constructor() {
            return repositoryMock as unknown as object;
        }
    },
}));

import {
    persistOrCacheProvisional,
    readFromDatabase,
    setCacheBestEffort,
} from '../assetInfoPersistence';

function fakeCache(): { cache: CacheProvider; set: ReturnType<typeof vi.fn> } {
    const set = vi.fn().mockResolvedValue(undefined);
    return {
        set,
        cache: {
            get: vi.fn(),
            set,
            delete: vi.fn(),
        } as unknown as CacheProvider,
    };
}

const info = { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    tryGetDatabaseClientMock.mockReturnValue({ db: {} });
});

describe('readFromDatabase', () => {
    it('DB 클라이언트가 없으면 null이다', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);

        expect(await readFromDatabase('AAPL')).toBeNull();
    });

    it('행이 있으면 AssetInfo로 변환한다', async () => {
        repositoryMock.findBySymbol.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        });

        expect(await readFromDatabase('AAPL')).toEqual(info);
    });

    it('읽기 실패는 경고를 남기고 null이다', async () => {
        repositoryMock.findBySymbol.mockRejectedValue(new Error('boom'));

        expect(await readFromDatabase('AAPL')).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
            '[getAssetInfo] DB read failed',
            expect.any(Error)
        );
    });

    it('AbortError는 경고 없이 null이다', async () => {
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        repositoryMock.findBySymbol.mockRejectedValue(abort);

        expect(await readFromDatabase('AAPL')).toBeNull();
        expect(console.warn).not.toHaveBeenCalled();
    });
});

describe('persistOrCacheProvisional', () => {
    it('DB에 쓰면 Redis 임시 항목을 쓰지 않는다', async () => {
        repositoryMock.upsert.mockResolvedValue(undefined);
        const { cache, set } = fakeCache();

        await persistOrCacheProvisional(info, 'AAPL', cache);

        expect(repositoryMock.upsert).toHaveBeenCalledWith({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        });
        expect(set).not.toHaveBeenCalled();
    });

    it('DB 클라이언트가 없으면 12시간 임시 항목을 쓴다', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        const { cache, set } = fakeCache();

        await persistOrCacheProvisional(info, 'AAPL', cache);

        expect(set).toHaveBeenCalledWith(
            expect.stringContaining('AAPL'),
            info,
            12 * 60 * 60
        );
    });

    it('upsert가 실패해도 던지지 않고 임시 항목을 쓴다', async () => {
        repositoryMock.upsert.mockRejectedValue(new Error('down'));
        const { cache, set } = fakeCache();

        await expect(
            persistOrCacheProvisional(info, 'AAPL', cache)
        ).resolves.toBeUndefined();
        expect(set).toHaveBeenCalledTimes(1);
    });
});

describe('setCacheBestEffort', () => {
    it('캐시가 없으면 아무것도 하지 않는다', () => {
        expect(() => setCacheBestEffort(null, 'k', info, 1)).not.toThrow();
    });

    it('쓰기 실패는 경고만 남긴다', async () => {
        const { cache, set } = fakeCache();
        set.mockRejectedValue(new Error('redis down'));

        setCacheBestEffort(cache, 'k', info, 1);
        await Promise.resolve();
        await Promise.resolve();

        expect(console.warn).toHaveBeenCalledWith(
            '[getAssetInfo] cache write failed',
            expect.any(Error)
        );
    });
});
