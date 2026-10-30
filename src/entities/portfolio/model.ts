/** 보유종목 액션·검증이 돌려주는 실패 코드. 문구는 코드가 아니라 서버 액션이 로케일에 맞춰 만든다. */
export type PortfolioActionErrorCode =
    | 'unauthenticated'
    | 'invalid_symbol'
    | 'symbol_not_found'
    | 'invalid_quantity'
    | 'invalid_price'
    | 'storage_unavailable'
    | 'unknown';

/** 클라이언트로 내려가는 보유종목. 수량·평단은 정밀도 보존을 위해 소수 문자열이다. */
export interface PortfolioHoldingView {
    symbol: string;
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;
    averagePrice: string;
    updatedAt: string; // ISO
}

/** 폼에서 올라온 검증 전 입력. 서버 액션에서 런타임 형상까지 다시 확인한다. */
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

/**
 * `savePortfolioHoldingAction`의 결과. 액션은 던지지 않고 `status`로 갈린다 — `ok`면 저장된
 * 보유 뷰, `error`면 `code`로 분기하고 `message`는 그대로 보여줄 현지화 문구.
 */
export type SavePortfolioResult =
    | { status: 'ok'; holding: PortfolioHoldingView }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };

/**
 * `deletePortfolioHoldingAction`의 결과. 성공에는 페이로드가 없고, 실패는 던지지 않고
 * `code`·현지화된 `message`로 돌아온다.
 */
export type DeletePortfolioResult =
    | { status: 'ok' }
    | { status: 'error'; code: PortfolioActionErrorCode; message: string };
