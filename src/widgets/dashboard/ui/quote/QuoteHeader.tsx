/**
 * 시세 카드 상단 블록(제목·등락률·가격)의 레이아웃 조립.
 */
import { QuoteChange } from './QuoteChange';
import { QuotePrice } from './QuotePrice';
import { QuotePrimaryTitle, QuoteSecondaryTitle } from './QuoteTitles';

export interface QuoteHeaderData {
    symbol: string;
    /**
     * 화면에 뜨는 이름. **이미 로케일이 반영된 문자열**이어야 한다 — 한국어 상수
     * (`koreanName`)를 그대로 넘기면 영어 페이지에도 한국어가 뜬다.
     */
    displayName: string;
    price: number;
    /** 등락률 (%) — 양수=상승, 음수=하락. */
    changePercent: number;
}

interface QuoteHeaderProps {
    data: QuoteHeaderData;
    /**
     * 레이아웃 변형.
     *
     * - `'index'` (기본, IndexCard): 주 제목 단독 행 → 보조 제목 + 변동폭(justify-between) → 가격.
     * - `'signal'` (SignalStockCard): 주 제목 + 변동폭(justify-between) 한 행 → 보조 제목 → 가격.
     */
    layout?: 'index' | 'signal';
    /**
     * 가격 앞에 붙일 통화 기호. 시장마다 다르다 — `$`를 고정하면 한국 시장의
     * 원화가 달러로 표기된다.
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
 * 티커·이름·가격·등락률 블록 — IndexCard와 SignalStockCard의 공통 상단 UI.
 *
 * 각 카드는 필드명(changesPercentage vs changePercent)을 `QuoteHeaderData`로 정규화해
 * 전달한다. `layout`만 행 배치를 가르고, 조각의 DOM·a11y는 각 조각이 소유한다.
 */
export function QuoteHeader({
    data,
    layout = 'index',
    currencySymbol,
    tickerIsReadable,
}: QuoteHeaderProps) {
    const titleProps = {
        symbol: data.symbol,
        displayName: data.displayName,
        tickerIsReadable,
    };
    const change = (
        <QuoteChange changePercent={data.changePercent} layout={layout} />
    );
    const price = (
        <QuotePrice price={data.price} currencySymbol={currencySymbol} />
    );

    if (layout === 'signal') {
        return (
            <>
                <div className="flex items-center justify-between gap-1">
                    <QuotePrimaryTitle {...titleProps} />
                    {change}
                </div>
                <QuoteSecondaryTitle {...titleProps} />
                {price}
            </>
        );
    }

    return (
        <>
            <QuotePrimaryTitle {...titleProps} />
            <div className="flex items-center justify-between gap-1">
                <QuoteSecondaryTitle {...titleProps} />
                {change}
            </div>
            {price}
        </>
    );
}
