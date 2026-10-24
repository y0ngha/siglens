/**
 * 한국 종목의 시가총액·PER·PBR을 **KRX 상장주식수 기준**으로 다시 맞춘다.
 *
 * yahoo `summaryDetail.marketCap`은 yahoo 자체 주식수로 계산돼 KRX 공식 상장주식수와 어긋난다
 * (삼성중공업 010140: 종가 16,830원에서 yahoo 14.375조 ≈ 8.54억 주, KRX 상장주식수는 8.8억 주라
 * 14.81조). `yahooFundamentalMap`의 PER·PBR은 이 시총을 분자로 쓰므로(분모는 TTM 지배주주 순이익·
 * 최신 분기 자본) 같은 비율로 틀린다. 분모는 그대로이므로 PER·PBR은 `시총 비율`만큼 곱해 고치면
 * 정확히 "KRX 시총 ÷ 같은 분모"가 된다.
 *
 * P/S(`priceToSalesTrailing12Months`)도 yahoo 시총 기준이라 같은 비율로 맞춘다. EV/EBITDA는
 * 순부채가 섞여 있어(EV = 시총 + 순부채) 시총만 바꿔 고칠 수 없고, 순부채를 이 경로에서 구할 수도
 * 없다 — 틀린 시총이 섞인 값을 그대로 두는 대신 `krx_listed` 기준에서는 `null`로 비운다.
 *
 * 쓸 수 없는 입력(상장주식수·종가 없음/비정상)이면 프로바이더 값을 그대로 두고
 * `sharesBasis: 'provider'`로 표시한다 — 모델이 어느 기준 숫자인지 말할 수 있어야 한다.
 */

export type SharesBasis = 'krx_listed' | 'provider';

export interface KrListedBasisInput {
    /** 프로바이더(yahoo) 시가총액. 없으면 0. */
    providerMarketCap: number;
    providerPe: number | null;
    providerPb: number | null;
    providerPs: number | null;
    providerEvToEbitda: number | null;
    /** `korean_tickers.listed_shares`. 없으면 null. */
    listedShares: number | null;
    /** 마지막 **완료된** 정규장 종가와 그 날짜(`YYYY-MM-DD`). 없으면 null. */
    lastClose: { close: number; date: string } | null;
}

export interface KrListedBasisView {
    marketCap: number;
    pe: number | null;
    pb: number | null;
    ps: number | null;
    /** `krx_listed` 기준에서는 항상 null(순부채를 몰라 고칠 수 없다). */
    evToEbitda: number | null;
    sharesBasis: SharesBasis;
    /** 시총에 쓴 주식수. 프로바이더 기준이면 알 수 없으므로 null. */
    sharesOutstanding: number | null;
    /** 시총에 쓴 종가의 날짜. 프로바이더 기준이면 null. */
    marketCapCloseDate: string | null;
}

const isPositive = (n: number | null | undefined): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n > 0;

export function krListedBasis(input: KrListedBasisInput): KrListedBasisView {
    const { providerMarketCap, providerPe, providerPb, listedShares } = input;
    const { providerPs, providerEvToEbitda } = input;
    const { lastClose } = input;
    if (
        !isPositive(listedShares) ||
        lastClose === null ||
        !isPositive(lastClose.close)
    )
        return {
            marketCap: providerMarketCap,
            pe: providerPe,
            pb: providerPb,
            ps: providerPs,
            evToEbitda: providerEvToEbitda,
            sharesBasis: 'provider',
            sharesOutstanding: null,
            marketCapCloseDate: null,
        };

    const marketCap = Math.round(listedShares * lastClose.close);
    // 프로바이더 시총이 없으면 비율을 못 구한다 — 그 경우 PER·PBR도 프로바이더가 이미 null로 준다.
    const scale = isPositive(providerMarketCap)
        ? marketCap / providerMarketCap
        : null;
    const rescale = (ratio: number | null): number | null =>
        ratio === null || scale === null ? ratio : ratio * scale;
    return {
        marketCap,
        pe: rescale(providerPe),
        pb: rescale(providerPb),
        ps: rescale(providerPs),
        evToEbitda: null,
        sharesBasis: 'krx_listed',
        sharesOutstanding: listedShares,
        marketCapCloseDate: lastClose.date,
    };
}
