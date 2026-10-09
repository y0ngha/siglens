/**
 * 가입 퍼널 이벤트 수집점. 한 요청에 이벤트 하나 — 묶음 전송은 만들지 않는다(사건이
 * 드물고, 묶으면 `keepalive` 전송이 커진다).
 *
 * `presence` 하위인 이유는 `../route.ts`와 같다 — `analytics`·`track`·`collect` 경로는
 * EasyList 계열 차단 목록이 막는다. 봇·프로덕션·pepper·after() 구조도 그 라우트와 같다.
 *
 * 알려진 한계: 방문자·IP 단위 호출 제한(throttle)은 걸지 않았다. 공용 per-IP 제한 헬퍼가
 * 아직 없고(`checkShareRateLimit`은 공유 생성 전용 키·한도), 이 라우트는 유료 업스트림을
 * 부르지 않으며 본문 1KB 상한·카탈로그 검증·봇 필터 뒤에 1행 INSERT만 한다. 지금은 이
 * 정도의 노출을 감수한다 — 남용이 보이면 공용 헬퍼를 먼저 만들고 여기에 건다.
 */
import { constants } from 'node:http2';
import { headers } from 'next/headers';
import {
    DrizzleFunnelEventRepository,
    type FunnelEventRecord,
} from '@/entities/funnel/api';
import { getDatabaseClient } from '@/shared/db/client';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    FUNNEL_BODY_MAX_BYTES,
    isFunnelEventPayload,
    type FunnelEventPayload,
} from '@/shared/lib/funnel/funnelEvents';
import { createDailyPruner, noContent } from '../_shared/dailyPruner';
import { resolveUserId } from '../_shared/resolveUserId';
import {
    rejectUncountedRequest,
    resolveVisitorIdentity,
} from '../_shared/visitorIdentity';

const { HTTP_STATUS_BAD_REQUEST } = constants;

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침 §4가 고지한 보존 기간 — `visitor_days`와 같은 근거(전년 동월 비교).
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.**
 */
const RETENTION_DAYS = 400;

const pruneOncePerDay = createDailyPruner(RETENTION_DAYS, '[funnel]');

/**
 * 순서는 타입 → 크기 → 파싱(`SERVER.md#SA-7`). 본문이 상한을 넘으면 `JSON.parse` 전에
 * 거른다. 카탈로그 밖의 event·여분 키·잘못된 enum은 `isFunnelEventPayload`가 거부한다.
 */
async function readPayload(
    request: Request
): Promise<FunnelEventPayload | null> {
    // 선언된 길이로 먼저 거른다 — 본문을 메모리에 올리기 전에 끊는다. 헤더는 거짓일 수 있어
    // 아래 바이트 검사는 그대로 둔다(백스톱).
    const declared = Number(request.headers.get('content-length'));
    if (declared > FUNNEL_BODY_MAX_BYTES) return null;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, 'utf8') > FUNNEL_BODY_MAX_BYTES)
            return null;
        const body: unknown = JSON.parse(text);
        return isFunnelEventPayload(body) ? body : null;
    } catch {
        return null;
    }
}

export async function POST(request: Request): Promise<Response> {
    const headerList = await headers();
    const rejected = rejectUncountedRequest(headerList);
    if (rejected !== null) return rejected;

    const payload = await readPayload(request);
    if (payload === null) {
        return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
    }

    const identity = await resolveVisitorIdentity(
        headerList,
        '[funnel]',
        'funnel events'
    );
    if (!identity.ok) return identity.response;

    const event: FunnelEventRecord = {
        // `visitor_days`와 같은 입력 — 두 테이블을 같은 사람으로 잇는 열쇠다.
        visitorHash: identity.visitorHash,
        userId: await resolveUserId('[funnel]'),
        event: payload.event,
        context: payload.context,
    };
    const today = kstDateKey(new Date());
    // 헤더·쿠키는 위에서 다 읽었다 — 기록은 응답 뒤로 미룬다.
    afterWithDrain(() => recordAndPrune(today, event));
    return noContent();
}

/**
 * 기록 + 하루 1회 정리. 응답 뒤(`afterWithDrain`)에 돈다. DB 클라이언트 생성까지 try 안에
 * 둔다 — `DATABASE_URL` 부재로 던지면 작업이 통째로 reject해 로그 없이 사라진다
 * (`SERVER.md#SA-3`).
 */
async function recordAndPrune(
    today: string,
    event: FunnelEventRecord
): Promise<void> {
    let repo: DrizzleFunnelEventRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleFunnelEventRepository(db);
        await repo.record(event);
    } catch (error) {
        console.error('[funnel] record failed:', error);
        // 정리도 건너뛴다 — 이유는 `createDailyPruner` 참조.
        return;
    }
    await pruneOncePerDay(today, repo);
}
