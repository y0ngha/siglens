import { constants } from 'node:http2';
import { buildVisitorHash } from '@/entities/visitor/lib/visitorHash';
import { getClientIp } from '@/shared/api/getClientIp';
import { isBot } from '@/shared/api/isBot';
import { noContent } from './dailyPruner';

const { HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

/**
 * 집계하지 않을 요청이면 돌려줄 204. 봇이거나 프로덕션이 아니면(개발·E2E·프리뷰가 운영
 * 통계를 오염시키지 않게) 아무것도 읽지 않고 끝낸다. 집계 대상이면 null.
 */
export function rejectUncountedRequest(headerList: Headers): Response | null {
    if (isBot(headerList)) return noContent();
    if (process.env.NODE_ENV !== 'production') return noContent();
    return null;
}

export type VisitorIdentity =
    | {
          ok: true;
          visitorHash: string;
          /** 헤더가 없었으면 null — 해시 입력은 빈 문자열로 정규화돼 있다. */
          userAgent: string | null;
      }
    | { ok: false; response: Response };

/**
 * `visitor_days`와 `funnel_events`가 공유하는 방문자 해시 — 두 테이블을 같은 사람으로 잇는
 * 열쇠라 입력(pepper + IP + UA)이 라우트마다 달라지면 안 된다. pepper가 없으면 조용히 0이
 * 찍히는 것이 최악이므로 프로덕션 로그에 남기고 500을 돌려준다.
 *
 * @param logTag 로그 접두사(예: `[funnel]`)
 * @param notRecordedWhat pepper 누락 로그에 쓸 "기록되지 않는 것"(예: `funnel events`)
 */
export async function resolveVisitorIdentity(
    headerList: Headers,
    logTag: string,
    notRecordedWhat: string
): Promise<VisitorIdentity> {
    const pepper = process.env.VISITOR_HASH_PEPPER ?? '';
    if (pepper === '') {
        console.error(
            `${logTag} VISITOR_HASH_PEPPER is not set — ${notRecordedWhat} are not being recorded`
        );
        return {
            ok: false,
            response: new Response(null, {
                status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
            }),
        };
    }
    // 헤더가 없었던 경우와 빈 문자열이 온 경우를 구분해 저장한다. 해시 입력은
    // 종전과 같이 빈 문자열로 정규화해야 기존 방문자의 해시가 유지된다.
    const userAgent = headerList.get('user-agent');
    return {
        ok: true,
        visitorHash: buildVisitorHash(
            pepper,
            await getClientIp(),
            userAgent ?? ''
        ),
        userAgent,
    };
}
