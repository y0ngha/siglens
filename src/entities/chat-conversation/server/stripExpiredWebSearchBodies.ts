import { stripStoredWebSearchContent } from '@/shared/api/web/webSearchResult';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** 한 번에 읽고 쓰는 행 수 — 행 하나가 최대 13,000자(`WEB_SEARCH_RESULT_MAX_CHARS`)라 한 배치는 최대 약 1.3MB다. */
export const WEB_SEARCH_RETENTION_BATCH_SIZE = 100;

/** 한 실행이 돌 배치 수의 상한. 밀린 행이 더 있으면 다음 실행(하루 뒤 또는 수동 호출)이 이어서 한다. */
export const WEB_SEARCH_RETENTION_MAX_BATCHES = 100;

/** 보존 기간 작업이 부르는 저장소 — `DrizzleChatConversationRepository`가 구현한다. */
export interface WebSearchRetentionRepository {
    listUnstrippedWebSearchRows(
        afterId: string | null,
        limit: number
    ): Promise<Array<{ id: string; content: string }>>;
    rewriteWebSearchContent(
        updates: ReadonlyArray<{ id: string; content: string }>
    ): Promise<number>;
}

export interface WebSearchRetentionResult {
    /** 이번 실행이 읽은 행 수. */
    scanned: number;
    /** 실제로 줄인 행 수. */
    rewritten: number;
    /** 읽었지만 줄일 수 없어 그대로 둔 행(JSON이 아님 등). */
    skipped: number;
    batches: number;
    /** 읽을 행이 더 남았을 수 있는 채로 끝났다 — 배치 수 상한 또는 마감. */
    more: boolean;
    /** 저장소 오류로 중단했다. 이미 쓴 배치는 유효하다. */
    failed: boolean;
}

export interface StripExpiredWebSearchBodiesOptions {
    repo: WebSearchRetentionRepository;
    isDeadlineReached?: () => boolean;
    batchSize?: number;
    maxBatches?: number;
}

/**
 * 저장된 지 `WEB_SEARCH_RETENTION_DAYS`(7)일이 지난(DB 시계 기준, SQL이 가른다) `web_search` 도구 결과를 제목·URL만 남기도록 다시 쓴다
 * (`stripStoredWebSearchContent`). 멱등이다 — 줄인 행은 표식이 붙어 다음 조회에서 빠진다. **절대 throw하지 않는다**:
 * 저장소 오류는 로그(SA-26)로 남기고 `failed: true`로 끝낸다.
 */
export async function stripExpiredWebSearchBodies({
    repo,
    isDeadlineReached = () => false,
    batchSize = WEB_SEARCH_RETENTION_BATCH_SIZE,
    maxBatches = WEB_SEARCH_RETENTION_MAX_BATCHES,
}: StripExpiredWebSearchBodiesOptions): Promise<WebSearchRetentionResult> {
    const result: WebSearchRetentionResult = {
        scanned: 0,
        rewritten: 0,
        skipped: 0,
        batches: 0,
        more: false,
        failed: false,
    };
    let afterId: string | null = null;
    try {
        while (result.batches < maxBatches) {
            if (isDeadlineReached()) {
                result.more = true;
                break;
            }
            // 배치는 앞 배치의 커서에 의존하므로 차례로 돈다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const rows: Array<{ id: string; content: string }> =
                await repo.listUnstrippedWebSearchRows(afterId, batchSize);
            if (rows.length === 0) break;
            result.batches += 1;
            result.scanned += rows.length;
            afterId = rows[rows.length - 1].id;
            const updates = rows.flatMap(row => {
                const content = stripStoredWebSearchContent(row.content);
                return content === null ? [] : [{ id: row.id, content }];
            });
            result.skipped += rows.length - updates.length;
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            result.rewritten += await repo.rewriteWebSearchContent(updates);
            if (rows.length < batchSize) break;
            if (result.batches === maxBatches) result.more = true;
        }
    } catch (error) {
        result.failed = true;
        console.error(
            '[web-search-retention] batch failed:',
            redactDbErrorForLog(error)
        );
    }
    return result;
}
