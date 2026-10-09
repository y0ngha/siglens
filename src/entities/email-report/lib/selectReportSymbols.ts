import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
    EMAIL_REPORT_MAX_SYMBOLS,
} from './emailReportConstants';

/** 보유 종목 한 줄 — 포트폴리오 행에서 필요한 것만. */
export interface ReportHolding {
    symbol: string;
    quantity: string;
    averagePrice: string;
}

/** 관심종목 한 줄 — `watchlist_items` 행에서 필요한 것만. */
export interface ReportWatchlistItem {
    symbol: string;
    createdAt: Date;
}

export interface ReportSymbolSources {
    holdings: readonly ReportHolding[];
    watchlist: readonly ReportWatchlistItem[];
}

export interface ReportSymbolSelection {
    /** 전체 카드(차트·분석·뉴스·옵션·신호 요약). 최대 {@link EMAIL_REPORT_MAX_SYMBOLS}. */
    full: string[];
    /** "그 외 관심종목" 요약 표. 최대 {@link EMAIL_REPORT_MAX_BRIEF_SYMBOLS}. */
    brief: string[];
}

/**
 * 보유 종목 정렬: 매입 원가(수량 × 평단)가 큰 순 — 회원에게 가장 무거운 종목부터.
 * 동률이면 심볼 순으로 결정적이게 한다.
 *
 * 국내 주식은 평단이 원화라 달러 종목과 원가를 그대로 비교하면 늘 앞선다. 그래서 통화
 * 그룹을 먼저 가르고(해외 → 국내) 그룹 안에서만 원가를 비교한다. 해외를 앞에 두는 이유는
 * 리포트의 옵션 섹션이 미국 종목에만 있기 때문이다.
 */
function orderHoldings(holdings: readonly ReportHolding[]): string[] {
    const costBasis = (h: ReportHolding) => {
        const value = Number(h.quantity) * Number(h.averagePrice);
        return Number.isFinite(value) ? value : 0;
    };
    const group = (h: ReportHolding) => Number(isKrEquitySymbol(h.symbol));
    return holdings
        .toSorted(
            (a, b) =>
                group(a) - group(b) ||
                costBasis(b) - costBasis(a) ||
                a.symbol.localeCompare(b.symbol)
        )
        .map(h => h.symbol);
}

/** 관심종목 정렬: 최근 담은 순, 같은 시각이면 심볼 순. */
function orderWatchlist(items: readonly ReportWatchlistItem[]): string[] {
    return items
        .toSorted(
            (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() ||
                a.symbol.localeCompare(b.symbol)
        )
        .map(w => w.symbol);
}

/**
 * 메일에 실을 종목을 고른다. 보유 종목(위 순서) 뒤에 관심종목(최근 담은 순)을 잇고,
 * 보유와 관심에 모두 있는 심볼은 보유 자리에서 한 번만 센다. 앞의
 * {@link EMAIL_REPORT_MAX_SYMBOLS}개가 전체 카드, 그다음
 * {@link EMAIL_REPORT_MAX_BRIEF_SYMBOLS}개가 요약 표, 나머지는 버린다.
 * 둘 다 비면 `{ full: [], brief: [] }` — 호출자가 `skipped`로 기록한다.
 */
export function selectReportSymbols(
    sources: ReportSymbolSources
): ReportSymbolSelection {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const symbol of [
        ...orderHoldings(sources.holdings),
        ...orderWatchlist(sources.watchlist),
    ]) {
        if (seen.has(symbol)) continue;
        seen.add(symbol);
        ordered.push(symbol);
    }
    return {
        full: ordered.slice(0, EMAIL_REPORT_MAX_SYMBOLS),
        brief: ordered.slice(
            EMAIL_REPORT_MAX_SYMBOLS,
            EMAIL_REPORT_MAX_SYMBOLS + EMAIL_REPORT_MAX_BRIEF_SYMBOLS
        ),
    };
}
