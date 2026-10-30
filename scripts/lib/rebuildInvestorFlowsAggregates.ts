import { INVESTOR_FLOWS_UPSERT_CHUNK_SIZE } from '../../src/entities/investor-flows/lib/investorFlowsPolicy';
import { positionsRetentionFloor } from '../../src/entities/investor-flows/lib/investorFlowsDates';
import { aggregateModeFor } from '../../src/entities/investor-flows/server/ingest13fAggregates';

/**
 * 수급 13F 집계(`sec_13f_aggregates`) 전체 재계산의 순수 흐름. DB·CLI는 `scripts/rebuild-investor-flows-aggregates.ts`가
 * 주입한다.
 *
 * 언제 필요한가: 집계는 "바뀐 (cusip, period)만" 다시 계산하므로, **비교 정의·baseline 규칙을 바꾸거나**
 * (`INVESTOR_FLOWS_BASELINE_MIN_FILERS`, 완결/패널 모드) 백필 범위를 늘려 이전 분기 포지션이 새로 생겼거나, 집계 SQL을
 * 고쳤을 때 이미 계산된 행이 옛 규칙에 묶여 남는다. 이 흐름이 모든 분기를 오래된 순으로, CUSIP을 청크로 나눠 다시
 * 계산한다. 분기마다 모드 판정은 수집기와 같은 `aggregateModeFor`를 쓴다(규칙이 한 곳에만 있다).
 *
 * `reset`: baseline 규칙이 **엄격해져** 예전엔 기준이 있던 분기가 이제 없는 분기가 됐을 때, 그 분기의 변화 열을
 * 먼저 NULL로 되돌린다(기준 없는 재계산은 이미 기준 있던 행을 덮어쓰지 않으므로 — 거짓 변화가 남지 않게).
 */

export interface RebuildAggregatesDeps {
    /** 포지션 또는 집계가 있는 모든 분기(오름차순). */
    listPeriods(): Promise<string[]>;
    /**
     * `period`에 포지션이 있거나 집계 행이 있는 CUSIP을 `afterCusip` 다음부터 `limit`개(오름차순).
     * 집계 행만 남은 CUSIP도 포함해야 한다 — 포지션이 사라진 옛 행을 재계산이 지운다.
     */
    listCusips(
        period: string,
        afterCusip: string,
        limit: number
    ): Promise<string[]>;
    countProcessedFilersForPeriod(period: string): Promise<number>;
    recomputeAggregates(
        period: string,
        cusips: readonly string[],
        mode: 'complete' | 'panel' | 'none'
    ): Promise<void>;
    /** 한 분기의 변화 열을 NULL로. 바뀐 행 수. */
    resetAggregateChanges(period: string): Promise<number>;
    log: (message: string) => void;
}

export interface RebuildAggregatesOptions {
    today: string;
    /** true면 계산은 하지 않고 분기별 계획(CUSIP 수·모드)만 센다. */
    dryRun: boolean;
    /** true면 기준이 없는 분기의 변화 열을 먼저 NULL로 되돌린다. */
    reset?: boolean;
    chunkSize?: number;
}

export interface RebuildAggregatesResult {
    periods: {
        period: string;
        cusips: number;
        chunks: number;
        mode: 'complete' | 'panel' | 'none';
        reset: number;
    }[];
    dryRun: boolean;
}

export async function rebuildAggregates(
    deps: RebuildAggregatesDeps,
    options: RebuildAggregatesOptions
): Promise<RebuildAggregatesResult> {
    const chunkSize = options.chunkSize ?? INVESTOR_FLOWS_UPSERT_CHUNK_SIZE;
    const floor = positionsRetentionFloor(options.today);
    const result: RebuildAggregatesResult = {
        periods: [],
        dryRun: options.dryRun,
    };

    for (const period of await deps.listPeriods()) {
        const mode = await aggregateModeFor(deps, period, floor, options.today);
        let reset = 0;
        if (options.reset && mode === 'none' && !options.dryRun) {
            reset = await deps.resetAggregateChanges(period);
        }
        let after = '';
        let cusips = 0;
        let chunks = 0;
        for (;;) {
            // 키셋 페이지는 앞 페이지의 마지막 CUSIP에 의존해 직렬이다.
            const page = await deps.listCusips(period, after, chunkSize);
            if (page.length === 0) break;
            if (!options.dryRun) {
                await deps.recomputeAggregates(period, page, mode);
            }
            after = page[page.length - 1] as string;
            cusips += page.length;
            chunks += 1;
        }
        deps.log(
            `${options.dryRun ? '[dry-run] ' : ''}${period}: ${cusips} cusips in ${chunks} chunk(s), mode=${mode}${reset > 0 ? `, reset ${reset} rows` : ''}`
        );
        result.periods.push({ period, cusips, chunks, mode, reset });
    }
    return result;
}
