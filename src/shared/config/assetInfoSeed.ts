/**
 * 이 파일을 `queryConfig.ts`에 합치지 않는 이유: 종목 라우트 테스트 다수가 `queryConfig`를
 * 부분 목으로 갈아끼운다. 거기에 export를 더하면 손대지 않은 테스트가
 * `No "x" export is defined on the mock`으로 무더기 실패한다.
 */
/**
 * 서버가 심는 assetInfo 시드의 `updatedAt`.
 *
 * ISR HTML이 재생성마다 달라지지 않도록 실제 시각 대신 **고정값**을 쓴다. 값이 두 개인
 * 이유는 클라이언트가 시드의 성격을 구분해야 하기 때문이다(`useAssetInfo`):
 *
 *   - `resolved` — 정상 조회된 종목 메타. 거의 불변이라 클라이언트가 다시 받지 않는다.
 *   - `degraded` — FMP·DB 장애 중 폴백으로 푼 값. 장애 중에 구워진 ISR HTML은 길게는
 *     몇 시간 남으므로, 클라이언트가 마운트 때 다시 받아 스스로 고치게 stale로 둔다.
 */
export const ASSET_INFO_SEED_UPDATED_AT = { resolved: 0, degraded: 1 } as const;

/** 시드를 심는 서버 코드가 쓰는 헬퍼 — `degraded`는 `getAssetInfoResilient`의 값이다. */
export function assetInfoSeedUpdatedAt(degraded: boolean): number {
    return degraded
        ? ASSET_INFO_SEED_UPDATED_AT.degraded
        : ASSET_INFO_SEED_UPDATED_AT.resolved;
}
