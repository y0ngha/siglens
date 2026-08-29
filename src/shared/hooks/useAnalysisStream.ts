'use client';

import { ANALYSIS_LOCALE_HEADER, splitLocalePath } from '@/shared/i18n/locales';

/**
 * 분석 SSE 스트림 소비 헬퍼.
 *
 * 왜 서버 액션을 직접 부르지 않는가 — 서버 액션도 결국 단일 POST다. 분석은 LLM 응답을
 * 기다리는 동안 바이트를 전혀 보내지 않으므로 그 연결은 idle로 간주되고 **끊긴다**.
 *
 * 침묵 벽은 프로덕션 실측(`/api/sse-probe`)으로 두 번 쟀다:
 *   - ALB 시절(v0.50.1): **61.1초**에 HTTP/2 `INTERNAL_ERROR`. 그 60초가
 *     `HEARTBEAT_INTERVAL_MS = 25s`를 정한 근거였다.
 *   - cloudflared 전환 후(2026-08): **125.9초** — Cloudflare Proxy Read Timeout.
 *     같은 조건에서 25초 heartbeat를 흘리면 600초를 정확히 25.0초 간격으로 완주했다
 *     (이벤트 25개, 뭉침 0). `text/event-stream`은 터널에서도 버퍼링되지 않는다.
 *
 * 즉 벽은 2배 멀어졌지만 heartbeat는 그대로 둔다 — 125초는 여전히 실재하는 상한이고,
 * 25초는 비용이 없다.
 *
 * 그래서 브라우저 경로는 반드시 이 스트림을 거친다. 서버 내부 경로(크론·SSR·봇)는
 * 브라우저 연결이 없으므로 core `run*`을 그냥 `await`하면 된다.
 *
 * ⚠️ abort는 **브라우저 쪽 연결만** 끊는다. 라우트는 클라이언트의 `request.signal`을
 * core에 넘기지 않는다(의도적) — core는 같은 캐시 키의 호출자들이 `dedupeInFlight`로
 * 하나의 promise를 공유하므로, 한 명의 이탈이 SEO prewarm 크론까지 실패시킨다.
 * 자세한 근거는 `src/app/api/analysis/stream/route.ts`의 관련 주석 참고.
 * 서버 쪽 상한은 라우트의 `withDeadline`(5분)이 담당한다.
 */

/** SSE `done` 이벤트가 싣고 오는 페이로드. `result`는 use-case별 결과 객체다. */
interface StreamDonePayload<T> {
    result: T;
}

interface StreamErrorPayload {
    message: string;
}

export interface RunAnalysisStreamOptions {
    /** 어떤 분석인지 — 라우트의 디스패치 테이블 키. */
    type: string;
    /** use-case별 파라미터. 라우트가 그대로 core `run*`에 넘긴다. */
    params: Record<string, unknown>;
    signal?: AbortSignal;
    /**
     * 사용자에게 그대로 보이는 실패 문구.
     *
     * 이 모듈은 훅이 아니라 평범한 async 함수라 `useTranslations`를 쓸 수 없다.
     * 그런데 여기서 throw한 `Error.message`는 `useAnalysis` → `ChartContent`의
     * `<ErrorBanner>`에 **그대로 렌더된다** — 서버 쪽 SSE 문구를 카탈로그로
     * 옮겼는데 클라이언트 쪽만 한국어로 남아 있으면 같은 배너가 로케일에 따라
     * 반쪽만 번역된다. 호출하는 훅(컴포넌트 스코프)이 번역해 넘긴다.
     */
    messages: StreamErrorMessages;
}

export interface StreamErrorMessages {
    /** 동시 분석 상한(503). */
    readonly busy: string;
    /** 그 외 HTTP 실패. `{v0}`에 상태 코드가 들어간다. */
    readonly failed: (status: number) => string;
    /** `done`/`error` 없이 스트림이 끊긴 경우. */
    readonly disconnected: string;
    /** `done` 프레임의 payload를 파싱하지 못한 경우. */
    readonly unreadable: string;
    /** 서버가 메시지 없는 `error` 프레임을 보낸 경우. */
    readonly generic: string;
    /** 결과 payload에 에러 메시지가 없는 경우. */
    readonly unexpected: string;
    /** core의 재시도 소진 sentinel(`AI_SERVER_UNSTABLE`)에 대응하는 문구. */
    readonly unstable: string;
    /**
     * BYOK 키가 필요한 모델(`status: 'key_error'`).
     *
     * core가 문구를 만들지만 **전 로케일에 한국어**다
     * (`application/byok/messages.js`의 `USER_API_KEY_REQUIRED_MESSAGE`).
     * 코드는 정확하므로 문구만 여기서 갈아끼운다.
     */
    readonly keyRequired: string;
    /**
     * 일일 사용량 초과(`status: 'limit_error'`).
     *
     * 이쪽은 반대로 core가 **전 로케일에 영어**를 준다
     * (`application/usage/limits.js`의 `'Daily analysis usage limit exceeded.'`) —
     * 한국어 사용자에게도 영어가 나가고 있었다.
     */
    readonly limitExceeded: string;
    /** 분석할 뉴스가 없음(`code: 'no_news'`). */
    readonly noNews: string;
    /** 옵션 체인 없음(`status: 'no_chains_error'`). */
    readonly noOptionsChains: string;
    /** 그 밖의 분석 실패. */
    readonly analysisFailed: string;
    /** 원천 데이터 조회 실패(`code: 'fetch_failed'`). */
    readonly fetchFailed: string;
    /** 다이제스트 생성 불가(`miss_no_trigger`). */
    readonly digestUnavailable: string;
    /** 의회 거래 데이터 조회 실패. */
    readonly congressFetchFailed: string;
    /** 재분석 쿨다운. `{v0}`에 남은 초가 들어간다. */
    readonly reanalyzeCooldown: (seconds: number) => string;
}

