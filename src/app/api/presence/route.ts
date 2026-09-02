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
import { after } from 'next/server';
import { headers } from 'next/headers';
import { buildVisitorHash, DrizzleVisitorRepository } from '@/entities/visitor';
import { getClientIp } from '@/shared/api/getClientIp';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침 §4가 고지한 보존 기간.
 *
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.** 방침에
 * 적힌 기간과 실제 삭제 기준이 어긋나면 그 자체가 방침 위반이다.
 */
const RETENTION_DAYS = 400;

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/**
 * 이 인스턴스가 마지막으로 정리를 돌린 KST 날짜.
 *
 * 보존 기간 집행을 위해 별도 EventBridge cron을 만들지 않는다. `DELETE`는
 * 멱등이라 인스턴스가 몇 개든, 같은 날 몇 번 돌든 결과가 같다. 트래픽이 0이면
 * 정리도 안 돌지만 그때는 지울 행도 없다.
 */
let lastPrunedDate: string | null = null;

function noContent(): Response {
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}

/** `todayKst`로부터 `RETENTION_DAYS`일 전 날짜. 달력 문자열 산술이라 UTC로 파싱한다. */
function retentionCutoff(todayKst: string): string {
    const base = new Date(`${todayKst}T00:00:00Z`);
    return new Date(base.getTime() - RETENTION_DAYS * MILLISECONDS_PER_DAY)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH);
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
    const visitorHash = buildVisitorHash(
        pepper,
        await getClientIp(),
        headerList.get('user-agent') ?? ''
    );

    const { db } = getDatabaseClient();
    const repo = new DrizzleVisitorRepository(db);

    try {
        await repo.recordVisit(visitorHash, today);
    } catch (error) {
        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        console.error('[visitor-metrics] recordVisit failed:', error);
    }

    if (lastPrunedDate !== today) {
        lastPrunedDate = today;
        after(async () => {
            try {
                await repo.pruneOlderThan(retentionCutoff(today));
            } catch (error) {
                // 다음 날 다시 시도된다.
                console.error('[visitor-metrics] prune failed:', error);
            }
        });
    }

    return noContent();
}
