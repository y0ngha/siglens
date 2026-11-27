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
import {
    isHubGuide,
    SIGNAL_HUBS,
} from '@/entities/signal-history/lib/signalHubs';
import type { SignalLatestEpisodeRow } from '@/entities/signal-history/types';
import { GUIDE_PATH_BY_TRIGGER } from '@/shared/config/guideLinks.generated';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { guideEntryPath } from '@/shared/lib/guidePaths';

/** 모듈이 나눠 보여 주는 주식 시장. 그룹은 `us` → `kr` 순으로 나온다(`selectLiveSymbols`). */
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

/** 모듈의 종목 한 행. 스캐너·신호 기록·스냅샷 세 데이터원을 한 모양으로 맞춰 컴포넌트가 출처를 몰라도 그리게 한다. */
export interface LiveSymbolRow {
    readonly symbol: string;
    /** 한국어 이름. 스캐너 행은 스캐너가 준 이름, 스냅샷 행은 이름을 모른다(null) — 로더가 {@link withDisplayNames}로 채운다. */
    readonly name: string | null;
    /** 스캐너 행만 안다. */
    readonly changePercent: number | null;
    /**
     * `scanner`는 스캐너, `history`는 신호 기록(`signal_events`), `snapshot`은 장 마감 스냅샷이다.
     * 기록 행의 등락률은 첫 포착일의 값이라 "지금"의 시세로 읽히지 않게 `changePercent`를 비운다.
     */
    readonly basis: 'scanner' | 'history' | 'snapshot';
    /** ISO 8601 — 스캐너는 `computedAt`, 스냅샷은 `generatedAt`, 기록은 첫 포착 세션(`T00:00:00.000Z`). */
    readonly detectedOn: string;
    /**
     * 신호 기록 행만 안다 — 에피소드가 처음 포착된 세션(`YYYY-MM-DD`). 실제 교차일보다 늦을 수 있어
     * 화면은 "기록 기준"이라고 적는다.
     */
    readonly firstSeenSession: string | null;
    /** 무엇에 맞아 뽑혔는지. 스냅샷 행은 자기가 적중한 패턴의 가이드로 라벨링한다(가이드가 없는 패턴뿐이면 null). */
    readonly match: LiveMatch | null;
}

/** 한 시장의 행 묶음. 행이 없는 시장은 그룹을 만들지 않아, 컴포넌트는 빈 시장 제목을 걸러낼 필요가 없다. */
export interface LiveSymbolGroup {
    readonly market: LiveMarket;
    readonly rows: readonly LiveSymbolRow[];
}

/** 항목이 찾는 대상 — 스캐너 신호 종류와 차트 패턴 id. 로더가 패턴 id가 있을 때만 스냅샷을 조회하는 근거다. */
export interface LiveTargets {
    readonly signalTypes: readonly SignalType[];
    /** core 차트 패턴 id(`PatternSummary.patternName`, 예: `double_bottom`). */
    readonly patternNames: readonly string[];
}

/** 장 마감 스냅샷 한 건에서 맞은 패턴. 로더가 캐시에 담는 모양이기도 해, 필드를 바꾸면 캐시 키 버전도 올린다. */
export interface SnapshotPatternHit {
    readonly symbol: string;
    readonly generatedAt: string;
    /** 요청한 패턴 id 중 이 스냅샷에서 탐지된 것. */
    readonly detectedPatterns: readonly string[];
}

/** 한 시장의 스캐너 결과. 로더는 스캐너를 못 읽은 시장을 빼고 넘긴다. */
export interface ScannerInput {
    readonly market: LiveMarket;
    readonly result: SectorSignalsResult;
}

/** 한 시장의 신호 기록 행(최근 완료 세션까지 이어진 에피소드). */
export interface HistoryInput {
    readonly market: LiveMarket;
    readonly rows: readonly SignalLatestEpisodeRow[];
}

