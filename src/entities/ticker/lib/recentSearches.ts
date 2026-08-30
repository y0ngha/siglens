/**
 * 최근 검색 종목을 LocalStorage에 저장/조회하는 모듈.
 *
 * 저장 단위는 `{ symbol, label }`이다. `symbol`은 이동에 필요하고 `label`은 표시용
 * 회사명이다 — 사용자에게는 `005930.KS`보다 `삼성전자`가 유의미하다.
 *
 * - 최대 {@link MAX_RECENT_SEARCHES}개까지 저장
 * - 최신 검색이 배열의 앞에 위치
 * - 동일 종목 재검색 시 기존 항목을 제거하고 최상단으로 이동 (중복 방지)
 * - SSR/테스트 환경 호환을 위해 storage 의존성을 주입 가능
 */

export const MAX_RECENT_SEARCHES = 7;

/**
 * 저장 키를 버전으로 분리한다 — **읽기 하위호환만으로는 부족하다.**
 *
 * 배포 직후 최대 24시간 동안(홈 HTML의 CF `s-maxage=86400`, `deploymentId` 미설정)
 * 일부 방문자는 여전히 **옛 번들**을 받는다. 옛 파서는 `typeof item === 'string'`으로
 * 거르므로 새 형식을 읽으면 `[]`가 되고, 그 뒤 `addRecentSearch`가 `string[]`로
 * 덮어써 **저장된 최근 검색이 통째로 사라진다**. 새 파서가 옛 형식을 승격시켜도
 * 반대 방향은 못 막는다.
 *
 * 그래서 새 형식은 새 키에만 쓴다. 두 번들이 각자의 키를 보므로 파괴가 일어나지
 * 않고, 옛 키는 지우지 않는다(아직 살아 있는 옛 번들의 데이터다). 배포 후 24시간이
 * 지나면 옛 키는 아무도 안 읽으므로 다음 정리 때 제거해도 된다.
 *
 * CDN 퍼지로 대신할 수 없다: 이 zone은 응답에 `Vary: rsc, ...`가 붙어 Cloudflare
 * URL 단위 퍼지가 동작하지 않는다(2026-08-18 실측, HTML·PNG 양쪽 확인).
 */
export const RECENT_SEARCHES_STORAGE_KEY = 'siglens:recent-searches:v2';

/** v1 키. 승격 원본으로만 읽고 절대 쓰지 않는다. */
export const LEGACY_RECENT_SEARCHES_STORAGE_KEY = 'siglens:recent-searches';

interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/** 최근 검색 한 건. `label`은 표시용 회사명(한글명 우선). */
export interface RecentSearchEntry {
    symbol: string;
    label: string;
}

/**
 * 저장된 값을 읽는다.
 *
 * **두 가지 형태를 모두 받는다.** 이 기능은 원래 `string[]`(티커)를 저장했으므로,
 * 기존 사용자의 LocalStorage에는 그 형태가 남아 있다. 문자열 항목은
 * `{ symbol, label: symbol }`로 승격시킨다 — 형태를 바꿨다고 최근 검색이 사라지면
 * 사용자 입장에선 그냥 기능이 고장 난 것이다.
 */
function parse(raw: string | null): RecentSearchEntry[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((item): RecentSearchEntry[] => {
            if (typeof item === 'string' && item.length > 0) {
                return [{ symbol: item, label: item }];
            }
            if (
                item !== null &&
                typeof item === 'object' &&
                typeof (item as RecentSearchEntry).symbol === 'string' &&
                (item as RecentSearchEntry).symbol.length > 0
            ) {
                const entry = item as RecentSearchEntry;
                // `trim()` 은 `addRecentSearch` 와 같은 판정을 쓰기 위한 것이다 —
                // 저장 시엔 공백뿐인 라벨을 심볼로 바꾸는데 읽을 때 안 바꾸면
                // 손으로 편집된 저장값이 빈 칩으로 렌더된다.
                const label =
                    typeof entry.label === 'string' ? entry.label.trim() : '';
                return [
                    {
                        symbol: entry.symbol,
                        label: label.length > 0 ? label : entry.symbol,
                    },
                ];
            }
            return [];
        });
    } catch {
        return [];
    }
}

