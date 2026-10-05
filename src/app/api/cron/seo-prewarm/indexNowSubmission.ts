import 'server-only';
import {
    loadCryptoChildEntries,
    loadPopularChildEntries,
    loadStaticChildEntries,
} from '@/app/api/sitemap/_shared/childEntries';
import { indexNowNotBeforeMs } from '@/entities/sitemap-entry/lib/indexNowDelays';
import {
    selectIndexNowUrls,
    type HarvestedUnits,
} from '@/entities/sitemap-entry/lib/indexNowUrls';
import type { SitemapEntry } from '@/entities/sitemap-entry/model';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_TIMEOUT_MS,
} from '@/shared/config/indexNow';
import { isIndexNowEnabled } from '@/shared/lib/indexNow';
import {
    drainIndexNow,
    enqueueIndexNow,
    type IndexNowQueueEntry,
} from '@/shared/lib/indexNowQueue';
import {
    diffStaticLastmod,
    readStaticLastmods,
    writeStaticLastmods,
} from './indexNowStaticPages';

/** 배치 로그(`[seo-prewarm] batch done`)에 실리는 IndexNow 응답 지표. */
export interface IndexNowCounts {
    indexNowSubmitted: number;
    indexNowOk: number;
    indexNowFailed: number;
}

export interface IndexNowBatchInput {
    /** 이번 배치에서 스냅샷을 새로 쓴(harvest된) 심볼과 그 탭. */
    readonly harvested: readonly HarvestedUnits[];
    /** 이번 배치에서 새로 구운 허브의 공개 URL(절대 URL) — 크론이 태그를 직접 털었다. */
    readonly hubUrls: readonly string[];
    /**
     * 본문이 **바뀐 것으로 확인된** 허브의 공개 URL — 이미 캐시에 있던 본문이라 크론이
     * 태그를 털지 않았다(지연이 2배다. `indexNowDelays`).
     */
    readonly changedHubUrls?: readonly string[];
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
 * 이번 배치가 바꾼 URL을 **대기열에 넣고**, 만기가 된 URL을 IndexNow로 제출한다.
 * **던지지 않는다.**
 *
 * ## 무엇을 대기열에 넣는가
 *
 * URL을 여기서 조립하지 않는다. 종목 URL은 sitemap 빌더가 만든 엔트리에서
 * (`selectIndexNowUrls` — **harvest된 탭의 URL만**), 허브 URL은 정적 sitemap 엔트리와 대조해서
 * 고른다. sitemap에 없는 URL은 noindex이거나 존재하지 않는 페이지이므로, 검색엔진에 "바뀌었다"고
 * 알려 봐야 크롤 예산만 쓴다. 입력 로더는 sitemap 라우트와 **같은 함수**(`childEntries`)라
 * 판정이 갈라지지 않는다. 정적 페이지(소개·방법론·약관·방침·백테스팅)는 sitemap `lastmod`가
 * 지난 제출 때와 달라졌을 때만 넣는다(`indexNowStaticPages`).
 *
 * 각 URL의 제출 시각은 즉시가 아니라 **페이지 재생성이 끝났을 시각**이다(`indexNowDelays`).
 *
 * ## 빈 tick에도 돈다
 *
 * 이번 tick이 아무것도 굽지 않았어도 대기열의 만기분은 제출해야 한다 — 어제 넣은 URL의 지연이
 * 오늘 밤 tick에서야 끝난다. 그래서 `harvested`·`hubUrls`가 비어도 drain은 한다.
 *
 * ## 이 크론에 대한 약속
 *
 * 입력 로딩(DB)·대기열 쓰기·제출 전체를 `INDEXNOW_TIMEOUT_MS`(5초)로 묶는다. 제출 함수의
 * 타임아웃은 요청 단위라 sitemap 입력 로딩이 멎는 경우를 못 막는다 — 이 단계는 심볼
 * 마감 **뒤**에 돌고, 심볼 마감은 `BATCH_WALL_CLOCK_BUDGET_MS`가 락 TTL보다 60초 일찍
 * 끝나도록 잘라 둔 것이라 그 60초 여유 안에서만 이 5초가 허용된다
 * (`runPrewarmBatch.ts`의 `LOCK_SAFETY_MARGIN_MS`). **타임아웃이 나도 대기열에서는 아무것도
 * 지우지 않는다** — 지우는 것은 제출 성공이 확인된 뒤뿐이다.
 *
 * 꺼진 환경(비운영·E2E)은 입력 로딩 **전에** 돌아간다 — DB를 읽고 버리는 일을 하지 않는다.
 */
export async function submitIndexNowForBatch(
    input: IndexNowBatchInput
): Promise<IndexNowCounts> {
    if (!isIndexNowEnabled()) return NO_SUBMISSION;

    try {
        return await withinTimeout(enqueueAndDrain(input));
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

async function enqueueAndDrain(
    input: IndexNowBatchInput
): Promise<IndexNowCounts> {
    const { now } = input;
    // 입력 로딩·큐 쓰기가 실패해도 **만기분 drain은 한다** — 대기열에 이미 있는 URL의 제출이
    // 새 URL을 모으는 DB 조회에 인질로 잡히면, 로더 장애 동안 알림이 전부 멈춘다.
    try {
        const { entries, staticUpdates } = await collectQueueEntries(input);
        await enqueueIndexNow(entries, now);
        // 큐에 들어간 **뒤에** 정적 페이지 시드를 갱신한다. 큐 쓰기가 실패하면 시드가 그대로라
        // 다음 tick이 같은 변화를 다시 넣는다.
        await writeStaticLastmods(staticUpdates);
    } catch (error) {
        console.error(
            '[indexnow] enqueue failed — draining existing queue',
            error
        );
    }

    const drained = await drainIndexNow(now);
    return {
        indexNowSubmitted: drained.submitted,
        indexNowOk: drained.ok,
        indexNowFailed: drained.failed,
    };
}

interface CollectedQueueEntries {
    readonly entries: IndexNowQueueEntry[];
    /** 큐에 넣은 정적 페이지의 새 lastmod(URL → ISO). */
    readonly staticUpdates: Readonly<Record<string, string>>;
}

async function collectQueueEntries(
    input: IndexNowBatchInput
): Promise<CollectedQueueEntries> {
    const { harvested, hubUrls, changedHubUrls = [], now } = input;
    const nowMs = now.getTime();

    // 정적 sitemap은 허브 대조와 정적 페이지 lastmod 감시가 함께 쓴다 — 한 번만 읽는다.
    const [symbolEntries, staticEntries, storedLastmods] = await Promise.all([
        loadSymbolEntries(harvested, now),
        loadStaticChildEntries(now),
        readStaticLastmods(),
    ]);
    const staticDiff = diffStaticLastmod(staticEntries, storedLastmods);
    const declaredStatic = new Set(staticEntries.map(entry => entry.url));

    const entries: IndexNowQueueEntry[] = [];
    const push = (
        urls: readonly string[],
        invalidatedByCron: boolean
    ): void => {
        for (const url of urls) {
            const notBeforeMs = indexNowNotBeforeMs(url, nowMs, {
                invalidatedByCron,
            });
            if (notBeforeMs !== null) entries.push({ url, notBeforeMs });
        }
    };
    push(selectIndexNowUrls(harvested, symbolEntries), true);
    // 정적 sitemap에 실린 허브만 남긴다 — 없는 허브·정체돼 빠진 카테고리는 제출하지 않는다.
    push(
        hubUrls.filter(url => declaredStatic.has(url)),
        true
    );
    push(
        changedHubUrls.filter(url => declaredStatic.has(url)),
        false
    );
    // 정적 페이지는 크론이 태그를 털지 않는다 — 다음 방문이 만료 후 재생성한다(2배).
    push(staticDiff.changedUrls, false);

    return { entries, staticUpdates: staticDiff.updates };
}

/** 종목 URL 후보. harvest된 것이 없으면 DB를 읽지 않는다. */
async function loadSymbolEntries(
    harvested: readonly HarvestedUnits[],
    now: Date
): Promise<SitemapEntry[]> {
    if (harvested.length === 0) return [];
    const [popular, crypto] = await Promise.all([
        loadPopularChildEntries(now),
        loadCryptoChildEntries(now),
    ]);
    return [...popular, ...crypto];
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