/** {@link selectLiveSymbols}의 입력. */
export interface SelectLiveSymbolsInput {
    readonly targets: LiveTargets;
    readonly scanner: readonly ScannerInput[];
    /** 시장마다 스캐너와 기록 중 한쪽만 넘긴다(로더가 기록이 비면 그 시장은 스캐너로 대신한다). */
    readonly history?: readonly HistoryInput[];
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

/** 모듈이 대상을 뽑는 항목들 — howto는 `about`이 가리키는 항목들, 나머지는 자기 자신. */
function liveSources(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): GuideEntry[] {
    if (entry.category !== 'howto') return [entry];
    const bySlug = new Map(catalog.map(e => [e.slug, e]));
    return entry.about.flatMap(slug => {
        const target = bySlug.get(slug);
        return target === undefined ? [] : [target];
    });
}

/**
 * 이 항목이 설명하는 신호의 신호 페이지(`SIGNAL_HUBS[].guide`의 역방향) 슬러그. 허브가 가이드를 가리키는
 * 방향만 있던 것을 가이드 쪽에서도 링크로 이어, 가이드 → 허브 내부 링크를 서버 HTML에 둔다. 모듈이 보여 주는
 * 대상(`liveSources`)과 같은 항목에서 뽑으므로 howto도 설명 대상 항목의 허브를 얻는다. 없으면 `[]`.
 */
export function hubSlugsFor(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): string[] {
    const sources = liveSources(entry, catalog);
    return SIGNAL_HUBS.filter(hub =>
        sources.some(source => isHubGuide(hub, source))
    ).map(hub => hub.slug);
}

/**
 * 항목이 모듈에서 보여 줄 대상. howto는 자기 `signals` + `about` 항목들의 것, 용어 항목은 자기 것.
 * 패턴 id는 **차트 패턴 카테고리**에서만 뽑는다 — free 스냅샷에 캔들은 없고 전략은 탐지 플래그가 없다.
 */
export function resolveLiveTargets(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): LiveTargets {
    const sources = liveSources(entry, catalog);
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
                    firstSeenSession: null,
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
 * 신호 기록 행 — 종목마다 하나. 같은 종목의 에피소드가 여럿이면 입력 순서(처음 포착이 가장 최근인 순)의
 * 첫 행이다. 기록에는 확정된 에피소드만 있어 항상 confirmed 순위다.
 */
function historyRows(
    input: HistoryInput,
    signalTypes: ReadonlySet<SignalType>
): RankedRow[] {
    return input.rows.flatMap(episode => {
        const signalType = [...signalTypes].find(t => t === episode.signalType);
        if (signalType === undefined) return [];
        return [
            {
                phase: 'confirmed' as const,
                row: {
                    symbol: episode.symbol,
                    name: episode.koreanName,
                    changePercent: null,
                    basis: 'history' as const,
                    detectedOn: `${episode.sessionDate}T00:00:00.000Z`,
                    firstSeenSession: episode.sessionDate,
                    match: {
                        kind: 'signal' as const,
                        signalType,
                        expected: false,
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
    history = [],
}: SelectLiveSymbolsInput): LiveSymbolGroup[] {
    const signalTypes = new Set(targets.signalTypes);
    const patternFirst = targets.patternNames.length > 0;
    const rank = phaseRank(patternFirst);
    // 스캐너 행과 기록 행은 둘 다 "신호가 맞은 종목"이다 — 같은 순위 규칙과 스냅샷 병합을 쓴다.
    const scannerRanked = [
        ...scanner.flatMap(input => scannerRows(input, signalTypes)),
        ...history.flatMap(input => historyRows(input, signalTypes)),
    ];
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
                      firstSeenSession: null,
                      match: patternMatch(targets.patternNames, hit),
                  },
              }))
            : []),
    ];
    // 같은 종목의 행이 여럿(기록의 에피소드)이면 입력 순서의 첫 행이 이긴다 — 거꾸로 채워 첫 행이 남게 한다.
    const scannerBySymbol = new Map(
        scannerRanked.toReversed().map(({ row }) => [row.symbol, row])
    );

    const sorted = ranked.toSorted(
        (a, b) =>
            rank[a.phase] - rank[b.phase] ||
            Math.abs(b.row.changePercent ?? 0) -
                Math.abs(a.row.changePercent ?? 0)
    );
    // 같은 종목은 정렬상 가장 앞선 행 하나만 남긴다. 거꾸로 채운 Map은 뒤 항목을 앞 항목이
    // 덮어써 종목마다 첫 행이 남고, 거르기는 정렬 순서를 그대로 지킨다(O(n)).
    const firstBySymbol = new Map(
        sorted.toReversed().map(entry => [entry.row.symbol, entry])
    );
    const deduped = sorted
        .filter(entry => firstBySymbol.get(entry.row.symbol) === entry)
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
