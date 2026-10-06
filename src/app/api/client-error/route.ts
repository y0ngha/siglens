/**
 * 클라이언트 예외 수집 엔드포인트. 하는 일은 로그 한 줄 남기고 204를 돌려주는 것뿐이다 —
 * 기준선 관찰은 Logs Insights(`[client-error]` 필터)로 한다.
 *
 * DB도 Redis도 타지 않는다. 사고 중에 이 경로가 실패하면 사고 자체가 안 보인다.
 * 그래서 IP별 한도도 인스턴스 메모리로 센다(아래 `admitReport`).
 */
import { constants } from 'node:http2';
import { getClientIp } from '@/shared/api/getClientIp';
import { createMemoryLru } from '@/shared/cache/memoryLru';
import { MS_PER_MINUTE } from '@/shared/config/time';

const { HTTP_STATUS_NO_CONTENT } = constants;

/**
 * IP당 분당 기록 상한(인스턴스별). 정상 브라우저는 한 페이지 오류에 한두 건을 보낸다 —
 * 오류 경계가 연쇄로 터져도 이 근처에 오지 않는다. 넘는 건 스크립트가 CloudWatch Logs
 * 수집 비용을 태우는 것이다(감사 aws-cost #8). 넘친 요청도 204로 답한다 — 거절을
 * 알려 줄 이유가 없고, 클라이언트 비콘은 응답을 보지 않는다.
 */
const REPORTS_PER_IP_PER_WINDOW = 30;
const REPORT_WINDOW_MS = MS_PER_MINUTE;
/** 추적할 IP 수 상한. IP를 돌려 가며 보내면 오래된 항목부터 밀려나는데, 그건 감수한다. */
const MAX_TRACKED_IPS = 10_000;

interface ReportWindow {
    readonly count: number;
    readonly windowEnd: number;
}

const reportWindows = createMemoryLru<ReportWindow>(MAX_TRACKED_IPS);

/**
 * 이 IP의 이번 창 기록을 하나 늘리고, 상한 안이면 `true`.
 *
 * Redis가 아니라 메모리인 이유는 파일 상단 — 이 경로는 외부 의존 없이 살아 있어야 한다.
 * 인스턴스마다 따로 세므로 실효 상한은 인스턴스 수만큼 늘지만, 목적이 무한 루프 차단이라
 * 충분하다.
 */
function admitReport(ip: string, now: number): boolean {
    const current = reportWindows.get(ip);
    if (current === undefined) {
        reportWindows.set(
            ip,
            { count: 1, windowEnd: now + REPORT_WINDOW_MS },
            REPORT_WINDOW_MS
        );
        return true;
    }
    if (current.count >= REPORTS_PER_IP_PER_WINDOW) return false;
    reportWindows.set(
        ip,
        { count: current.count + 1, windowEnd: current.windowEnd },
        current.windowEnd - now
    );
    return true;
}

/**
 * 사용자 본문을 로그 한 줄에 안전하게 싣는다 — 퍼센트 인코딩(`encodeURIComponent`).
 *
 * 개행만 지우는 것으로는 부족했다. P1/P2 점수 필터는 **줄 어디에 있든** 맞는 따옴표 구문
 * 매치라(`infra/aws/07-alarms.sh`의 `put_alert_filter`), 본문에 `JavaScript heap out of
 * memory`나 `[selfcheck]`만 넣어 보내도 P1 점수 100이 올라갔다(감사 aws-cost #8).
 * 현행 마커는 전부 공백·`[`·`/` 중 하나를 품고 있고, 퍼센트 인코딩은 그 셋을 모두
 * (그리고 개행·제어 문자를) `%XX`로 바꾼다. 영숫자만으로 된 한 단어 마커를 새로 만들면
 * 이 방어가 통하지 않으니 마커에는 공백이나 괄호를 넣을 것.
 *
 * 읽을 때는 `decodeURIComponent`로 되돌린다(정보 손실 없음).
 */
function escapeForLog(raw: string): string {
    return encodeURIComponent(raw);
}

export const dynamic = 'force-dynamic';

/** `reportClientError`가 스택을 1200자로 자르므로 정상 페이로드는 이 한참 아래다. */
const MAX_BODY_BYTES = 4096;

/**
 * 본문을 `cap` 바이트까지만 읽고, 넘으면 스트림을 끊고 `null`을 돌려준다.
 *
 * `request.text()`를 그냥 쓰면 안 된다. 인증 없는 공개 엔드포인트이고, `content-length`는
 * **믿을 수 없다** — 헤더가 없으면(`Transfer-Encoding: chunked`, HTTP/2) `Number(null)`이
 * `0`이라 어떤 상한 검사도 통과한다. 그 상태로 `text()`를 부르면 임의 크기 본문이
 * 전부 메모리로 들어온다. 읽은 뒤 자르는 건 로그만 줄일 뿐 이미 늦었다.
 */
async function readCapped(
    request: Request,
    cap: number
): Promise<string | null> {
    const body = request.body;
    if (body === null) return '';

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > cap) {
                await reader.cancel();
                return null;
            }
            out += decoder.decode(value, { stream: true });
        }
        return out + decoder.decode();
    } catch {
        return null;
    }
}

/** IP를 못 읽은 요청이 모이는 공용 버킷 키. */
const UNKNOWN_REPORTER = 'unknown';

/**
 * 한도 키로 쓸 IP. **던지지 않는다** — IP 해석(`headers()`)이 실패해도 이 엔드포인트는
 * 살아 있어야 한다(파일 상단: 사고 중에 이 경로가 죽으면 사고가 안 보인다). 실패하면
 * 공용 버킷 하나로 센다 — 상한은 그대로 걸리므로 남용 방어도 유지된다.
 */
async function reporterKey(): Promise<string> {
    try {
        return await getClientIp();
    } catch {
        return UNKNOWN_REPORTER;
    }
}

export async function POST(request: Request): Promise<Response> {
    // 한도 초과면 본문을 읽지도 않는다 — 읽는 것 자체가 이 남용의 비용이다.
    if (!admitReport(await reporterKey(), Date.now())) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }

    // 정직한 클라이언트는 여기서 걸러진다(스트림을 열지도 않는다).
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }

    const raw = await readCapped(request, MAX_BODY_BYTES);
    if (raw === null || raw === '')
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });

    // 개행이 살아 있으면 awslogs 드라이버가 stdout을 **줄마다** 로그 이벤트로 쪼개
    // 위조 줄이 생기고, 개행이 없어도 따옴표 구문 필터는 줄 안 어디서든 맞는다 —
    // 둘 다 `escapeForLog`가 막는다(그 JSDoc 참고).
    console.error('[client-error]', escapeForLog(raw));
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}
