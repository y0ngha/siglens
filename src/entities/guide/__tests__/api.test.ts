vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const { selectMock, getDatabaseClientMock, isOfflineBuildMock } = vi.hoisted(
    () => ({
        selectMock: vi.fn(),
        getDatabaseClientMock: vi.fn(),
        isOfflineBuildMock: vi.fn(),
    })
);

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: getDatabaseClientMock,
}));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: isOfflineBuildMock,
}));
// React `cache`는 렌더 스코프 밖에서 메모이즈하지 않아, 호출마다 조회가 실행된다.
// `unstable_cache`는 Next 요청 스코프 밖에서 쓸 수 없다 — 데이터 캐시의 JSON 저장만 흉내 내
// 통과시키고, 키·옵션은 단언용으로 남긴다.
const { unstableCacheCalls } = vi.hoisted(() => ({
    unstableCacheCalls: [] as { keyParts: unknown; options: unknown }[],
}));
vi.mock('next/cache', () => ({
    unstable_cache:
        <T>(fn: () => Promise<T>, keyParts: unknown, options: unknown) =>
        async (): Promise<T> => {
            unstableCacheCalls.push({ keyParts, options });
            return JSON.parse(JSON.stringify(await fn())) as T;
        },
}));

import { loadGuideCatalog } from '@/entities/guide/api';

/** `.select().from().innerJoin().where()` 체인의 끝에서 rows를 돌려준다. */
function dbReturning(result: Promise<unknown>) {
    const where = vi.fn(() => result);
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    selectMock.mockReturnValue({ from });
    return { where };
}

function dbRow(locale: string) {
    return {
        slug: 'rsi',
        category: 'indicators',
        sortOrder: 270,
        related: [],
        locale,
        title: `RSI-${locale}`,
        aliases: [],
        summary: '요약',
        seoTitle: 't',
        seoDescription: 'd',
        demoCaption: null,
        bodyMd: '본문',
        faq: [],
        entryUpdatedAt: new Date('2026-10-01T00:00:00Z'),
        contentUpdatedAt: new Date('2026-10-01T00:00:00Z'),
    };
}

describe('loadGuideCatalog', () => {
    beforeEach(() => {
        selectMock.mockReset();
        isOfflineBuildMock.mockReturnValue(false);
        getDatabaseClientMock.mockReturnValue({
            db: { select: selectMock },
        });
    });

    it('오프라인 빌드에서는 DB에 닿지 않고 null이다', async () => {
        isOfflineBuildMock.mockReturnValue(true);

        await expect(loadGuideCatalog('ko')).resolves.toBeNull();
        expect(getDatabaseClientMock).not.toHaveBeenCalled();
    });

    it('요청 로케일 행으로 카탈로그를 만든다', async () => {
        dbReturning(Promise.resolve([dbRow('ko'), dbRow('en')]));

        const catalog = await loadGuideCatalog('en');

        expect(catalog?.entries[0]).toMatchObject({
            slug: 'rsi',
            title: 'RSI-en',
            isFallback: false,
        });
    });

    it('조회를 로케일·릴리스별 키와 guide 태그로 unstable_cache 안에서 하고 TTL은 하루다', async () => {
        dbReturning(Promise.resolve([dbRow('en')]));
        unstableCacheCalls.length = 0;

        await loadGuideCatalog('en');

        expect(unstableCacheCalls).toEqual([
            {
                keyParts: ['guide', 'catalog', 'en', process.env.GIT_SHA ?? ''],
                options: { revalidate: 86400, tags: ['guide'] },
            },
        ]);
    });

    it('번역이 없으면 ko 행으로 폴백한다', async () => {
        dbReturning(Promise.resolve([dbRow('ko')]));

        const catalog = await loadGuideCatalog('ja');

        expect(catalog?.entries[0]).toMatchObject({
            title: 'RSI-ko',
            isFallback: true,
        });
    });

    it('항목이 하나도 없으면 null이다', async () => {
        dbReturning(Promise.resolve([]));

        await expect(loadGuideCatalog('ko')).resolves.toBeNull();
    });

    it('테이블이 없는 등 조회가 실패하면 로그를 남기고 null이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        onTestFinished(() => error.mockRestore());
        dbReturning(
            Promise.reject(new Error('relation "guide_entries" does not exist'))
        );

        await expect(loadGuideCatalog('ko')).resolves.toBeNull();
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('[guide]'),
            expect.any(Error)
        );
    });
});
