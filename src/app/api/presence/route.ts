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
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const dynamic = 'force-dynamic';

/**
 * 개인정보처리방침 §4가 고지한 보존 기간.
 *
 * **바꾸면 방침 본문(`db/seeds/terms/privacy/`)도 같이 바꿔야 한다.** 방침에
 * 적힌 기간과 실제 삭제 기준이 어긋나면 그 자체가 방침 위반이다.
 */
const RETENTION_DAYS = 400;

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

    /**
     * DB 클라이언트 생성까지 try 안에 둔다. `getDatabaseClient()`는
     * `DATABASE_URL`이 없으면 던지는데, 그게 밖에 있으면 이 핸들러가 통째로
     * reject해 프레임워크 기본 500이 나간다 — 아래 catch가 지키는 "집계 실패는
     * 화면을 깨뜨리지 않는다"는 불변식이 거기서만 뚫린다.
     */
    let repo: DrizzleVisitorRepository;
    try {
        const { db } = getDatabaseClient();
        repo = new DrizzleVisitorRepository(db);
        await repo.recordVisit(visitorHash, today);
    } catch (error) {
        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        console.error('[visitor-metrics] recordVisit failed:', error);
        /**
         * 정리도 건너뛴다. DB가 죽어 있으면 어차피 실패할 뿐 아니라,
         * `lastPrunedDate`를 오늘로 소진해 버리면 그날 남은 요청이 전부
         * 정리를 건너뛴다 — 다음 성공 요청에 기회를 남긴다.
         */
        return noContent();
    }

    if (lastPrunedDate !== today) {
        lastPrunedDate = today;
        after(async () => {
            try {
                await repo.pruneOlderThan(
                    kstDateKeyDaysBefore(today, RETENTION_DAYS)
                );
            } catch (error) {
                // 다음 날 다시 시도된다.
                console.error('[visitor-metrics] prune failed:', error);
            }
        });
    }

    return noContent();
}
