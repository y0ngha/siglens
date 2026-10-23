import { createRequire } from 'node:module';
import { isCacheScopeDynamicUsage } from '@/shared/lib/isCacheScopeDynamicUsage';

// 설치된 Next가 실제로 던지는 메시지로 판정한다(TESTING.md#TE-8). Next가 문구를 바꾸면
// 손으로 옮겨 적은 문자열은 그대로 초록이고 운영 로그만 다시 쌓이므로, 메시지 생성 함수를
// 직접 부른다. 16.4에서 이 문구가 바뀌어 옛 매처가 놓친 적이 있다.
const require = createRequire(import.meta.url);
const messages =
    require('next/dist/server/use-cache/use-cache-messages.js') as Record<
        string,
        (...args: string[]) => Error
    >;

const ROUTE = '/[locale]/[symbol]';

describe('isCacheScopeDynamicUsage', () => {
    it.each([
        'createCookiesInUnstableCacheError',
        'createHeadersInUnstableCacheError',
        'createConnectionInUnstableCacheError',
        'createCookiesInUseCacheError',
        'createHeadersInUseCacheError',
        'createSearchParamsInUseCacheError',
        'createConnectionInPublicUseCacheError',
    ])('Next의 %s 메시지를 캐시 스코프 제어 흐름으로 본다', name => {
        expect(isCacheScopeDynamicUsage(messages[name](ROUTE))).toBe(true);
    });

    it.each([
        'createRouteHandlerRequestInUnstableCacheError',
        'createRouteHandlerRequestInUseCacheError',
    ])('Route Handler 요청 읽기(%s)도 본다', name => {
        expect(
            isCacheScopeDynamicUsage(messages[name](ROUTE, 'request.url'))
        ).toBe(true);
    });

    // 코드를 고쳐야 하는 진짜 오류다. 제어 흐름으로 삼키면 버그가 조용히 묻힌다.
    it.each([
        [
            'createDraftModeMutationInUnstableCacheError',
            ['draftMode().enable()'],
        ],
        ['createDraftModeMutationInUseCacheError', ['draftMode().enable()']],
        ['createRevalidateInCachedFunctionError', ['revalidateTag']],
        ['createRevalidateDuringRenderError', ['revalidateTag']],
        ['createUseCachePrivateInsideUnstableCacheError', []],
        ['createConnectionInPrivateUseCacheError', []],
    ] as const)('%s는 삼키지 않는다', (name, extra) => {
        expect(isCacheScopeDynamicUsage(messages[name](ROUTE, ...extra))).toBe(
            false
        );
    });

    // 16.4에서 옛 문구("inside a function cached with")는 이 오용 오류에만 남았다.
    it('prefetch()·navigation() 오용 오류는 삼키지 않는다', () => {
        expect(
            isCacheScopeDynamicUsage(
                new Error(
                    'Route /[symbol] used `prefetch()` inside a function cached with `unstable_cache()`. ' +
                        'The `prefetch()` function is not allowed in this scope.'
                )
            )
        ).toBe(false);
    });

    it('"cache scope" 문구만 든 무관한 오류나 Error가 아닌 값은 false다', () => {
        expect(
            isCacheScopeDynamicUsage(
                new Error('Redis eviction happened in the cache scope, sorry')
            )
        ).toBe(false);
        expect(
            isCacheScopeDynamicUsage("can't be read inside `unstable_cache()`")
        ).toBe(false);
    });
});
