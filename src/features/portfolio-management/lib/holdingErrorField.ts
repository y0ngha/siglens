import type { PortfolioActionErrorCode } from '@/entities/portfolio/model';

/**
 * `HoldingForm`에서 오류를 붙일 입력칸. 전용 칸이 없는 코드(저장소·인증 실패 등)는
 * `null`이라 경고 문구만 보여 주고 어느 칸도 강조하지 않는다.
 */
export type HoldingErrorField = 'symbol' | 'quantity' | 'averagePrice' | null;

const FIELD_BY_ERROR_CODE: Record<PortfolioActionErrorCode, HoldingErrorField> =
    {
        invalid_symbol: 'symbol',
        invalid_quantity: 'quantity',
        invalid_price: 'averagePrice',
        symbol_not_found: null,
        unauthenticated: null,
        storage_unavailable: null,
        unknown: null,
    };

/**
 * 저장 액션의 오류 코드를 강조·포커스할 입력칸으로 바꾼다. `Record`라 엔티티에
 * 코드가 늘면 이 표를 채우기 전까지 타입 검사가 실패한다.
 */
export function fieldForErrorCode(
    code: PortfolioActionErrorCode
): HoldingErrorField {
    return FIELD_BY_ERROR_CODE[code];
}
