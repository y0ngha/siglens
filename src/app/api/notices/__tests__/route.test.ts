import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: vi.fn(),
}));

import { GET } from '../route';
import { __resetActiveNoticesMemoForTests } from '@/entities/notice/lib/activeNoticesMemo';
import { tryGetDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';

const mockedTryGet = vi.mocked(tryGetDatabaseClient);

function dbReturning(rows: unknown[]): SiglensDatabase {
    const builder = {
        from: () => builder,
        where: () => ({ orderBy: () => Promise.resolve(rows) }),
    };
    return { select: () => builder } as unknown as SiglensDatabase;
}

const ROW = {
    id: 'n1',
    title: '점검',
    body: 'b',
    linkUrl: null,
    linkLabel: null,
    pathPattern: null,
    createdAt: new Date('2026-06-03T00:00:00+09:00'),
};

function request(query = ''): Request {
    return new Request(`https://siglens.io/api/notices${query}`);
}

describe('GET /api/notices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 로케일별 60초 메모가 케이스 사이에 남지 않게 한다.
        __resetActiveNoticesMemoForTests();
    });

    it('활성 공지를 JSON으로 내고 createdAt은 ISO 문자열이다', async () => {
        mockedTryGet.mockReturnValue({
            db: dbReturning([ROW]),
            sql: {} as never,
        });
        const res = await GET(request('?locale=ko'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({ id: 'n1', title: '점검' });
        expect(body[0].createdAt).toBe(ROW.createdAt.toISOString());
    });

    it('CDN이 공유 캐시할 수 있게 s-maxage와 stale-while-revalidate를 단다', async () => {
        mockedTryGet.mockReturnValue({
            db: dbReturning([ROW]),
            sql: {} as never,
        });
        const res = await GET(request('?locale=en'));
        const cacheControl = res.headers.get('Cache-Control') ?? '';
        expect(cacheControl).toContain('public');
        expect(cacheControl).toContain('s-maxage=60');
        expect(cacheControl).toContain('stale-while-revalidate=');
        expect(cacheControl).not.toContain('private');
    });

    it('DB 클라이언트가 없으면 빈 배열이고 캐시하지 않는다', async () => {
        mockedTryGet.mockReturnValue(null);
        const res = await GET(request());
        expect(await res.json()).toEqual([]);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('조회 중 예외는 빈 배열로 흡수하고 캐시하지 않는다', async () => {
        const throwingDb = {
            select: () => {
                throw new Error('db down');
            },
        } as unknown as SiglensDatabase;
        mockedTryGet.mockReturnValue({ db: throwingDb, sql: {} as never });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await GET(request('?locale=ko'));
        expect(await res.json()).toEqual([]);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining('[api/notices]'),
            expect.any(Error)
        );
        errSpy.mockRestore();
    });

    it('알 수 없는 locale 값에도 200으로 답한다(기본 로케일로 폴백)', async () => {
        mockedTryGet.mockReturnValue({
            db: dbReturning([]),
            sql: {} as never,
        });
        const res = await GET(request('?locale=xx'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    describe('로케일별 60초 메모', () => {
        function countingDb(rows: unknown[]) {
            const select = vi.fn(() => {
                const builder = {
                    from: () => builder,
                    where: () => ({ orderBy: () => Promise.resolve(rows) }),
                };
                return builder;
            });
            return { db: { select } as unknown as SiglensDatabase, select };
        }

        afterEach(() => {
            vi.useRealTimers();
        });

        it('같은 로케일은 60초 안에 DB를 다시 조회하지 않는다', async () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-10-06T00:00:00Z'));
            const { db, select } = countingDb([ROW]);
            mockedTryGet.mockReturnValue({ db, sql: {} as never });

            await GET(request('?locale=ko'));
            const second = await GET(request('?locale=ko'));
            expect(select).toHaveBeenCalledTimes(1);
            expect(await second.json()).toHaveLength(1);
            expect(second.headers.get('Cache-Control')).toContain(
                's-maxage=60'
            );

            vi.setSystemTime(new Date('2026-10-06T00:01:00Z'));
            await GET(request('?locale=ko'));
            expect(select).toHaveBeenCalledTimes(2);
        });

        it('로케일마다 따로 메모한다(번역이 섞이지 않게)', async () => {
            const { db, select } = countingDb([ROW]);
            mockedTryGet.mockReturnValue({ db, sql: {} as never });

            await GET(request('?locale=ko'));
            await GET(request('?locale=en'));
            await GET(request('?locale=en'));
            expect(select).toHaveBeenCalledTimes(2);
        });

        it('조회 실패는 메모하지 않는다 — 다음 요청이 다시 조회한다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockedTryGet.mockReturnValueOnce({
                db: {
                    select: () => {
                        throw new Error('db down');
                    },
                } as unknown as SiglensDatabase,
                sql: {} as never,
            });
            await GET(request('?locale=ko'));

            const { db, select } = countingDb([ROW]);
            mockedTryGet.mockReturnValue({ db, sql: {} as never });
            const res = await GET(request('?locale=ko'));
            expect(select).toHaveBeenCalledTimes(1);
            expect(await res.json()).toHaveLength(1);
            errSpy.mockRestore();
        });
    });
});