export function getRecentSearches(
    storage: StorageLike | null = getDefaultStorage()
): RecentSearchEntry[] {
    if (!storage) return [];
    // **"비어 있음"과 "없음"을 구분한다.** v2 키가 아예 없을 때만 v1을 승격한다.
    // 파싱 결과의 길이로 판정하면, 사용자가 전부 지워 v2가 `[]`가 된 순간 v1이
    // 되살아나 "모두 지우기"가 고장 난다.
    const rawV2 = storage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    const rows =
        rawV2 === null
            ? parse(storage.getItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY))
            : parse(rawV2);
    return rows.slice(0, MAX_RECENT_SEARCHES);
}

/**
 * 최근 검색에 한 건 추가한다.
 *
 * 심볼 문자열과 `{ symbol, label }` 둘 다 받는다 — 표시용 회사명을 모르는 호출부
 * (딥링크 등)가 여전히 심볼만 넘길 수 있어야 하고, 그때는 심볼이 곧 라벨이 된다.
 */
export function addRecentSearch(
    entry: string | RecentSearchEntry,
    storage: StorageLike | null = getDefaultStorage()
): RecentSearchEntry[] {
    const rawSymbol = typeof entry === 'string' ? entry : entry.symbol;
    const normalized = rawSymbol.trim().toUpperCase();
    if (!normalized) {
        return getRecentSearches(storage);
    }

    // 심볼만 넘어온 경우 라벨은 **정규화된 심볼**이다 — 원문을 그대로 쓰면
    // `aapl`처럼 소문자 입력이 그대로 칩에 뜬다. 회사명이 넘어온 경우에만
    // 원문 대소문자를 보존한다(`삼성전자`, `LG화학`).
    const providedLabel = typeof entry === 'string' ? '' : (entry.label ?? '');
    const displayLabel = providedLabel.trim() || normalized;
    const current = getRecentSearches(storage);
    const deduped = current.filter(item => item.symbol !== normalized);
    const next = [
        { symbol: normalized, label: displayLabel },
        ...deduped,
    ].slice(0, MAX_RECENT_SEARCHES);

    if (storage) {
        try {
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // 저장 실패는 조용히 무시 (quota 초과 등)
        }
    }

    return next;
}

export function removeRecentSearch(
    symbol: string,
    storage: StorageLike | null = getDefaultStorage()
): RecentSearchEntry[] {
    const normalized = symbol.trim().toUpperCase();
    const current = getRecentSearches(storage);
    const next = current.filter(item => item.symbol !== normalized);

    if (storage) {
        try {
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    }

    return next;
}

export function clearRecentSearches(
    storage: StorageLike | null = getDefaultStorage()
): void {
    if (!storage) return;
    try {
        storage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
        // v1도 함께 지운다. 남겨 두면 v2가 사라진 자리에서 승격 경로를 타고
        // 되살아나 "모두 지우기"가 아무 일도 안 한 것처럼 보인다.
        storage.removeItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY);
    } catch {
        // ignore
    }
}

/**
 * 라벨이 심볼과 같은 항목에만 회사명을 채운다.
 *
 * 순서·구성은 건드리지 않는다 — 이름을 채우는 일이 최근 검색 순서를 흔들면
 * 사용자 눈에는 목록이 저 혼자 재배열된 것으로 보인다. 이미 회사명이 붙은
 * 항목도 덮어쓰지 않는다(사용자가 검색 결과에서 고른 표기가 더 정확하다).
 *
 * 저장은 채운 게 있을 때만 한다. 매 마운트 no-op 쓰기를 하면 다른 탭의
 * `storage` 이벤트가 의미 없이 깨어난다.
 */
export function relabelRecentSearches(
    labels: Record<string, string>,
    storage: StorageLike | null = getDefaultStorage()
): RecentSearchEntry[] {
    const current = getRecentSearches(storage);
    let changed = false;
    const next = current.map(entry => {
        if (entry.label !== entry.symbol) return entry;
        const label = labels[entry.symbol]?.trim();
        if (!label) return entry;
        changed = true;
        return { symbol: entry.symbol, label };
    });

    if (!changed) return current;

    if (storage) {
        try {
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // 저장 실패는 조용히 무시 (quota 초과 등)
        }
    }

    return next;
}
