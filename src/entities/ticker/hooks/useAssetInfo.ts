'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/entities/ticker/actions/getAssetInfoAction';
import {
    ASSET_INFO_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { ASSET_INFO_SEED_UPDATED_AT } from '@/shared/config/assetInfoSeed';
import type { AssetInfo } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';

/**
 * Returns:
 * - `undefined` — query in-flight (loading placeholder should be shown)
 * - `null`      — query resolved but no matching asset found (unknown symbol)
 * - `AssetInfo` — resolved asset
 */
export function useAssetInfo(symbol: string): AssetInfo | null | undefined {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: ({ queryKey: [, qSymbol] }) => getAssetInfoAction(qSymbol),
        enabled: isHydrated,
        // 정상 조회된 서버 시드는 다시 받지 않는다. 종목 레이아웃은 ISR HTML이 재생성마다
        // 달라지지 않도록 시드를 고정 `updatedAt`으로 심는데, 고정 staleTime으로는 그 시드가
        // 항상 stale이라 모든 종목 페이지뷰가 같은 값을 한 번 더 받아 왔다. Server Action은
        // 한 번에 하나씩만 나가므로(운영 실측 한 건 ~0.3s) 그 한 번이 뒤에 줄 선 요청을
        // 그만큼 늦춘다. 종목 메타는 서버 캐시도 24시간인 거의 불변 데이터다.
        //
        // 장애 중 폴백으로 푼 시드(`degraded`)는 예외다 — 다른 `updatedAt`으로 심겨 여기서
        // stale로 남고, 마운트 때 다시 받아 스스로 고친다(`ASSET_INFO_SEED_UPDATED_AT`).
        //
        // `refetchOnMount: false`로는 막히지 않는다 — 이 쿼리는 하이드레이션 뒤에
        // `enabled`가 켜지는데, 그 전환은 stale 여부만 보고 재요청한다(실측).
        // 시드가 없는 화면은 데이터가 없어 staleTime과 무관하게 평소대로 받는다.
        staleTime: query =>
            query.state.dataUpdatedAt === ASSET_INFO_SEED_UPDATED_AT.resolved
                ? Infinity
                : ASSET_INFO_STALE_TIME_MS,
    });
    // `data` is `undefined` when the query has not yet resolved (loading),
    // and `null` when the server action returned null (unknown symbol).
    // We preserve the distinction so consumers can handle each case separately.
    return data === undefined ? undefined : data;
}
