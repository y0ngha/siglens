import type { MarketNewsItem } from './marketNewsClientPort';

interface SelectAnalysisCandidatesInput {
    /** 이번에 받은 피드. */
    readonly fresh: readonly MarketNewsItem[];
    /** upsert가 성공해 DB 행이 있는 기사 id. */
    readonly upsertedIds: ReadonlySet<string>;
    /** 조회 창 안에서 이미 보강된 기사 id. */
    readonly analyzedIds: ReadonlySet<string>;
    /** 생략하면 후보 전부. */
    readonly analyzeLimit?: number;
}

interface AnalysisCandidates {
    /** 이번에 보강할 기사. */
    readonly selected: MarketNewsItem[];
    /** `analyzeLimit`에 잘려 이번에 보강하지 못한 후보 수. */
    readonly pending: number;
}

/**
 * 카드 보강 대상을 고른다 — upsert에 성공했고 아직 보강되지 않은 기사만, 피드 순서대로
 * `analyzeLimit`개까지.
 *
 * upsert가 실패한 기사는 `attachAnalysis`가 "행 없음"으로 실패할 것이라 LLM 비용만
 * 쓰므로 후보에서 뺀다. 피드는 델타가 아니라 7일 창 전체를 주므로 잘려 남은 기사는
 * 다음 적재에서 다시 후보가 된다.
 */
export function selectAnalysisCandidates({
    fresh,
    upsertedIds,
    analyzedIds,
    analyzeLimit,
}: SelectAnalysisCandidatesInput): AnalysisCandidates {
    const candidates = fresh.filter(
        item => upsertedIds.has(item.id) && !analyzedIds.has(item.id)
    );
    const selected =
        analyzeLimit === undefined
            ? candidates
            : candidates.slice(0, analyzeLimit);
    return { selected, pending: candidates.length - selected.length };
}
