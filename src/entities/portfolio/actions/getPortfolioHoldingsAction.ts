'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '../api';
import { toView } from '../lib/toView';
import type { PortfolioHoldingView } from '../model';

/**
 * 현재 회원의 보유종목을 심볼 오름차순으로 돌려준다. 비로그인이면 리다이렉트 없이 `[]`.
 * (비로그인 `[]`·무리다이렉트 동작은 getRegisteredProvidersAction과 같지만, 그쪽이 읽기
 * 오류를 `[]`로 삼키는 것과 달리 이 액션은 삼키지 않는다.) 리포지토리의 일시 오류 재시도
 * (`DrizzlePortfolioRepository.findByUser`) 뒤에도 실패한 읽기는 일부러 잡지 않고 전파한다:
 * React Query `queryFn`으로 돌기 때문에 던져진 에러는 쿼리의 `isError`만 세우고, 던져진
 * `NEXT_REDIRECT`처럼 네비게이션을 가로채지 않는다. 여기서 삼키면 일시적 DB 오류가 "이 회원은
 * 보유종목이 없다"와 구분되지 않는다.
 */
export async function getPortfolioHoldingsAction(): Promise<
    PortfolioHoldingView[]
> {
    const user = await getCurrentUser();
    if (user === null) return [];

    const { db } = getDatabaseClient();
    const rows = await new DrizzlePortfolioRepository(db).findByUser(user.id);
    return rows
        .map(toView)
        .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
}
