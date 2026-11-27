/**
 * 한국 종목의 시가총액을 **KRX 상장주식수 기준**으로 다시 맞춘다.
 *
 * yahoo `summaryDetail.marketCap`은 yahoo 자체 주식수로 계산돼 KRX 공식 상장주식수와 어긋난다
 * (삼성중공업 010140: 종가 16,830원에서 yahoo 14.375조 ≈ 8.54억 주, KRX 상장주식수는 8.8억 주라
 * 14.81조). 시가총액은 KRX 관행(상장주식수 × 종가)이 맞다.
 *
 * **PER·PBR·PSR은 이 시총 비율로 다시 곱하지 않는다.** 예전에는 `시총 비율`을 곱했지만, 그것은 yahoo 분모(순이익·자본)에
 * 상장주식수(자기주식 포함) 시총을 나누는 꼴이라 주당 지표의 기준과 어긋났다. 삼성카드는 provider 기준 PBR 0.51(네이버 0.50)이
 * 곱한 뒤 0.55가 됐고, 제주반도체도 4.94(네이버 4.88)에서 5.06이 됐다. 한국 PER·PBR은 이제 DART 재무제표로 직접 계산한다
 * (`entities/kr-valuation`, `getKrValuation`). P/S는 제공처 값을 그대로 쓴다.
 *
 * EV/EBITDA는 순부채가 섞여 있어(EV = 시총 + 순부채) 시총만 바꿔 고칠 수 없고, 순부채를 이 경로에서 구할 수도 없다 — 틀린 시총이
 * 섞인 값을 그대로 두는 대신 `krx_listed` 기준에서는 `null`로 비운다.
 *
 * 쓸 수 없는 입력(상장주식수·종가 없음/비정상)이면 프로바이더 값을 그대로 두고 `sharesBasis: 'provider'`로 표시한다 — 모델이
 * 어느 기준 숫자인지 말할 수 있어야 한다.
 */

export type SharesBasis = 'krx_listed' | 'provider';

export interface KrListedBasisInput {
    /** 프로바이더(yahoo) 시가총액. 없으면 0. */
    providerMarketCap: number;
    providerEvToEbitda: number | null;
    /** `korean_tickers.listed_shares`. 없으면 null. */
    listedShares: number | null;
    /** 마지막 **완료된** 정규장 종가와 그 날짜(`YYYY-MM-DD`). 없으면 null. */
    lastClose: { close: number; date: string } | null;
}

export interface KrListedBasisView {
    marketCap: number;
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
    const { providerMarketCap, providerEvToEbitda, listedShares } = input;
    const { lastClose } = input;
    if (
        !isPositive(listedShares) ||
        lastClose === null ||
        !isPositive(lastClose.close)
    )
        return {
            marketCap: providerMarketCap,
            evToEbitda: providerEvToEbitda,
            sharesBasis: 'provider',
            sharesOutstanding: null,
            marketCapCloseDate: null,
        };

    return {
        marketCap: Math.round(listedShares * lastClose.close),
        evToEbitda: null,
        sharesBasis: 'krx_listed',
        sharesOutstanding: listedShares,
        marketCapCloseDate: lastClose.date,
    };
}
