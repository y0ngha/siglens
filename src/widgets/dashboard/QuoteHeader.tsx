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
}

/**
 * 티커·한국어 이름·가격·등락률 블록 — IndexCard와 SignalStockCard의 공통 상단 UI.
 *
 * 각 카드는 필드명(changesPercentage vs changePercent)을 `QuoteHeaderData`로 정규화해 전달한다.
 * DOM 구조·a11y(arrow aria-hidden, sr-only)·tabular-nums 클래스를 단일 소스로 관리한다.
 */
export function QuoteHeader({ data }: QuoteHeaderProps): React.ReactElement {
    const { sign, colorClass, arrow, arrowLabel } = formatPriceChange(
        data.changePercent
    );

    return (
        <>
            {/* 티커 — 단독 행으로 overflow 방지 */}
            <span
                translate="no"
                className="text-secondary-100 font-mono text-xs font-semibold"
            >
                {data.symbol}
            </span>
            {/* 한국어 이름 + 변동폭 */}
            <div className="flex items-center justify-between gap-1">
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
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
            </div>
            {/* 가격 */}
            <p className="text-secondary-100 font-mono text-sm tabular-nums">
                ${formatUsdPrice(data.price)}
            </p>
        </>
    );
}
