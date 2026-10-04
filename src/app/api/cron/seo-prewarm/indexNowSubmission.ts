import 'server-only';
import {
    loadCryptoChildEntries,
    loadPopularChildEntries,
    loadStaticChildEntries,
} from '@/app/api/sitemap/_shared/childEntries';
import { selectIndexNowUrls } from '@/entities/sitemap-entry/lib/indexNowUrls';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_TIMEOUT_MS,
} from '@/shared/config/indexNow';
import { isIndexNowEnabled, submitIndexNow } from '@/shared/lib/indexNow';

/** 배치 로그(`[seo-prewarm] batch done`)에 실리는 IndexNow 응답 지표. */
export interface IndexNowCounts {
    indexNowSubmitted: number;
    indexNowOk: number;
    indexNowFailed: number;
}

export interface IndexNowBatchInput {
    /** 이번 배치에서 `revalidateTag`까지 간(= 스냅샷을 새로 반영한) 심볼. */
    readonly symbols: readonly string[];
    /** 이번 배치에서 새로 구운 허브의 공개 URL(절대 URL). */
    readonly hubUrls: readonly string[];
    /** sitemap 빌더에 넘기는 시각 — 배치가 쓰는 달력 시각과 같은 값. */
    readonly now: Date;
}

const NO_SUBMISSION: IndexNowCounts = {
    indexNowSubmitted: 0,
    indexNowOk: 0,
    indexNowFailed: 0,
};

/**
 * 입력을 못 읽었거나 5초를 넘긴 경우 — 어느 엔드포인트에도 닿지 못했으므로 전부 실패다.
 * 배치가 제출 단계의 예기치 못한 throw를 흡수할 때도 같은 값을 쓴다.
 */
export const INDEXNOW_BATCH_FAILED: IndexNowCounts = {
    ...NO_SUBMISSION,
    indexNowFailed: INDEXNOW_ENDPOINTS.length,
};

class IndexNowTimeoutError extends Error {}

/**
 * 이번 배치가 새로 반영한 URL을 IndexNow로 한 번 제출한다. **던지지 않는다.**
 *
 * ## 무엇을 보내는가
 *
 * URL을 여기서 조립하지 않는다. 종목 URL은 sitemap 빌더가 만든 엔트리에서
 * (`selectIndexNowUrls`), 허브 URL은 정적 sitemap 엔트리와 대조해서 고른다. sitemap에
 * 없는 URL은 noindex이거나 존재하지 않는 페이지이므로, 검색엔진에 "바뀌었다"고 알려
 * 봐야 크롤 예산만 쓴다. 입력 로더는 sitemap 라우트와 **같은 함수**(`childEntries`)라
 * 판정이 갈라지지 않는다.
 *
 * ## 이 크론에 대한 약속
 *
 * 입력 로딩(DB)부터 제출까지 전체를 `INDEXNOW_TIMEOUT_MS`(5초)로 묶는다. 제출 함수의
 * 타임아웃은 요청 단위라 sitemap 입력 로딩이 멎는 경우를 못 막는다 — 이 단계는 심볼
 * 마감 **뒤**에 돌고, 심볼 마감은 `BATCH_WALL_CLOCK_BUDGET_MS`가 락 TTL보다 60초 일찍
 * 끝나도록 잘라 둔 것이라 그 60초 여유 안에서만 이 5초가 허용된다
 * (`runPrewarmBatch.ts`의 `LOCK_SAFETY_MARGIN_MS`).
 *
 * 꺼진 환경(비운영·E2E)은 입력 로딩 **전에** 돌아간다 — DB를 읽고 버리는 일을 하지 않는다.
 */
export async function submitIndexNowForBatch(
    input: IndexNowBatchInput
): Promise<IndexNowCounts> {
    const { symbols, hubUrls, now } = input;
    if (symbols.length === 0 && hubUrls.length === 0) return NO_SUBMISSION;
    if (!isIndexNowEnabled()) return NO_SUBMISSION;

    try {
        return await withinTimeout(submitCollected(input, now));
    } catch (error) {
        if (error instanceof IndexNowTimeoutError) {
            console.error(
                `[indexnow] batch submission timed out after ${INDEXNOW_TIMEOUT_MS}ms`
            );
        } else {
            console.error('[indexnow] batch submission failed', error);
        }
        return INDEXNOW_BATCH_FAILED;
    }
}

async function submitCollected(
    { symbols, hubUrls }: IndexNowBatchInput,
    now: Date
): Promise<IndexNowCounts> {
    const symbolUrls = await collectSymbolUrls(symbols, now);
    const sitemapHubUrls = await collectHubUrls(hubUrls, now);
    const urls = [...symbolUrls, ...sitemapHubUrls];
    if (urls.length === 0) return NO_SUBMISSION;

    const result = await submitIndexNow(urls);
    return {
        indexNowSubmitted: result.submitted,
        indexNowOk: result.ok,
        indexNowFailed: result.failed,
    };
}

async function collectSymbolUrls(
    symbols: readonly string[],
    now: Date
): Promise<string[]> {
    if (symbols.length === 0) return [];
    const [popular, crypto] = await Promise.all([
        loadPopularChildEntries(now),
        loadCryptoChildEntries(now),
    ]);
    return selectIndexNowUrls(symbols, [...popular, ...crypto]);
}

/** 정적 sitemap에 실린 허브만 남긴다 — 없는 허브·정체돼 빠진 카테고리는 제출하지 않는다. */
async function collectHubUrls(
    hubUrls: readonly string[],
    now: Date
): Promise<string[]> {
    if (hubUrls.length === 0) return [];
    const declared = new Set(
        (await loadStaticChildEntries(now)).map(entry => entry.url)
    );
    return hubUrls.filter(url => declared.has(url));
}

function withinTimeout<T>(work: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        // unref: 이긴 쪽이 정해진 뒤에도 타이머가 이벤트 루프를 붙들지 않게 한다.
        const timer = setTimeout(
            () => reject(new IndexNowTimeoutError()),
            INDEXNOW_TIMEOUT_MS
        );
        timer.unref();
        work.then(resolve, reject).finally(() => clearTimeout(timer));
    });
}
