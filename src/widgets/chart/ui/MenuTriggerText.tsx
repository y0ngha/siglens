/**
 * 차트 헤더 글자 트리거의 라벨·개수·▾ 표시.
 */

interface MenuTriggerTextProps {
    /** 개수 없는 이름("차트 작도"). */
    base: string;
    /** 개수가 든 이름("차트 작도 · 3"). 개수를 세지 않는 상태면 `null`. */
    withCount: string | null;
}

/**
 * 헤더 띠 글자 트리거의 보이는 글자 + ▾. 개수는 sm 이상에서만 보인다 — 320px 모바일 띠에서 세 메뉴가
 * 시간외 시세 슬롯(`ChartContent`의 `chartHeaderStartSlot`)을 밀어내지 않게 하는 압축이다. 접근 가능한 이름은
 * 호출부가 `aria-label`로 개수 포함 문구를 주므로 화면 폭과 무관하게 같다(그래서 여기 글자는 장식).
 */
export function MenuTriggerText({ base, withCount }: MenuTriggerTextProps) {
    if (withCount === null) {
        return (
            <>
                <span aria-hidden="true">{base}</span>
                <span aria-hidden="true">▾</span>
            </>
        );
    }
    return (
        <>
            <span aria-hidden="true" className="sm:hidden">
                {base}
            </span>
            <span aria-hidden="true" className="max-sm:hidden">
                {withCount}
            </span>
            <span aria-hidden="true">▾</span>
        </>
    );
}
