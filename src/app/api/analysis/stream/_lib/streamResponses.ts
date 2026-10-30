import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import { buildGateError } from '@/shared/lib/byokGate';
import { heartbeatStream } from '@/shared/lib/sse/heartbeatStream';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import type { AnalysisGateErrorCode } from '@/shared/lib/types';

/**
 * 스트림 응답 헤더.
 *
 * `no-transform`은 CF/nginx가 본문을 버퍼링·변형하지 않게 한다. **오리진 자신에게도** 걸린다:
 * `next.config.ts`가 `compress: true`라 Next의 압축 미들웨어가 응답에 붙는데, 그 미들웨어는
 * `no-transform`을 보면 빠진다. 이 지시어를 빼면 SSE가 gzip 스트림에 들어가 청크가
 * 버퍼링되고 실시간성이 사라진다 — CF 설정을 정리하다 무심코 지우기 쉬운 자리다.
 *
 * `X-Accel-Buffering: no`는 nginx 계열 중간자의 응답 버퍼링을 끈다. cloudflared는
 * `text/event-stream`을 버퍼링하지 않지만(600초 probe가 정확히 25.0초 간격으로 도착)
 * 비용이 없고 다른 중간자에는 여전히 유효하다.
 */
export const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
};

/** 이 라우트가 쓰는 `app.api.stream` 카탈로그 키. */
export type StreamMessageKey = 'generic' | 'busy' | 'timeout';

/** 요청 로케일로 고정된 `app.api.stream` 번역기. */
export type StreamTranslator = (key: StreamMessageKey) => string;

/**
 * 사용자 화면에 그대로 렌더되는 에러 문구의 번역기.
 *
 * `heartbeatStream`이 거절을 SSE `error` 이벤트의 `{ message }`로 실어 보내고,
 * `useAnalysis` → `ChartContent`의 `<ErrorBanner>`가 그걸 그대로 띄운다. 즉 서버 로그
 * 문구가 아니라 UI 카피라서 카탈로그(`app.api.stream`)를 거친다 — 한글 리터럴 재발은
 * `noRawUserFacingApiStrings` 테스트가 막는다. `/api/*`는 next-intl matcher 밖이라
 * 로케일을 호출자가 넘겨야 한다.
 */
export async function streamMessages(
    locale: Locale
): Promise<StreamTranslator> {
    return getTranslations({ locale, namespace: 'app.api.stream' });
}

/**
 * BYOK/tier 게이트 거부 문구를 요청 로케일로 만든다.
 *
 * `buildGateError`의 `message`는 한국어 리터럴이라 SSE `error` 이벤트로 그대로 나가면
 * 다른 로케일 사용자에게도 한국어가 보인다. 코드(`tier_premium_blocked` 등)가 단일
 * 출처이므로 코드로 카탈로그를 조회한다. 원본 `message`는 서버 로그용으로 남는다.
 */
export async function gateMessage(
    locale: Locale,
    code: AnalysisGateErrorCode
): Promise<string> {
    const t = await getTranslations({
        locale,
        namespace: 'shared.lib.byokGate',
    });
    return t(code);
}

/**
 * 동시 분석 상한 거절. SSE `error`로 흘리면 클라이언트가 "분석 실패"로 표시하지만,
 * 이건 실패가 아니라 "지금 말고 나중에"라서 `Retry-After`를 단 JSON 503이다.
 */
export function busyResponse(t: StreamTranslator): Response {
    return Response.json(
        { error: t('busy') },
        { status: 503, headers: { 'Retry-After': '30' } }
    );
}

/**
 * 예기치 못한 예외의 500 본문. 내부 오류 상세는 싣지 않고 코드 sentinel만 낸다.
 *
 * `error`는 `...await buildGateError(...)` 스프레드가 아니라 명시적으로 넣는다 —
 * 스프레드에 Promise를 넣으면 런타임에 `{}`가 되어 `code`가 조용히 사라진다(타입체크는 통과한다).
 */
export async function unexpectedErrorResponse(
    locale: Locale
): Promise<Response> {
    return Response.json(
        {
            status: 'error',
            error: await buildGateError('unexpected_error', locale),
        },
        { status: 500 }
    );
}

/** `work`를 heartbeat가 붙은 SSE 응답으로 감싼다. 거절은 `genericErrorMessage`로 가려 내부 상세를 싣지 않는다. */
export function sseResponse<T>(
    work: Promise<T>,
    genericErrorMessage: string
): Response {
    return new Response(heartbeatStream(work, { genericErrorMessage }), {
        headers: SSE_HEADERS,
    });
}

/**
 * 게이트 거부를 SSE `error` 이벤트로 흘린다. 403 HTTP로 돌려주면 `runAnalysisStream`이 게이트 문구
 * 대신 일반 "분석 요청이 실패했습니다 (403)"를 던진다.
 *
 * 거부는 **가용성 장애가 아니다**(사용자가 허용되지 않은 모델을 고른 정상 동작). `[analysis-stream] failed`
 * 알람이 이걸 세면 프리티어 사용자 몇 명이 프리미엄 모델을 눌렀다는 이유로 페이지가 울린다. 그 알람은
 * SSE가 항상 200이라 진짜 분석 장애를 잡는 **유일한** 신호이므로 `gate-denied`로 따로 로깅하고
 * `logFailures: false`로 둔다. 게이트 문구는 사용자에게 보여줄 목적으로 만든 것이라 그대로 통과해야 한다.
 */
export async function gateDeniedResponse(
    locale: Locale,
    code: AnalysisGateErrorCode,
    genericErrorMessage: string
): Promise<Response> {
    console.warn('[analysis-stream] gate-denied:', code);
    const message = await gateMessage(locale, code);
    return new Response(
        heartbeatStream(Promise.reject(new LocalizedStreamError(message)), {
            logFailures: false,
            genericErrorMessage,
        }),
        { headers: SSE_HEADERS }
    );
}
