import { cn } from '@/shared/lib/cn';
import { formatPriceChange, formatUsdPrice } from '@/shared/lib/priceFormat';

export interface QuoteHeaderData {
    symbol: string;
    koreanName: string;
    price: number;
    /** 등락률 (%) — 양수=상승, 음수=하락. */
    changePercent: number;
}

interface QuoteHeaderProps {
    data: QuoteHeaderData;
    /**
     * 레이아웃 변형.
     *
     * - `'index'` (기본): 주 제목 단독 행 → 보조 제목 + 변동폭(justify-between) → 가격.
     *   IndexCard 원본 DOM과 동일.
     * - `'signal'`: 주 제목 + 변동폭(justify-between) 한 행 → 보조 제목 → 가격.
     *   SignalStockCard 원본 DOM과 동일.
     */
    layout?: 'index' | 'signal';
    /**
     * 가격 앞에 붙일 통화 기호. 예전에는 `$`가 JSX에 그대로 박혀 있어
     * `/market/kr`에서 원화가 달러로 표기됐다.
     */
    currencySymbol: string;
    /**
     * 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`).
     *
     * `false`면 한국어명과 티커의 자리가 뒤바뀐다 — KRX 티커는 `091160.KS`처럼
     * 6자리 숫자라 독자에게 아무 뜻이 없고, 알아볼 수 있는 `반도체`가 작은 회색
     * 글씨로 밀려나기 때문이다. 두 값 모두 DOM에는 그대로 남는다(시각적 우선순위만 변경).
     */
    tickerIsReadable: boolean;
}

/**
 * 티커·한국어 이름·가격·등락률 블록 — IndexCard와 SignalStockCard의 공통 상단 UI.
 *
 * 각 카드는 필드명(changesPercentage vs changePercent)을 `QuoteHeaderData`로 정규화해 전달한다.
 * DOM 구조·a11y(arrow aria-hidden, sr-only)·tabular-nums 클래스를 단일 소스로 관리한다.
 *
 * `layout` prop으로 두 카드의 원본 DOM을 정확히 재현한다.
 */
export function QuoteHeader({
    data,
    layout = 'index',
    currencySymbol,
    tickerIsReadable,
}: QuoteHeaderProps) {
    const { sign, colorClass, arrow, arrowLabel } = formatPriceChange(
        data.changePercent
    );

    /** 변동폭 span — 두 레이아웃에서 동일하게 사용 */
    const changeSpan = (
        <span
            className={cn(
                'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                colorClass
            )}
        >
            <span aria-hidden="true">{arrow}</span>
            <span className="sr-only">{arrowLabel}</span>
            {sign}
            {data.changePercent.toFixed(2)}%
        </span>
    );

    // 티커는 어느 자리에 가든 번역 대상이 아니다 — `translate="no"`가 값을 따라간다.
    const primary = tickerIsReadable ? (
        <span
            translate="no"
            className="font-mono text-xs font-semibold text-secondary-100"
        >
            {data.symbol}
        </span>
    ) : (
        // `min-w-0`이 `truncate`와 짝이다. `signal` 레이아웃에서 이 span은
        // `shrink-0`인 등락률 배지와 같은 flex 행에 놓이는데, flex item 기본값
        // `min-width: auto`는 nowrap 텍스트의 min-content(=전체 텍스트 폭)로
        // 해석돼 아이템이 줄어들지 못한다. 그러면 `overflow-hidden`이 있어도
        // 말줄임이 발동하지 않고 `LG에너지솔루션` 같은 긴 이름이 행을 넘긴다 —
        // 하필 이 PR이 고치려는 KR 개별 종목 카드가 그 경우다.
        <span className="min-w-0 truncate text-xs font-semibold text-secondary-100">
            {data.koreanName}
        </span>
    );

    const secondary = tickerIsReadable ? (
        <p className="min-w-0 truncate text-xs text-secondary-400">
            {data.koreanName}
        </p>
    ) : (
        <p
            translate="no"
            className="min-w-0 truncate font-mono text-xs text-secondary-400"
        >
            {data.symbol}
        </p>
    );

    if (layout === 'signal') {
        return (
            <>
                <div className="flex items-center justify-between gap-1">
                    {primary}
                    {changeSpan}
                </div>
                {secondary}
                <p className="font-mono text-sm text-secondary-100 tabular-nums">
                    {currencySymbol}
                    {formatUsdPrice(data.price)}
                </p>
            </>
        );
    }

    return (
        <>
            {primary}
            <div className="flex items-center justify-between gap-1">
                {secondary}
                {changeSpan}
            </div>
            <p className="font-mono text-sm text-secondary-100 tabular-nums">
                {currencySymbol}
                {formatUsdPrice(data.price)}
            </p>
        </>
    );
}
