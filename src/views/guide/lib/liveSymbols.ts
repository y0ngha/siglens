/**
 * 가이드 항목의 "지금 이 신호가 나온 종목" 모듈이 보여 줄 종목 고르기 — 스캐너 신호와 장 마감 스냅샷의
 * 패턴 적중을 합쳐 시장별로 줄 세운다(순수 함수).
 */
import type {
    SectorSignalsResult,
    SignalType,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import type { GuideEntry } from '@/entities/guide/types';
import { GUIDE_PATH_BY_TRIGGER } from '@/shared/config/guideLinks.generated';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { guideEntryPath } from '@/shared/lib/guidePaths';

/** 모듈이 나눠 보여 주는 주식 시장. */
export type LiveMarket = 'us' | 'kr';

/**
 * 행이 왜 뽑혔는지. 컴포넌트가 라벨로 풀어 쓴다(이 모듈은 순수라 번역에 닿지 않는다).
 * `signal`은 스캐너에서 맞은 대상 신호, `pattern`은 스냅샷에서 맞은 차트 패턴 가이드 경로다.
 */
export type LiveMatch =
    | {
          readonly kind: 'signal';
          readonly signalType: SignalType;
          /** `true`면 아직 확정(confirmed)되지 않은 예상(expected) 신호다. */
          readonly expected: boolean;
      }
    | { readonly kind: 'pattern'; readonly guidePath: string };

/** 모듈의 종목 한 행. */
export interface LiveSymbolRow {
    readonly symbol: string;
    /** 한국어 이름. 스캐너 행은 스캐너가 준 이름, 스냅샷 행은 이름을 모른다(null) — 로더가 {@link withDisplayNames}로 채운다. */
    readonly name: string | null;
    /** 스캐너 행만 안다. */
    readonly changePercent: number | null;
    readonly basis: 'scanner' | 'snapshot';
    /** ISO 8601 — 스캐너는 `computedAt`, 스냅샷은 `generatedAt`. */
    readonly detectedOn: string;
    /** 무엇에 맞아 뽑혔는지. 스냅샷 행은 자기가 적중한 패턴의 가이드로 라벨링한다(가이드가 없는 패턴뿐이면 null). */
    readonly match: LiveMatch | null;
}

/** 한 시장의 행 묶음. */
export interface LiveSymbolGroup {
    readonly market: LiveMarket;
    readonly rows: readonly LiveSymbolRow[];
}

/** 항목이 찾는 대상 — 스캐너 신호 종류와 차트 패턴 id. */
export interface LiveTargets {
    readonly signalTypes: readonly SignalType[];
    /** core 차트 패턴 id(`PatternSummary.patternName`, 예: `double_bottom`). */
    readonly patternNames: readonly string[];
}

/** 장 마감 스냅샷 한 건에서 맞은 패턴. */
export interface SnapshotPatternHit {
    readonly symbol: string;
    readonly generatedAt: string;
    /** 요청한 패턴 id 중 이 스냅샷에서 탐지된 것. */
    readonly detectedPatterns: readonly string[];
}

/** 한 시장의 스캐너 결과. */
export interface ScannerInput {
    readonly market: LiveMarket;
    readonly result: SectorSignalsResult;
}

/** {@link selectLiveSymbols}의 입력. */
export interface SelectLiveSymbolsInput {
    readonly targets: LiveTargets;
    readonly scanner: readonly ScannerInput[];
    readonly snapshotHits: readonly SnapshotPatternHit[];
    readonly limitPerMarket: number;
}

/** 가이드 경로 → 그 경로를 가리키는 탐지 id 목록. 모듈 로드 때 한 번 뒤집는다. */
const TRIGGERS_BY_PATH: ReadonlyMap<string, readonly string[]> = new Map(
    [
        ...Map.groupBy(
            Object.entries(GUIDE_PATH_BY_TRIGGER),
            ([, path]) => path
        ),
    ].map(([path, pairs]) => [path, pairs.map(([triggerId]) => triggerId)])
);

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

type Phase = 'confirmed' | 'expected' | 'snapshot';

/**
 * 정렬 순위. 기본은 confirmed → expected → snapshot이다. 항목이 차트 패턴을 다루면(`patternNames`가 있으면)
 * 사용자가 찾는 것은 그 패턴이므로 스냅샷 패턴 적중을 스캐너 행보다 앞에 둔다.
 */
function phaseRank(patternFirst: boolean): Readonly<Record<Phase, number>> {
    return patternFirst
        ? { snapshot: 0, confirmed: 1, expected: 2 }
        : { confirmed: 0, expected: 1, snapshot: 2 };
}

interface RankedRow {
    readonly row: LiveSymbolRow;
    readonly phase: Phase;
}

function scannerRows(
    input: ScannerInput,
    signalTypes: ReadonlySet<SignalType>
): RankedRow[] {
    return input.result.stocks.flatMap((stock: StockSignalResult) => {
        const matching = stock.signals.filter(signal =>
            signalTypes.has(signal.type)
        );
        // 확정 신호가 있으면 그것을, 없으면 처음 맞은 예상 신호를 보여 준다.
        const shown =
            matching.find(signal => signal.phase === 'confirmed') ??
            matching[0];
        if (shown === undefined) return [];
        const confirmed = shown.phase === 'confirmed';
        return [
            {
                phase: confirmed
                    ? ('confirmed' as const)
                    : ('expected' as const),
                row: {
                    symbol: stock.symbol,
                    name: stock.koreanName,
                    changePercent: stock.changePercent,
                    basis: 'scanner' as const,
                    detectedOn: input.result.computedAt,
                    match: {
                        kind: 'signal' as const,
                        signalType: shown.type,
                        expected: !confirmed,
                    },
                },
            },
        ];
    });
}

/**
 * 스냅샷 행이 적중한 패턴 중 가이드 경로가 있는 첫 번째를 돌려준다. 순서는 대상 패턴 순서(`targets.patternNames`)를
 * 따라 같은 입력이면 같은 라벨이 나온다.
 */
function hitPatternPath(
    targetPatterns: readonly string[],
    hit: SnapshotPatternHit
): string | null {
    const detected = new Set(hit.detectedPatterns);
    return (
        targetPatterns
            .filter(name => detected.has(name))
            .map(name => GUIDE_PATH_BY_TRIGGER[name])
            .find(guidePath => guidePath !== undefined) ?? null
    );
}

function patternMatch(
    targetPatterns: readonly string[],
    hit: SnapshotPatternHit
): LiveMatch | null {
    const guidePath = hitPatternPath(targetPatterns, hit);
    return guidePath === null ? null : { kind: 'pattern', guidePath };
}

/**
 * 고른 행에 이름을 입힌다. `names`(심볼 → 한국어 이름)에 있으면 그것을, 없으면 행이 이미 가진 이름을 둔다.
 * 스캐너 행의 이름보다 `names`를 앞세우는 이유: 정본 한글명 오버라이드가 한 곳(`getKoreanNames` 계열)에서만 적용되어
 * 화면마다 이름이 갈리지 않는다.
 */
export function withDisplayNames(
    groups: readonly LiveSymbolGroup[],
    names: Readonly<Record<string, string>>
): LiveSymbolGroup[] {
    return groups.map(group => ({
        ...group,
        rows: group.rows.map(row => ({
            ...row,
            name: names[row.symbol] ?? row.name,
        })),
    }));
}

/**
 * 주식 두 시장만 가른다. 크립토는 여기 오지 않는다 — 스캐너는 `SCANNER_MARKETS`(us·kr)만 읽고,
 * 스냅샷 조회는 `POPULAR_CRYPTOS`를 WHERE에서 뺀다(가이드 본문이 주식 전제라서).
 */
function marketOf(symbol: string): LiveMarket {
    return isKrEquitySymbol(symbol) ? 'kr' : 'us';
}

/**
 * 두 데이터원을 한 목록으로 합친다. 같은 종목은 한 행으로 접고, 가격 변동을 아는 스캐너 행의 데이터를 쓰되
 * 더 앞선 순위의 `match`를 따른다.
 * 정렬: 기본 confirmed → expected → 스냅샷. 차트 패턴 대상이 있으면 스냅샷 → confirmed → expected.
 * 같은 순위 안에서는 |changePercent| 큰 순. 시장은 `us` → `kr`.
 */
export function selectLiveSymbols({
    targets,
    scanner,
    snapshotHits,
    limitPerMarket,
}: SelectLiveSymbolsInput): LiveSymbolGroup[] {
    const signalTypes = new Set(targets.signalTypes);
    const patternFirst = targets.patternNames.length > 0;
    const rank = phaseRank(patternFirst);
    const scannerRanked = scanner.flatMap(input =>
        scannerRows(input, signalTypes)
    );
    const ranked: RankedRow[] = [
        ...scannerRanked,
        ...(patternFirst
            ? snapshotHits.map(hit => ({
                  phase: 'snapshot' as const,
                  row: {
                      symbol: hit.symbol,
                      name: null,
                      changePercent: null,
                      basis: 'snapshot' as const,
                      detectedOn: hit.generatedAt,
                      match: patternMatch(targets.patternNames, hit),
                  },
              }))
            : []),
    ];
    const scannerBySymbol = new Map(
        scannerRanked.map(({ row }) => [row.symbol, row])
    );

    const sorted = ranked.toSorted(
        (a, b) =>
            rank[a.phase] - rank[b.phase] ||
            Math.abs(b.row.changePercent ?? 0) -
                Math.abs(a.row.changePercent ?? 0)
    );
    // 같은 종목은 정렬상 가장 앞선 행 하나만 남긴다.
    const deduped = sorted
        .filter(
            ({ row }, index) =>
                sorted.findIndex(other => other.row.symbol === row.symbol) ===
                index
        )
        .map(({ row }) => {
            const known = scannerBySymbol.get(row.symbol);
            return known === undefined || known === row
                ? row
                : { ...known, match: row.match ?? known.match };
        });

    const markets: readonly LiveMarket[] = ['us', 'kr'];
    return markets.flatMap(market => {
        const rows = deduped
            .filter(row => marketOf(row.symbol) === market)
            .slice(0, limitPerMarket);
        return rows.length === 0 ? [] : [{ market, rows }];
    });
}
