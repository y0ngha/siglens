import type { PortfolioHoldingRecord } from '@/shared/db/types';
import type { PortfolioHoldingView } from '../model';

/** DB 레코드를 클라이언트 전송용 뷰로 바꾼다. 수량·평단은 정밀도 보존을 위해 문자열 그대로, 시각은 ISO 문자열로 직렬화한다. */
export function toView(r: PortfolioHoldingRecord): PortfolioHoldingView {
    return {
        symbol: r.symbol,
        companyName: r.companyName,
        fmpSymbol: r.fmpSymbol,
        quantity: r.quantity,
        averagePrice: r.averagePrice,
        updatedAt: r.updatedAt.toISOString(),
    };
}
