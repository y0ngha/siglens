'use client';

import { useTranslations } from 'next-intl';
import { SearchWatchlistStar } from '@/features/watchlist/ui/SearchWatchlistStar';
import type { TickerSearchResult } from '@/shared/lib/types';
import { resultDisplayNames } from '../../lib/resultDisplay';
import type { SearchStatus } from '../../lib/searchStatus';
import { SearchResultRow } from '../SearchResultRow';

const CENTERED_STATUS_CLASS =
    'px-4 py-10 text-center text-sm text-secondary-400';

interface StatusMessage {
    className: string;
    text: string;
}

interface OverlayResultsProps {
    results: readonly TickerSearchResult[];
    status: SearchStatus;
    onSelect: (symbol: string, label: string) => void;
}

/**
 * 검색 오버레이의 결과 영역(질의가 있을 때). 결과 행과, 조회 중·실패·결과 없음 문구를 그린다.
 *
 * `role="listbox"`/`role="option"`을 쓰지 않는다. ARIA listbox는 단일 탭스톱 + 방향키 +
 * `aria-activedescendant`를 갖춘 복합 위젯인데, 이 오버레이에는 방향키 모델이 없고 각 행이
 * 네이티브 `<button>`이라 저마다 탭스톱을 갖는다 — 역할만 빌려오면 스크린리더가 폼 모드로
 * 전환한 뒤 방향키가 먹지 않아 오히려 나빠진다(WCAG 4.1.2). 버튼 목록이라 Tab으로 완전히
 * 조작된다.
 */
export function OverlayResults({
    results,
    status,
    onSelect,
}: OverlayResultsProps) {
    const t = useTranslations('features.ticker-search');
    // 새 상태가 생기면 컴파일이 실패하도록 전부 적는다. 아무것도 보이지 않는 상태는 null이다.
    // "결과 없음"과 "조회 실패"는 다르다. 구분하지 않으면 검색 서버가 죽어도
    // "결과가 없습니다"로 보이고, 한글 질의에는 "티커로 쳐보세요"라는 틀린 안내가
    // 나간다 — 사용자는 없는 종목을 찾은 줄 안다.
    // 한글 질의는 검색 키 직행이 막혀 있다(회사명을 URL로 삼으면 없는 페이지로 간다).
    // FMP가 색인하지 않는 종목을 한글로 찾으면 티커로 다시 쳐보라는 안내가 유일한
    // 출구다. 데스크톱 자동완성과 같은 문구.
    const statusMessages: Record<SearchStatus, StatusMessage | null> = {
        idle: null,
        results: null,
        searching: {
            className: 'px-4 py-3 text-sm text-secondary-400',
            text: t('search.searchingEllipsis'),
        },
        error: {
            className: CENTERED_STATUS_CLASS,
            text: t('search.loadFailedRetry'),
        },
        emptyKorean: {
            className: CENTERED_STATUS_CLASS,
            text: t('search.noResultsTryTickerExample'),
        },
        empty: {
            className: CENTERED_STATUS_CLASS,
            text: t('search.noResults'),
        },
    };
    const statusMessage = statusMessages[status];

    return (
        <section aria-label={t('search.resultsLabel')}>
            {results.map(result => (
                // 행(이동)과 ★(담기)는 형제 버튼이다 — 둘 다 Tab 정지점이고, ★를 눌러도
                // 이동하지 않는다.
                <div key={result.symbol} className="flex items-center pr-2">
                    <SearchResultRow
                        result={result}
                        onSelect={onSelect}
                        className="min-w-0 flex-1"
                    />
                    <SearchWatchlistStar
                        symbol={result.symbol}
                        label={resultDisplayNames(result).primaryName}
                        focusable
                        className="size-11"
                    />
                </div>
            ))}
            {statusMessage && (
                <p className={statusMessage.className}>{statusMessage.text}</p>
            )}
        </section>
    );
}
