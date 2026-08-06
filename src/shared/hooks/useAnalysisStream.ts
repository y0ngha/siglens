'use client';

/**
 * 분석 SSE 스트림 소비 헬퍼.
 *
 * 왜 서버 액션을 직접 부르지 않는가 — 서버 액션도 결국 단일 POST다. 분석은 LLM 응답을
 * 기다리는 동안 바이트를 전혀 보내지 않으므로 그 연결은 idle로 간주되고, **ALB
 * `idle_timeout` 60초에 잘린다**. 프로덕션 실측(`/api/sse-probe`, v0.50.1): heartbeat
 * 없이 침묵하면 61.1초에 HTTP/2 `INTERNAL_ERROR`로 끊겼고, 25~30초 heartbeat를 흘리면
 * 286초까지 완주했다. Cloudflare의 125초 Proxy Read Timeout은 이 구간에서 발동하지
 * 않았고 `text/event-stream`을 버퍼링하지도 않았다.
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
}: RunAnalysisStreamOptions): Promise<T> {
    const response = await fetch('/api/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params }),
        signal,
    });

    if (!response.ok || response.body === null) {
        throw new Error(`분석 요청이 실패했습니다 (${response.status})`);
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

                const parsed = parseFrame<T>(frame);
                if (parsed.kind === 'done') return parsed.result;
                if (parsed.kind === 'error') throw new Error(parsed.message);

                boundary = buffer.indexOf('\n\n');
            }
        }
    } finally {
        // 이미 완료된 스트림에서도 안전하다 — 중도 return/throw 시 소켓을 확실히 놓는다.
        reader.cancel().catch(() => {});
    }

    throw new Error('분석 연결이 완료 전에 끊겼습니다. 다시 시도해 주세요.');
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

function parseFrame<T>(frame: string): ParsedFrame<T> {
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
                message: '분석 결과를 읽지 못했습니다. 다시 시도해 주세요.',
            };
        }
        return { kind: 'done', result: payload.result };
    }
    if (event === 'error') {
        const payload = tryParse<StreamErrorPayload>(data);
        return {
            kind: 'error',
            message:
                payload?.message ??
                '분석 중 오류가 발생했습니다. 다시 시도해 주세요.',
        };
    }
    return { kind: 'other' };
}
