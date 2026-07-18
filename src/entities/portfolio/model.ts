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

export type ValidateHoldingResult =
    | { ok: true; symbol: string; quantity: string; averagePrice: string }
    | { ok: false; code: PortfolioActionErrorCode; message: string };

export type SavePortfolioResult =
    | { status: 'ok'; holding: PortfolioHoldingView }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };

export type DeletePortfolioResult =
    | { status: 'ok' }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };
