/**
 * 방문자 집계 수집점. 하는 일은 방문자당 하루 1행을 남기는 것뿐이다.
 *
 * 서버 컴포넌트가 아니라 클라이언트 비콘이 이 라우트를 부른다. 페이지에서
 * `headers()`를 부르면 그 라우트의 ISR이 통째로 꺼지고, 프록시에서 세면 RSC
 * prefetch까지 전부 세어 사람 수가 부풀려진다.
 *
 * 경로가 `analytics`·`track`·`collect`가 아닌 이유: EasyList 계열 차단 목록이
 * 그 단어가 든 경로를 막는다.
 */
import { headers } from 'next/headers';
import { collapseLandingPath } from '@/app/api/presence/_shared/collapseLandingPath';
import {
    createDailyPruner,
    noContent,
} from '@/app/api/presence/_shared/dailyPruner';
import { entrySourceOf } from '@/app/api/presence/_shared/entrySourceOf';
import {
    landingPathOf,
    landingSiteOf,
} from '@/app/api/presence/_shared/landingPathOf';
import { readPresenceBody } from '@/app/api/presence/_shared/readPresenceBody';
import { resolveUserId } from '@/app/api/presence/_shared/resolveUserId';
import {
    rejectUncountedRequest,
    resolveVisitorIdentity,
} from '@/app/api/presence/_shared/visitorIdentity';
import {
    DrizzleVisitorRepository,
    type VisitorDayRecord,
} from '@/entities/visitor/api';
import { getDatabaseClient } from '@/shared/db/client';
import { describeDbErrorForLog } from '@/shared/db/describeDbErrorForLog';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침이 고지한 보존 기간.
 *
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.** 방침에
 * 적힌 기간과 실제 삭제 기준이 어긋나면 그 자체가 방침 위반이다.
 */
const RETENTION_DAYS = 400;

const pruneOncePerDay = createDailyPruner(RETENTION_DAYS, '[visitor-metrics]');

/**
 * 방문 비콘 수신 — 집계 대상이면 방문자당 하루 1행 기록을 응답 뒤로 미루고 언제나 204로 답한다.
 * 본문(출처 신호 `{ referrerHost, utmSource, utmMedium, adClick }`와 방문 이력 구간값 `visit`)은
 * 첫 진입 출처 분류와 구간값 저장에만 쓰고, 분류 전 원본은 저장하지 않는다.
 */
export async function POST(request?: Request): Promise<Response> {
    const headerList = await headers();

    // 봇 필터 2층. 1층은 이 라우트에 도달하지도 않는다 — 비콘이 JS 실행을
    // 요구하므로 JS를 돌리지 않는 크롤러는 애초에 요청을 만들지 않는다.
    const rejected = rejectUncountedRequest(headerList);
    if (rejected !== null) return rejected;

    const identity = await resolveVisitorIdentity(
        headerList,
        '[visitor-metrics]',
        'visits'
    );
    if (!identity.ok) return identity.response;

    const today = kstDateKey(new Date());
    const referer = headerList.get('referer');
    // 원본 경로는 출처 분류(공유 링크 판정)에만 쓰고, 저장하는 값은 식별자를 접은 경로다.
    const landingPath = landingPathOf(referer);
    const landingSite = landingSiteOf(referer);
    // 본문 읽기와 회원 확인은 서로 무관하다 — 겹쳐서 응답 경로를 줄인다.
    const [body, userId] = await Promise.all([
        readPresenceBody(request),
        // 회원 D7/D30 재방문의 축. 세션 쿠키가 없으면 DB 왕복 없이 null이다.
        resolveUserId('[visitor-metrics]'),
    ]);

    const visit: VisitorDayRecord = {
        visitorHash: identity.visitorHash,
        date: today,
        userAgent: identity.userAgent,
        country: headerList.get('cf-ipcountry'),
        landingPath: collapseLandingPath(landingPath, landingSite),
        entrySource: entrySourceOf(body, landingPath),
        landingSite,
        firstVisitBucket: body?.visit?.first ?? null,
        lastVisitBucket: body?.visit?.last ?? null,
        visitDaysBucket: body?.visit?.days ?? null,
        returnWindow: body?.visit?.window ?? null,
        userId,
    };
    // 헤더는 위에서 다 읽었다 — 기록은 응답 뒤로 미룬다(`recordVisitAndPrune`).
    afterWithDrain(() => recordVisitAndPrune(visit));
    return noContent();
}

/**
 * 방문 기록 + 하루 1회 정리. **응답을 보낸 뒤**(`afterWithDrain`) 돈다 — 비콘은 결과를 읽지
 * 않으므로(늘 204) DB upsert 왕복을 응답 경로에 둘 이유가 없다.
 * 배포 중 SIGTERM drain은 이 작업을 기다린다.
 *
 * DB 클라이언트 생성까지 try 안에 둔다. `getDatabaseClient()`는 `DATABASE_URL`이 없으면
 * 던지는데, 그게 밖에 있으면 작업이 통째로 reject해 로그 없이 사라진다 — "집계 실패는
 * 로그로 남기고 화면은 깨뜨리지 않는다"는 불변식이 거기서만 뚫린다.
 */
async function recordVisitAndPrune(visit: VisitorDayRecord): Promise<void> {
    let repo: DrizzleVisitorRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleVisitorRepository(db);
        await repo.recordVisit(visit);
    } catch (error) {
        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        // 메시지·파라미터는 남기지 않는다(`describeDbErrorForLog`) — 해시·UA·경로가 로그로 샌다.
        console.error(
            `[visitor-metrics] recordVisit failed: ${describeDbErrorForLog(error)}`
        );
        // 정리도 건너뛴다 — 이유는 `createDailyPruner` 참조.
        return;
    }
    await pruneOncePerDay(visit.date, repo);
}
