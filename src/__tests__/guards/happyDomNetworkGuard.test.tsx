/**
 * happy-dom 네트워크 가드(`vitest.setup.dom.ts`)가 살아 있는지 고정한다.
 *
 * 가드가 빠지면 테스트는 **조용히** 통과한다 — happy-dom의 `navigator.sendBeacon`이
 * 전역 `fetch` 가드를 우회해 실제 요청을 보내고, 대상 서버가 없으면 그 실패는
 * fire-and-forget이라 어떤 단언에도 걸리지 않는다. 그래서 가드 자체를 단언한다.
 */
import { describe, expect, it, vi } from 'vitest';

interface FetchInterceptor {
    beforeAsyncRequest: (context: {
        request: { url: string };
    }) => Promise<unknown>;
}

function getInterceptor(): FetchInterceptor {
    const api = (
        globalThis as {
            happyDOM?: {
                settings: { fetch: { interceptor: FetchInterceptor | null } };
            };
        }
    ).happyDOM;
    const interceptor = api?.settings.fetch.interceptor;
    if (interceptor === null || interceptor === undefined) {
        throw new Error('happy-dom fetch interceptor가 설치돼 있지 않다');
    }
    return interceptor;
}

describe('happy-dom 네트워크 가드', () => {
    describe('환경', () => {
        it('dom 프로젝트의 기본 환경은 happy-dom이다', () => {
            expect('happyDOM' in globalThis).toBe(true);
        });
    });

    describe('sendBeacon', () => {
        it('jsdom과 같은 "없음" 상태로 맞춰져 있다', () => {
            expect(typeof navigator.sendBeacon).toBe('undefined');
        });
    });

    describe('happy-dom 내부 fetch 경로', () => {
        it('인터셉터는 요청 URL을 담은 가드 오류로 거부한다', async () => {
            await expect(
                getInterceptor().beforeAsyncRequest({
                    request: { url: 'http://localhost:4200/api/never' },
                })
            ).rejects.toThrow(
                /Unmocked network call from happy-dom \(http:\/\/localhost:4200\/api\/never\)/
            );
        });

        // `error`로 끝나는 것만 보면 부족하다 — 4200에 아무도 없으면 인터셉터가
        // 없어도 연결 거부로 `error`가 난다. 요청이 **인터셉터를 거쳤는지**를 본다.
        it('XMLHttpRequest는 인터셉터에서 막혀 error로 끝난다', async () => {
            const beforeAsyncRequest = vi.spyOn(
                getInterceptor(),
                'beforeAsyncRequest'
            );

            const url = 'http://localhost:4200/api/never-xhr';

            const outcome = await new Promise<string>(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.onload = () => resolve(`load:${xhr.status}`);
                xhr.onerror = () => resolve('error');
                xhr.send();
            });

            expect(outcome).toBe('error');
            // 호출 순번이 아니라 URL로 찾는다 — 다른 테스트의 늦은 요청이 섞여도 흔들리지 않는다.
            expect(
                beforeAsyncRequest.mock.calls.some(
                    ([context]) => context.request.url === url
                )
            ).toBe(true);
        });
    });

    describe('전역 fetch', () => {
        it('happy-dom 것이 아니라 base 셋업의 거부형 스텁이다', async () => {
            await expect(
                fetch('http://localhost:4200/api/never')
            ).rejects.toThrow(/Unmocked global fetch/);
        });
    });
});
