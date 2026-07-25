import 'server-only';
import { revalidateTag } from 'next/cache';
import {
    buildPrewarmUniverse,
    isSnapshotFresh,
    lastCompletedEtCloseWithBuffer,
    type PrewarmSymbol,
    type SeoSnapshotTab,
} from '@/entities/seo-snapshot';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getFmpErrorStatus } from '@/shared/api/fmp/fmpUserMessage';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { addFmpBudget, getFmpBudgetUsed, isInFlight } from './lock';
import { TAB_SEAMS, resolveHarvest } from './harvest';

export interface PrewarmBatchCounts {
    submitted: number;
    harvested: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

const SYMBOLS_PER_TICK = 10;
// core fundamental이 Promise.all로 ~13개 FMP 호출을 한번에 쏨 → 3×13≈40 순간 버스트 캡 (spec §8).
const SYMBOL_CONCURRENCY = 3;
// overall을 마지막에 둬 bars/scorecard 등 다른 축이 이미 채운 Redis 캐시를 HIT로 재활용한다.
const TAB_ORDER: readonly SeoSnapshotTab[] = [
    'technical',
    'fundamental',
    'financials',
    'congress',
    'news',
    'options',
    'overall',
];
// spec §8 추정치 — 모니터링용, 정밀 계측 아님. 심볼 전체 탭 수 기준 총량을
// 실제 seam이 "실행된" 탭 수에 비례 배분한다(탭 하나당 평균 FMP 호출수).
// equity: 22 calls / 7 tabs ≈ 3. crypto: 2 calls / 3 tabs(CRYPTO_TABS) ≈ 1.
// in-flight로 스킵된 탭·이미 fresh인 탭은 seam을 호출하지 않으므로 예산에서
// 제외된다 — 그렇지 않으면 실제 FMP 호출이 0건인데도 예산이 계상되어
// getFmpBudgetUsed가 실사용량을 과대평가한다.
const FMP_CALLS_PER_TAB_EQUITY = 3;
const FMP_CALLS_PER_TAB_CRYPTO = 1;

const CRYPTO_SYMBOL_SET = new Set<string>(POPULAR_CRYPTOS);

// findGeneratedAtMap(api.ts)이 UPPERCASE 심볼로 키를 저장/조회하므로
// 여기서도 대문자화해야 한다 — 소문자 심볼이 유입되면(현재는 화이트리스트가
// 우연히 전부 대문자라 드러나지 않음) freshness lookup이 항상 miss한다.
function snapshotKey(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol.toUpperCase()}:${tab}`;
}

/**
 * SEO pre-warm 배치 오케스트레이터 (spec 2026-07-24 §6~§8, Task 9).
 *
 * select(우리 스냅샷 테이블 기준 stale 심볼 선별) → run(탭별 seam force=false
 * 호출) → harvest(cached 결과 upsert) → revalidate(전 탭 fresh 시 태그/경로
 * 무효화) 순으로 진행한다. 유닛(심볼×탭) 단위로 에러를 격리해 하나가 실패해도
 * 배치 전체는 중단되지 않는다(fail-open — 오래된 스냅샷이 그대로 남을 뿐).
 */
export async function runPrewarmBatch(): Promise<PrewarmBatchCounts> {
    const boundary = lastCompletedEtCloseWithBuffer(new Date());
    const universe = buildPrewarmUniverse();
    const repo = new DrizzleSeoSnapshotRepository(getDatabaseClient().db);
    const generatedAtMap = await repo.findGeneratedAtMap(
        universe.map(u => u.symbol)
    );

    const staleSymbols = universe.filter(u =>
        u.tabs.some(
            tab =>
                !isSnapshotFresh(
                    generatedAtMap.get(snapshotKey(u.symbol, tab)),
                    boundary
                )
        )
    );

    const batch = staleSymbols.slice(0, SYMBOLS_PER_TICK);
    const counts: PrewarmBatchCounts = {
        submitted: 0,
        harvested: 0,
        revalidated: 0,
        remaining: Math.max(0, staleSymbols.length - batch.length),
        fmpBudgetUsed: 0,
    };

    // 심볼당 .catch로 에러를 흡수해 processSymbol이 절대 reject하지 않게 만든 뒤
    // withConcurrencyLimit에 위임한다 — 격리는 이 .catch가 보장하므로
    // Promise.allSettled 기반 청크 처리와도 동일하게 안전하다.
    await withConcurrencyLimit(batch, SYMBOL_CONCURRENCY, u =>
        processSymbol(u, boundary, generatedAtMap, repo, counts).catch(
            error => {
                console.error(`[seo-prewarm] ${u.symbol} failed:`, error);
            }
        )
    );

    counts.fmpBudgetUsed = await getFmpBudgetUsed();
    return counts;
}

async function processSymbol(
    u: PrewarmSymbol,
    boundary: Date,
    generatedAtMap: Map<string, Date>,
    repo: DrizzleSeoSnapshotRepository,
    counts: PrewarmBatchCounts
): Promise<void> {
    const { assetInfo } = await getAssetInfoResilient(u.symbol);
    const companyName = assetInfo?.name ?? u.symbol;
    const fmpSymbol = assetInfo?.fmpSymbol;

    let freshTabCount = 0;
    // 실제로 TAB_SEAMS[tab]을 호출한(=FMP 호출이 발생했을 수 있는) 탭 수.
    // 이미 fresh거나 in-flight로 스킵된 탭은 seam이 아예 안 불리므로 제외한다.
    let seamsRunForSymbol = 0;

    for (const tab of TAB_ORDER) {
        if (!u.tabs.includes(tab)) continue;

        const alreadyFresh = isSnapshotFresh(
            generatedAtMap.get(snapshotKey(u.symbol, tab)),
            boundary
        );
        if (alreadyFresh) {
            freshTabCount++;
            continue;
        }

        if (await isInFlight(u.symbol, tab)) continue;

        seamsRunForSymbol++;
        try {
            const result = await TAB_SEAMS[tab]({
                symbol: u.symbol,
                companyName,
                fmpSymbol,
            });
            const harvested = await resolveHarvest(
                u.symbol,
                tab,
                result,
                repo,
                counts
            );
            if (harvested) freshTabCount++;
        } catch (error) {
            if (getFmpErrorStatus(error) === 402) {
                // 402는 심볼 단위 이슈(플랜/쿼터) — 배치 중단 사유가 아니다.
                console.error(`[seo-prewarm] fmp-402 ${u.symbol}:${tab}`);
            } else {
                console.error(
                    `[seo-prewarm] unit-error ${u.symbol}:${tab}`,
                    error
                );
            }
            // 오래된 스냅샷이 그대로 남는다(fail-open) — 여기서 rethrow하지 않는다.
        }
    }

    if (seamsRunForSymbol > 0) {
        const fmpCallsPerTab = CRYPTO_SYMBOL_SET.has(u.symbol.toUpperCase())
            ? FMP_CALLS_PER_TAB_CRYPTO
            : FMP_CALLS_PER_TAB_EQUITY;
        await addFmpBudget(fmpCallsPerTab * seamsRunForSymbol);
    }

    if (u.tabs.length > 0 && freshTabCount === u.tabs.length) {
        // pages는 이 단계에서 스냅샷을 읽지 않는다 — revalidatePath는 동일한
        // HTML을 재생성만 하는 순수 ISR-write 비용이다. revalidateTag는
        // `seo-snapshot:{symbol}` 태그의 정확한 무효화 지점으로, render 단계가
        // 이 태그의 소비자를 추가하기 전까지는 무해한 no-op이다.
        revalidateTag(`seo-snapshot:${u.symbol.toUpperCase()}`, 'max');
        counts.revalidated++;
    }
}
