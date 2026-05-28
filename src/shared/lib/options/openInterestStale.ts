import type { OptionsSnapshot } from '@y0ngha/siglens-core';

/**
 * 전체 contract 중 OI=0 비율이 이 임계값 이상이면 stale로 판정.
 *
 * 테스트에서 임계값 경계 케이스를 검증할 때 동일한 상수를 import해 사용해야
 * 임계값 조정 시 테스트가 자동으로 따라온다 — 하드코딩 금지.
 */
export const OI_STALE_FRACTION_THRESHOLD = 0.95;

/**
 * Stale-quote 휴리스틱: 옵션 시장이 활성화된 종목인데도 전체 contract 중
 * OI=0 비율이 `OI_STALE_FRACTION_THRESHOLD` 이상이면 Yahoo의 정규장 외
 * quote 클리어 상태로 판정한다.
 *
 * "100% 모두 0"이 아닌 비율 임계값을 쓰는 이유: Yahoo는 PRE / PRE-PRE /
 * POSTPOST 시간대에 대부분 contract의 quote(OI 포함)를 0/sentinel로
 * 클리어하지만, 일부 deep ITM hedge LEAPS처럼 거래가 거의 없는
 * contract는 마지막 EOD 값을 그대로 보존한다 (실측: PLTR PRE-PRE 1252개 중
 * 12개만 OI > 0). 압도적 다수가 0이면 stale로 본다.
 *
 * 정규장 시간대에는 호출하지 말 것 — 활발히 거래되는 종목은 정규장에도
 * deep OTM strike OI 0이 흔하므로 false positive 위험. 호출자는 core
 * `isEtRegularSessionOpen`이 false일 때(정규장 외)에만 이 휴리스틱을 적용한다.
 */
export function isOpenInterestSnapshotStale(
    snapshot: OptionsSnapshot
): boolean {
    const allContracts = snapshot.chains.flatMap(c => [...c.calls, ...c.puts]);
    const totalCount = allContracts.length;
    if (totalCount === 0) return true;
    const zeroCount = allContracts.filter(c => c.openInterest === 0).length;
    return zeroCount / totalCount >= OI_STALE_FRACTION_THRESHOLD;
}
