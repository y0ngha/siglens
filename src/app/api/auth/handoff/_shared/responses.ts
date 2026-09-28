import { constants } from 'node:http2';
import 'server-only';
import { NextResponse } from 'next/server';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FOUND } = constants;

/**
 * 핸드오프 라우트가 잘못된 호스트(또는 파라미터)로 불렸을 때의 응답.
 *
 * 핸드오프 라우트 네 개는 각각 main 또는 ai 호스트에서만 의미가 있다. 다른 쪽에서
 * 불리면 이유를 드러내지 않고 같은 400을 돌려준다. 1회용 코드·세션이 얽힌 응답이라
 * 어떤 캐시에도 남지 않게 `no-store`를 붙인다.
 */
export function invalidHandoffRequest(): NextResponse {
    return NextResponse.json(
        { error: 'invalid_request' },
        {
            status: HTTP_STATUS_BAD_REQUEST,
            headers: { 'Cache-Control': 'no-store' },
        }
    );
}

/**
 * 캐시되지 않는 302. 핸드오프 리다이렉트는 사용자·1회용 코드별로 목적지가 달라서
 * 엣지가 한 번이라도 저장하면 다른 사용자에게 남의 코드가 실린 Location이 나간다.
 *
 * `url`은 호출부가 로케일을 실어 만든다 — 같은 사이트 목적지는 전부 `localePath`
 * (`aiSignedOutUrl`·`handoffStartUrl`·`resolveHandoffNext`가 내부에서 쓴다)를
 * 거친다(noRawRedirect 가드, `shared/i18n/__tests__/noRawRedirect.test.ts`).
 */
export function noStoreRedirect(url: URL): NextResponse {
    const response = NextResponse.redirect(url, HTTP_STATUS_FOUND);
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
