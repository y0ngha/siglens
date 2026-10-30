import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import type { SeoAnalysisSnapshot, SeoSnapshotTab } from '../model';

/**
 * 탭마다 `isBetter`가 가장 앞선다고 판정한 행 하나만 남긴다. 결과 순서는 각 탭이 처음
 * 등장한 순서다.
 */
function bestPerTab(
    snapshots: readonly SeoAnalysisSnapshot[],
    isBetter: (
        candidate: SeoAnalysisSnapshot,
        current: SeoAnalysisSnapshot
    ) => boolean
): SeoAnalysisSnapshot[] {
    const best = new Map<SeoSnapshotTab, SeoAnalysisSnapshot>();
    for (const snapshot of snapshots) {
        const current = best.get(snapshot.tab);
        if (current === undefined || isBetter(snapshot, current)) {
            best.set(snapshot.tab, snapshot);
        }
    }
    return [...best.values()];
}

/**
 * 탭마다 폴백 체인에서 가장 앞선 로케일의 행 하나만 남긴다. 체인에 없는 로케일(예: zh 요청에
 * ja 행)은 버린다 — 요청자가 읽을 가능성이 없는 언어를 보여 주느니 색인에서 빠지는 편이 낫다.
 *
 * SQL의 `DISTINCT ON` + `array_position` 정렬 대신 앱에서 고르는 이유: 심볼당 행이 최대
 * (탭 7 × 로케일 4)라 정렬 비용보다 쿼리 형태를 단순하게 두는 편이 낫고, 폴백 순서의 단일
 * 소스가 `CONTENT_LOCALE_FALLBACK` 한 곳에 남는다.
 */
export function pickSnapshotPerTab(
    snapshots: readonly SeoAnalysisSnapshot[],
    chain: readonly Locale[]
): SeoAnalysisSnapshot[] {
    return bestPerTab(
        snapshots.filter(snapshot => chain.includes(snapshot.locale)),
        (candidate, current) =>
            chain.indexOf(candidate.locale) < chain.indexOf(current.locale)
    );
}

/**
 * `anyLocale` 전용: 탭마다 언어와 무관하게 `generatedAt`이 가장 최신인 행 하나를 남긴다.
 * 생성 시각이 정확히 같을 때만 `tieBreak` 순서로 고른다.
 */
export function pickFreshestPerTab(
    snapshots: readonly SeoAnalysisSnapshot[],
    tieBreak: readonly Locale[]
): SeoAnalysisSnapshot[] {
    return bestPerTab(snapshots, (candidate, current) => {
        const candidateMs = candidate.generatedAt.getTime();
        const currentMs = current.generatedAt.getTime();
        return (
            candidateMs > currentMs ||
            (candidateMs === currentMs &&
                tieBreak.indexOf(candidate.locale) <
                    tieBreak.indexOf(current.locale))
        );
    });
}

/** `pickFreshestPerTab`의 동점 해소 순서: 요청 로케일 → 한국어(원본) → 나머지. */
export function anyLocaleChain(locale: Locale): readonly Locale[] {
    return [...new Set<Locale>([locale, DEFAULT_LOCALE, ...LOCALES])];
}

interface SymbolTabLocaleRow {
    readonly symbol: string;
    readonly tab: SeoSnapshotTab;
    readonly locale: Locale;
}

/**
 * `(symbol, tab)`마다 폴백 체인에서 가장 앞선 로케일의 행 하나만 남긴다. 페이지 읽기 경로
 * (`pickSnapshotPerTab`)와 같은 순서라 sitemap이 페이지가 렌더하는 행을 기준으로 삼는다.
 *
 * Set을 바꾸는 필터인 이유: `reduce` + `some`은 행마다 앞 결과를 훑어 O(N²)가 된다
 * (CONVENTIONS.md#CP-6 예외).
 */
export function pickFallbackRowPerSymbolTab<T extends SymbolTabLocaleRow>(
    rows: readonly T[],
    chain: readonly Locale[]
): T[] {
    const ranked = rows.toSorted(
        (a, b) => chain.indexOf(a.locale) - chain.indexOf(b.locale)
    );
    const seenKeys = new Set<string>();
    return ranked.filter(row => {
        const key = `${row.symbol}\u0000${row.tab}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
    });
}
