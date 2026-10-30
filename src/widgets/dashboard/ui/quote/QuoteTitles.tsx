/**
 * 시세 카드의 주·보조 제목 — 티커와 표시 이름이 서로 자리를 바꾼다.
 */

interface QuoteTitleProps {
    symbol: string;
    /** 이미 로케일이 반영된 이름. */
    displayName: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
}

/**
 * 주 제목. 티커는 어느 자리에 가든 번역 대상이 아니라 `translate="no"`가 값을 따라간다.
 *
 * 이름이 주 제목일 때 `min-w-0`이 `truncate`와 짝이다. 이 span은 `shrink-0`인 등락률
 * 배지와 같은 flex 행에 놓일 수 있는데, flex item 기본값 `min-width: auto`는 nowrap
 * 텍스트의 전체 폭으로 해석돼 줄어들지 못한다. 그러면 `overflow-hidden`이 있어도
 * 말줄임이 발동하지 않고 긴 이름이 행을 넘긴다.
 */
export function QuotePrimaryTitle({
    symbol,
    displayName,
    tickerIsReadable,
}: QuoteTitleProps) {
    if (tickerIsReadable) {
        return (
            <span
                translate="no"
                className="font-mono text-xs font-semibold text-secondary-100"
            >
                {symbol}
            </span>
        );
    }
    return (
        <span className="min-w-0 truncate text-xs font-semibold text-secondary-100">
            {displayName}
        </span>
    );
}

/** 보조 제목. 주 제목이 티커면 이름, 이름이면 티커다. */
export function QuoteSecondaryTitle({
    symbol,
    displayName,
    tickerIsReadable,
}: QuoteTitleProps) {
    if (tickerIsReadable) {
        return (
            <p className="min-w-0 truncate text-xs text-secondary-400">
                {displayName}
            </p>
        );
    }
    return (
        <p
            translate="no"
            className="min-w-0 truncate font-mono text-xs text-secondary-400"
        >
            {symbol}
        </p>
    );
}
