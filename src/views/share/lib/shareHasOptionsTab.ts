import {
    getDescriptor,
    profileIdForSymbol,
} from '@/shared/config/marketProfile/registry';

/**
 * 공유된 `overall` 스냅샷의 종목에 옵션 탭이 있는지 — `OverallView.hasOptions`에 넘긴다.
 *
 * 판정은 `overall/page.tsx`·`OverallFactualFallback`과 같은 소스인
 * `getDescriptor(...).tabs`를 탄다. 공유 화면에는 `marketProfile`이 없지만 스냅샷의
 * canonical 티커로 프로필을 구할 수 있다. `isKrEquitySymbol`을 여기서 직접 부르면
 * "옵션 탭이 있는가"의 세 번째 독립 파생이 되어, 프로필의 `tabs`가 바뀌는 순간 조용히
 * 갈라진다(CONVENTIONS.md#CS-2).
 *
 * 심볼이 없거나 빈 문자열이면 `false`다. 모르는 상태를 `true`로 열면 존재하지 않는
 * 옵션 섹션이 뜨고, 숨기는 쪽이 틀리는 대가가 더 작다. 빈 문자열을 따로 막는 이유:
 * `profileIdForSymbol('')`은 us-equity로 폴백하므로 그대로 흘리면 `true`가 된다.
 *
 * 크립토는 `OverallView`가 `isEquity` 게이트로 이 값을 무시하므로,
 * `profileIdForSymbol`이 크립토를 us-equity로 떨어뜨리는 한계가 여기선 영향을 주지 않는다.
 */
export function shareHasOptionsTab(symbol: string | undefined): boolean {
    if (symbol === undefined || symbol === '') return false;
    return getDescriptor(profileIdForSymbol(symbol)).tabs.includes('options');
}
