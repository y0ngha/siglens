'use client';

import { SearchTriggerButton } from './SearchTriggerButton';
import { TickerAutocomplete } from './TickerAutocomplete';
import { useSearchOverlayTrigger } from '../model/SearchOverlayContext';

/**
 * 헤더의 검색 표면. 브레이크포인트에 따라 두 얼굴을 갖는다.
 *
 * - `lg` 이상(데스크톱): 기존 인라인 자동완성 그대로. 화면이 넓고 키보드가 없어
 *   문제가 존재하지 않는다.
 * - `lg` 미만(모바일): 돋보기 아이콘만. 탭하면 전체화면 오버레이가 열린다.
 *
 * 브레이크포인트가 `lg`인 것은 `Header`의 데스크톱 내비(`hidden lg:flex`)·
 * `HeaderMobileMenu`(`lg:hidden`)와 **같은 값**이어야 하기 때문이다. 어긋나면 특정
 * 폭 구간에서 검색 표면이 둘 다 보이거나 둘 다 사라진다.
 *
 * 조건부 렌더가 아니라 **CSS로 감춘다**. `display:none`은 접근성 트리와 포커스
 * 순서에서 제거되므로 중복 랜드마크·이중 탭스톱이 생기지 않고, 크롤러가 보는
 * 마크업이 브레이크포인트에 따라 달라지지 않는다.
 */
export function HeaderSearch() {
    // 오버레이 본체는 `SearchOverlayProvider`가 앱 전체에 하나만 호스팅한다.
    // 여기서 또 마운트하면 홈에서 히어로 트리거와 두 벌이 되어 히스토리가 깨진다.
    const overlay = useSearchOverlayTrigger();

    return (
        <>
            {/* `ml-auto`는 레이아웃 계약이다 — 유저메뉴·햄버거를 오른쪽 끝으로 미는
                유일한 장치가 원래 검색 래퍼의 `ml-auto`였다. 두 표면 중 그 시점에
                보이는 쪽이 반드시 그 역할을 이어받아야 CTA가 로고 쪽으로 붕괴하지 않는다. */}
            {overlay && (
                <SearchTriggerButton
                    onClick={overlay.open}
                    className="ml-auto lg:hidden"
                />
            )}
            {/*
                폭은 브레이크포인트마다 다르다. `lg`(1024px)에서는 로고·내비 3개·
                검색·언어·테마·유저메뉴가 `h-14` 한 줄을 나눠 쓰므로 여유가 없고,
                `xl` 이상에서는 남는 공백이 검색창 쪽에 몰린다. 한 값으로 고정하면
                둘 중 하나가 손해를 본다 — 좁은 데스크톱에서 내비가 눌리거나, 넓은
                화면에서 입력이 티커 4글자만 겨우 들어갈 만큼 작아 보이거나.
            */}
            <div className="ml-auto hidden w-full max-w-xs min-w-0 justify-end lg:flex xl:max-w-md 2xl:max-w-lg">
                {/* `w-full`이 없으면 입력이 **내용 폭**(브라우저 기본 `size=20`,
                    ≈176px)에 머문다 — 래퍼의 `max-w-*`는 상한일 뿐 늘리지 못한다.
                    1440px에서도 176px이던 원인이 이것이다. */}
                <TickerAutocomplete size="sm" className="w-full" />
            </div>
        </>
    );
}
