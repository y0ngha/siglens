export type PortfolioActionErrorCode =
    | 'unauthenticated'
    | 'invalid_symbol'
    | 'symbol_not_found'
    | 'invalid_quantity'
    | 'invalid_price'
    | 'storage_unavailable'
    | 'unknown';

export interface PortfolioHoldingView {
    symbol: string;
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;
    averagePrice: string;
    updatedAt: string; // ISO
}

export interface RawHoldingInput {
    symbol: string;
    quantity: string;
    averagePrice: string;
}

/**
 * 실패는 **코드만** 돌려준다.
 *
 * `validateHoldingInput`은 순수 함수라 요청 로케일이 없다 — 여기서 문구를 만들면
 * 한국어로 굳어 `/en/account`가 영어 폼에 한국어 검증 메시지를 띄운다. 표시는
 * 번역자를 가진 서버 액션이 맡는다.
 */
export type ValidateHoldingResult =
    | { ok: true; symbol: string; quantity: string; averagePrice: string }
    | { ok: false; code: PortfolioActionErrorCode };

export type SavePortfolioResult =
    | { status: 'ok'; holding: PortfolioHoldingView }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };

export type DeletePortfolioResult =
    | { status: 'ok' }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };
