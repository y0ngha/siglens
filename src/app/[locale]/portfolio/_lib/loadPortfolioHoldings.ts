import 'server-only';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '@/entities/portfolio/lib/toView';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { getDatabaseClient } from '@/shared/db/client';

/**
 * `/portfolio` 위치 카드 그리드에 쓸 회원 보유종목(심볼 오름차순). 조회 실패는 로그를 남기고
 * `null`로 degrade해 페이지가 루트 에러 경계 대신 안내 카드를 그리게 한다.
 *
 * `getPortfolioHoldingsAction`을 쓰지 않는 이유: 그 액션은 `getCurrentUser()`를 다시 풀고,
 * 일시적 DB 실패를 React Query `queryFn`용으로 그대로 던진다. 호출자가 이미 세션을 풀어
 * `userId`를 넘긴다.
 */
export async function loadPortfolioHoldings(
    userId: string
): Promise<PortfolioHoldingView[] | null> {
    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzlePortfolioRepository(db).findByUser(
            userId
        );
        return rows
            .map(toView)
            .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
        console.error('[portfolio] holdings load failed', error);
        return null;
    }
}
