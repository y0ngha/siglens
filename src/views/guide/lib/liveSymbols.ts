import type {
    SectorSignalsResult,
    SignalType,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import type { GuideEntry } from '@/entities/guide/types';
import { GUIDE_PATH_BY_TRIGGER } from '@/shared/config/guideLinks.generated';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { guideEntryPath } from '@/shared/lib/guidePaths';

export type LiveMarket = 'us' | 'kr';

export interface LiveSymbolRow {
    readonly symbol: string;
    /** 스캐너 행은 한국어 이름, 스냅샷 행은 이름을 모른다(null). */
    readonly name: string | null;
    /** 스캐너 행만 안다. */
    readonly changePercent: number | null;
    readonly basis: 'scanner' | 'snapshot';
    /** ISO 8601 — 스캐너는 `computedAt`, 스냅샷은 `generatedAt`. */
    readonly detectedOn: string;
}

export interface LiveSymbolGroup {
    readonly market: LiveMarket;
    readonly rows: readonly LiveSymbolRow[];
}

export interface LiveTargets {
    readonly signalTypes: readonly SignalType[];
    /** core 차트 패턴 id(`PatternSummary.patternName`, 예: `double_bottom`). */
    readonly patternNames: readonly string[];
}

export interface SnapshotPatternHit {
    readonly symbol: string;
    readonly generatedAt: string;
}

export interface ScannerInput {
    readonly market: LiveMarket;
    readonly result: SectorSignalsResult;
}

export interface SelectLiveSymbolsInput {
    readonly targets: LiveTargets;
    readonly scanner: readonly ScannerInput[];
    readonly snapshotHits: readonly SnapshotPatternHit[];
    readonly limitPerMarket: number;
}

/** 가이드 경로 → 그 경로를 가리키는 탐지 id 목록. 모듈 로드 때 한 번 뒤집는다. */
const TRIGGERS_BY_PATH: ReadonlyMap<string, readonly string[]> = (() => {
    const map = new Map<string, string[]>();
    for (const [triggerId, path] of Object.entries(GUIDE_PATH_BY_TRIGGER)) {
        const list = map.get(path) ?? [];
        list.push(triggerId);
        map.set(path, list);
    }
    return map;
})();

function unique<T>(values: readonly T[]): T[] {
    return [...new Set(values)];
}

/**
 * 항목이 모듈에서 보여 줄 대상. howto는 자기 `signals` + `about` 항목들의 것, 용어 항목은 자기 것.
 * 패턴 id는 **차트 패턴 카테고리**에서만 뽑는다 — free 스냅샷에 캔들은 없고 전략은 탐지 플래그가 없다.
 */
export function resolveLiveTargets(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): LiveTargets {
    const bySlug = new Map(catalog.map(e => [e.slug, e]));
    const sources =
        entry.category === 'howto'
            ? entry.about.flatMap(slug => {
                  const target = bySlug.get(slug);
                  return target === undefined ? [] : [target];
              })
            : [entry];
    const patternNames = unique(
        sources
            .filter(source => source.category === 'chart-patterns')
            .flatMap(
                source =>
                    TRIGGERS_BY_PATH.get(
                        guideEntryPath(source.category, source.slug)
                    ) ?? []
            )
    );
    const signalTypes = unique([
        ...entry.signals,
        ...sources.flatMap(source => source.signals),
    ]);
    return { signalTypes, patternNames };
}

const PHASE_RANK = { confirmed: 0, expected: 1, snapshot: 2 } as const;

interface RankedRow {
    readonly row: LiveSymbolRow;
    readonly rank: (typeof PHASE_RANK)[keyof typeof PHASE_RANK];
}

function scannerRows(
    input: ScannerInput,
    signalTypes: ReadonlySet<SignalType>
): RankedRow[] {
    return input.result.stocks.flatMap((stock: StockSignalResult) => {
        const matching = stock.signals.filter(signal =>
            signalTypes.has(signal.type)
        );
        if (matching.length === 0) return [];
        const confirmed = matching.some(signal => signal.phase === 'confirmed');
        return [
            {
                rank: confirmed ? PHASE_RANK.confirmed : PHASE_RANK.expected,
                row: {
                    symbol: stock.symbol,
                    name: stock.koreanName,
                    changePercent: stock.changePercent,
                    basis: 'scanner' as const,
                    detectedOn: input.result.computedAt,
                },
            },
        ];
    });
}

function marketOf(symbol: string): LiveMarket {
    return isKrEquitySymbol(symbol) ? 'kr' : 'us';
}

/**
 * 두 데이터원을 한 목록으로 합친다. 같은 종목은 스캐너 행이 이긴다(가격 변동을 안다).
 * 정렬: confirmed → expected → 스냅샷, 그 안에서 |changePercent| 큰 순. 시장은 `us` → `kr`.
 */
export function selectLiveSymbols({
    targets,
    scanner,
    snapshotHits,
    limitPerMarket,
}: SelectLiveSymbolsInput): LiveSymbolGroup[] {
    const signalTypes = new Set(targets.signalTypes);
    const ranked: RankedRow[] = [
        ...scanner.flatMap(input => scannerRows(input, signalTypes)),
        ...(targets.patternNames.length === 0
            ? []
            : snapshotHits.map(hit => ({
                  rank: PHASE_RANK.snapshot,
                  row: {
                      symbol: hit.symbol,
                      name: null,
                      changePercent: null,
                      basis: 'snapshot' as const,
                      detectedOn: hit.generatedAt,
                  },
              }))),
    ];

    const seen = new Set<string>();
    const deduped = ranked
        .toSorted(
            (a, b) =>
                a.rank - b.rank ||
                Math.abs(b.row.changePercent ?? 0) -
                    Math.abs(a.row.changePercent ?? 0)
        )
        .filter(({ row }) => {
            if (seen.has(row.symbol)) return false;
            seen.add(row.symbol);
            return true;
        });

    const markets: readonly LiveMarket[] = ['us', 'kr'];
    return markets.flatMap(market => {
        const rows = deduped
            .filter(({ row }) => marketOf(row.symbol) === market)
            .slice(0, limitPerMarket)
            .map(({ row }) => row);
        return rows.length === 0 ? [] : [{ market, rows }];
    });
}