/**
 * SSE 한 연결로 분석을 실행하고 최종 결과를 돌려준다.
 *
 * `heartbeat` 이벤트는 연결 유지 목적이므로 조용히 버린다. `done`이면 결과를 반환하고,
 * `error`면 서버가 준 메시지로 throw한다. 스트림이 `done`/`error` 없이 끝나면 —
 * 연결이 중간에 끊긴 경우다 — 별도 에러로 구분해 알린다.
 */
export async function runAnalysisStream<T>({
    type,
    params,
    signal,
    messages,
}: RunAnalysisStreamOptions): Promise<T> {
    const response = await fetch('/api/analysis/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            /**
             * 분석 응답을 어느 언어로 받을지 알린다.
             *
             * `/api/*`는 next-intl 미들웨어 matcher에서 제외돼 있어 서버가
             * 요청 로케일을 알 방법이 없다. 호출부마다 로케일을 프롭으로
             * 내려보내는 대신 **현재 주소에서 유도**한다 — 이 함수는 항상
             * 클라이언트에서 돌고, 주소는 로케일의 단일 소스다.
             */
            [ANALYSIS_LOCALE_HEADER]: splitLocalePath(
                typeof window === 'undefined' ? null : window.location.pathname
            ).locale,
        },
        body: JSON.stringify({ type, params }),
        signal,
    });

    if (!response.ok || response.body === null) {
        /**
         * 503은 실패가 아니라 "지금 말고 나중에"다 — 서버가 동시 분석 상한에 걸려
         * 거절한 것이고, 본문에 사용자용 한국어 메시지가 들어 있다. 상태 코드만 찍어
         * 던지면 사용자는 원인도 모르는 실패를 보고 즉시 재시도해 다시 상한에 부딪힌다.
         * (라우트가 SSE error 대신 JSON 503을 고른 이유가 바로 이 구분이다.)
         */
        if (response.status === 503) {
            const message = await response
                .json()
                .then((body: { error?: unknown }) =>
                    typeof body.error === 'string' ? body.error : null
                )
                .catch(() => null);
            throw new Error(message ?? messages.busy);
        }
        throw new Error(messages.failed(response.status));
    }

    const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

    // SSE 프레임은 청크 경계와 무관하게 도착하므로 버퍼에 모았다가 `\n\n` 단위로 자른다.
    let buffer = '';
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                const parsed = parseFrame<T>(frame, messages);
                if (parsed.kind === 'done') return parsed.result;
                if (parsed.kind === 'error') throw new Error(parsed.message);

                boundary = buffer.indexOf('\n\n');
            }
        }
    } finally {
        // 이미 완료된 스트림에서도 안전하다 — 중도 return/throw 시 소켓을 확실히 놓는다.
        reader.cancel().catch(() => {});
    }

    throw new Error(messages.disconnected);
}

type ParsedFrame<T> =
    | { kind: 'done'; result: T }
    | { kind: 'error'; message: string }
    | { kind: 'other' };

function tryParse<T>(raw: string): T | null {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function parseFrame<T>(
    frame: string,
    messages: StreamErrorMessages
): ParsedFrame<T> {
    let event = '';
    let data = '';
    for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
    }

    if (event === 'done') {
        // 프레임이 잘렸거나 프록시가 본문을 건드리면 JSON.parse가 던진다. 그대로 두면
        // 사용자에게 `Unexpected token …`이 그대로 노출된다 — 이 파일이 애써 보존하는
        // 현지화 메시지 계약과 어긋나므로 한국어 메시지로 바꿔 error로 처리한다.
        const payload = tryParse<StreamDonePayload<T>>(data);
        if (payload === null) {
            return {
                kind: 'error',
                message: messages.unreadable,
            };
        }
        return { kind: 'done', result: payload.result };
    }
    if (event === 'error') {
        const payload = tryParse<StreamErrorPayload>(data);
        return {
            kind: 'error',
            message: payload?.message ?? messages.generic,
        };
    }
    return { kind: 'other' };
}
