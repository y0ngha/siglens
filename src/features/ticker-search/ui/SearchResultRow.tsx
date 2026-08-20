'use client';

import type { TickerSearchResult } from '@/shared/lib/types';
import { SEARCH_ROW_CLASS } from '../lib/searchLabels';
import { marketBadgeSpec, resultDisplayNames } from '../lib/resultDisplay';
import { MarketBadge } from './MarketBadge';

interface SearchResultRowProps {
    result: TickerSearchResult;
    onSelect: (symbol: string, label: string) => void;
}

/**
 * 전체화면 검색 오버레이의 결과 한 행. 전폭을 쓰므로 이름이 잘리지 않는다 —
 * 이 오버레이가 존재하는 이유가 그것이다(헤더 인라인 드롭다운은 104px에 갇혀
 * `KOSPI 005…`로 잘렸다).
 *
 * ## 의도적으로 **하지 않는** 두 가지
 *
 * **1. 시세를 표시하지 않는다.** 자동완성 응답(`TickerSearchResult`)에 가격이 없어
 * 행마다 추가 조회가 필요하다. 한국 트래픽이 Cloudflare 무료 플랜 때문에 서울이 아닌
 * LAX로 라우팅되어 RTT 165ms·실효 128KB/s인 상황(2026-08-20 실측)에서 그 왕복은
 * 실재 비용이다. 시세가 필요해지면 이 파일 하나만 바꾸면 된다.
 *
 * **2. prefetch를 걸지 않는다.** 데스크톱 `TickerAutocomplete`의 `ResultItem`은
 * `onMouseEnter`에 `router.prefetch`를 물려 두었는데, 그건 `prefetch={false}`를
 * **우회한다**. `/AAPL`의 RSC 페이로드는 1.71MB다(`docs/architecture/CDN_CACHING.md §1`).
 * 10행 목록에 걸면 오버레이를 한 번 열 때마다 ~17MB가 오리진에서 나가고, PR #719가
 * 막았던 프리페치 폭주가 그대로 되살아난다. 복사해 오지 말 것.
 *
 * ARIA `role="option"`을 쓰지 않는 이유는 `SearchOverlay`의 결과 컨테이너 주석 참고 —
 * 방향키 모델 없이 역할만 빌려오면 스크린리더 경험이 오히려 나빠진다.
 *
 * `<Link>`가 아니라 `<button>`인 것도 의도다. `<Link>` 클릭은 `router.push`라
 * 히스토리가 `[NVDA, 검색, AAPL]`이 되어 뒤로가기가 유령 항목에 걸린다. 모든 행은
 * 같은 `onSelect`를 거쳐 `router.replace`로 이동한다.
 */
export function SearchResultRow({ result, onSelect }: SearchResultRowProps) {
    // 표시 규칙은 데스크톱 자동완성과 공유한다 — `lib/resultDisplay.ts` 참고.
    const { primaryName, secondaryName } = resultDisplayNames(result);
    const badge = marketBadgeSpec(result);

    return (
        <button
            type="button"
            onClick={() => onSelect(result.symbol, primaryName)}
            className={SEARCH_ROW_CLASS}
        >
            {badge && <MarketBadge {...badge} />}
            {/* `min-w-0`이 없으면 flex 자식이 축소되지 않아 `truncate`가 동작하지 않는다. */}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-secondary-100">
                    {primaryName}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-secondary-400">
                        {result.symbol}
                    </span>
                    {secondaryName && (
                        <span className="truncate text-xs text-secondary-400">
                            {secondaryName}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}
