import { constants } from 'node:http2';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { stripExpiredWebSearchBodies } from '@/entities/chat-conversation/server/stripExpiredWebSearchBodies';
import { getDatabaseClient } from '@/shared/db/client';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { runAsBatchWork } from '@/shared/lib/renderBudget';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * 새 배치를 시작하지 않는 wall-clock 마감(SERVER.md#CC-7). 배치 하나는 SELECT 1회 + 한 트랜잭션 UPDATE(100행)라 수 초
 * 안이고, 마감은 그 배치 앞에서만 본다. 배치 수 상한(`WEB_SEARCH_RETENTION_MAX_BATCHES`)이 먼저 닿지 않으면 이 마감이 끊는다.
 */
const WEB_SEARCH_RETENTION_DEADLINE_MS = 3 * 60 * 1000;

/**
 * 웹 검색 결과 보존 기간 cron(`PATCH /api/cron/web-search-retention`) — EventBridge가 매일 18:10 UTC(03:10 KST)에 부른다.
 * 멤버 대화에 저장된 `web_search` 도구 결과 중 저장된 지 7일이 지난 것을 제목·URL만 남기도록 다시 쓴다
 * (`stripExpiredWebSearchBodies`, 규칙은 `shared/api/web/webSearchResult.ts`).
 *
 * 202를 먼저 돌려주고 `afterWithDrain`으로 돈다(API Destination 타임아웃 ~5s). 락이 없는 이유: 다시 쓰기가 멱등이라
 * (줄인 행은 표식이 붙어 조회에서 빠진다) 겹쳐 돌아도 결과가 같다. 한 번 실행이 못 끝낸 몫은 다음 실행이 이어서 한다.
 * 첫 운영 실행은 기존 행을 건드리므로 배포 때 사용자 확인 뒤에 한 번 수동으로 부른다(스케줄 등록도 그 뒤).
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    afterWithDrain(() =>
        runAsBatchWork(async () => {
            const startedAt = Date.now();
            try {
                const { db } = getDatabaseClient();
                const result = await stripExpiredWebSearchBodies({
                    repo: new DrizzleChatConversationRepository(db),
                    isDeadlineReached: () =>
                        Date.now() - startedAt >=
                        WEB_SEARCH_RETENTION_DEADLINE_MS,
                });
                console.log(
                    '[web-search-retention] run done:',
                    JSON.stringify(result)
                );
            } catch (error) {
                console.error(
                    '[web-search-retention] run failed:',
                    redactDbErrorForLog(error)
                );
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
