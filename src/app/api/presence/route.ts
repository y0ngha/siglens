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
import { constants } from 'node:http2';
import { headers } from 'next/headers';
import { buildVisitorHash } from '@/entities/visitor/lib/visitorHash';
import {
    DrizzleVisitorRepository,
    type VisitorDayRecord,
} from '@/entities/visitor/api';
import { getClientIp } from '@/shared/api/getClientIp';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { createDailyPruner, noContent } from './_shared/dailyPruner';

const { HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침 §4가 고지한 보존 기간.
 *
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.** 방침에
 * 적힌 기간과 실제 삭제 기준이 어긋나면 그 자체가 방침 위반이다.
 */
const RETENTION_DAYS = 400;

const pruneOncePerDay = createDailyPruner(RETENTION_DAYS, '[visitor-metrics]');

/**
 * 비콘이 뜬 페이지의 경로. 비콘은 same-origin `fetch`라 `Referer`에 현재 페이지
 * URL이 그대로 실린다 — 클라이언트가 본문을 보낼 필요가 없다.
 *
 * 쿼리스트링은 버린다. 검색어·추천 코드 같은 것이 섞여 들어오면 400일짜리
 * 통계 테이블이 그걸 같이 보관하게 된다.
 */
function landingPathOf(referer: string | null): string | null {
    if (referer === null || !URL.canParse(referer)) return null;
    return new URL(referer).pathname;
}

export async function POST(): Promise<Response> {
    const headerList = await headers();

    // 봇 필터 2층. 1층은 이 라우트에 도달하지도 않는다 — 비콘이 JS 실행을
    // 요구하므로 JS를 돌리지 않는 크롤러는 애초에 요청을 만들지 않는다.
    if (isBot(headerList)) return noContent();
    if (process.env.NODE_ENV !== 'production') return noContent();

    const pepper = process.env.VISITOR_HASH_PEPPER ?? '';
    if (pepper === '') {
        // 조용히 0이 찍히는 것이 최악이다. 프로덕션 로그에 남긴다.
        console.error(
            '[visitor-metrics] VISITOR_HASH_PEPPER is not set — visits are not being recorded'
        );
        return new Response(null, {
            status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
        });
    }

    const today = kstDateKey(new Date());
    // 헤더가 없었던 경우와 빈 문자열이 온 경우를 구분해 저장한다. 해시 입력은
    // 종전과 같이 빈 문자열로 정규화해야 기존 방문자의 해시가 유지된다.
    const userAgentHeader = headerList.get('user-agent');
    const visitorHash = buildVisitorHash(
        pepper,
        await getClientIp(),
        userAgentHeader ?? ''
    );

    const visit: VisitorDayRecord = {
        visitorHash,
        date: today,
        userAgent: userAgentHeader,
        country: headerList.get('cf-ipcountry'),
        landingPath: landingPathOf(headerList.get('referer')),
    };
    // 헤더는 위에서 다 읽었다 — 기록은 응답 뒤로 미룬다(`recordVisitAndPrune`).
    afterWithDrain(() => recordVisitAndPrune(visit));
    return noContent();
}

/**
 * 방문 기록 + 하루 1회 정리. **응답을 보낸 뒤**(`afterWithDrain`) 돈다 — 비콘은 결과를 읽지
 * 않으므로(늘 204) DB upsert 왕복을 응답 경로에 둘 이유가 없다(2026-10 서버 성능 감사 L8).
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
        console.error('[visitor-metrics] recordVisit failed:', error);
        // 정리도 건너뛴다 — 이유는 `createDailyPruner` 참조.
        return;
    }
    await pruneOncePerDay(visit.date, repo);
}
