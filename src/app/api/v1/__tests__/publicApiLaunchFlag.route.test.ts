/**
 * 공개 API 출시 플래그가 꺼지면 `/api/v1/*` 모든 라우트가 인증·한도·DB보다 먼저 404를 돌려주는지 본다.
 * 라우트 파일을 디스크에서 전수 열거하므로 새 라우트가 `withApiErrorBoundary`를 거치지 않으면 여기서 깨진다.
 * 외부 의존(DB·Redis·core 실행기)은 목으로 바꾸고 "호출되지 않았음"을 함께 단언한다.
 */
const { authSpy, dbSpy } = vi.hoisted(() => ({
    authSpy: vi.fn(),
    dbSpy: vi.fn(),
}));
vi.mock('../authenticate', () => ({ requireApiKey: authSpy }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: dbSpy }));

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Next 라우트 핸들러가 export할 수 있는 HTTP 메서드 이름. */
const HTTP_METHODS_UNDER_TEST = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
] as const;

const V1_DIR = join(process.cwd(), 'src/app/api/v1');

function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return entry.name === '__tests__' ? [] : routeFiles(path);
        return entry.name === 'route.ts' ? [path] : [];
    });
}

const ROUTE_FILES = routeFiles(V1_DIR).toSorted();

describe('공개 API 출시 플래그 (꺼짐) - /api/v1 전수', () => {
    it('라우트 파일을 하나 이상 찾는다 (glob이 비면 아래 검사가 공허해진다)', () => {
        expect(ROUTE_FILES.length).toBeGreaterThanOrEqual(6);
    });

    describe.each(ROUTE_FILES.map(file => [file.slice(V1_DIR.length), file]))(
        '%s',
        (_name, file) => {
            beforeEach(() => {
                vi.stubEnv('PUBLIC_API_ENABLED', '');
                authSpy.mockClear();
                dbSpy.mockClear();
            });

            it('export한 모든 HTTP 메서드가 404 not_found 봉투 + no-store, 인증·DB 미접근', async () => {
                const mod = (await import(/* @vite-ignore */ file)) as Record<
                    string,
                    unknown
                >;
                const handlers = HTTP_METHODS_UNDER_TEST.filter(
                    method => typeof mod[method] === 'function'
                );
                expect(handlers.length).toBeGreaterThan(0);
                for (const method of handlers) {
                    const response = await (
                        mod[method] as (
                            request: Request,
                            context: { params: Promise<{ name: string }> }
                        ) => Promise<Response>
                    )(
                        new Request('https://siglens.io/api/v1/probe', {
                            method,
                            headers: { Authorization: 'Bearer slk_probe' },
                            body: method === 'GET' ? undefined : '{}',
                        }),
                        { params: Promise.resolve({ name: 'get_quote' }) }
                    );
                    expect(response.status).toBe(404);
                    expect(response.headers.get('Cache-Control')).toBe(
                        'no-store'
                    );
                    expect(await response.json()).toMatchObject({
                        error: { code: 'not_found' },
                    });
                }
                expect(authSpy).not.toHaveBeenCalled();
                expect(dbSpy).not.toHaveBeenCalled();
            });
        }
    );
});
