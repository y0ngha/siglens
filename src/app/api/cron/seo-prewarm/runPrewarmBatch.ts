import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import {
    buildPrewarmUniverse,
    type PrewarmSymbol,
} from '@/entities/seo-snapshot/lib/applicability';
import {
    isSnapshotFresh,
    lastCompletedEtCloseWithBuffer,
} from '@/entities/seo-snapshot/lib/freshness';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getFmpErrorStatus } from '@/shared/api/fmp/fmpUserMessage';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { addFmpBudget, getFmpBudgetUsed, isInFlight } from './lock';
import { TAB_PATHS, TAB_SEAMS, resolveHarvest } from './harvest';

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
// spec §8 추정치 — 모니터링용, 정밀 계측 아님.
const FMP_CALLS_PER_EQUITY = 22;
const FMP_CALLS_PER_CRYPTO = 2;

const CRYPTO_SYMBOL_SET = new Set<string>(POPULAR_CRYPTOS);

function snapshotKey(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol}:${tab}`;
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

    for (let i = 0; i < batch.length; i += SYMBOL_CONCURRENCY) {
        const chunk = batch.slice(i, i + SYMBOL_CONCURRENCY);
        await Promise.all(
            chunk.map(u =>
                processSymbol(u, boundary, generatedAtMap, repo, counts).catch(
                    error => {
                        console.error(
                            `[seo-prewarm] ${u.symbol} failed:`,
                            error
                        );
                    }
                )
            )
        );
    }

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

    const fmpCalls = CRYPTO_SYMBOL_SET.has(u.symbol.toUpperCase())
        ? FMP_CALLS_PER_CRYPTO
        : FMP_CALLS_PER_EQUITY;
    await addFmpBudget(fmpCalls);

    if (u.tabs.length > 0 && freshTabCount === u.tabs.length) {
        revalidateTag(`seo-snapshot:${u.symbol}`, 'max');
        for (const tab of u.tabs) {
            revalidatePath(TAB_PATHS[tab](u.symbol));
        }
        counts.revalidated++;
    }
}
