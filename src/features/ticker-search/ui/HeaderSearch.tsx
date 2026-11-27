'use client';

import { HEADER_SEARCH_INPUT_ID } from '@/shared/model/SearchOverlayTriggerContext';
import { useSearchOverlayTrigger } from '../model/SearchOverlayContext';
import { SearchTriggerButton } from './SearchTriggerButton';
import { TickerAutocomplete } from './TickerAutocomplete';

/**
 * 헤더의 검색 표면. 브레이크포인트에 따라 두 얼굴을 갖는다.
 *
 * - `xl` 이상: 인라인 자동완성(압축형 — 돋보기가 입력 안에 있고 별도 버튼이 없다).
 * - `xl` 미만: 돋보기 아이콘만. 누르면 전체화면 오버레이가 열린다.
 *
 * 경계가 데스크톱 내비(`lg`)보다 한 단계 위인 이유: `lg`~`xl` 구간에서는 로고·내비·관심·계정
 * 영역이 한 줄을 거의 다 써서 인라인 입력이 돋보기만 남을 만큼 눌렸다(1024px 실측 32px). 그
 * 구간은 아이콘으로 접고 폭을 오버레이 전폭으로 넘긴다. "종목 검색" 버튼(`useOpenTickerSearch`)은
 * 같은 경계(`BELOW_XL_MEDIA_QUERY`)로 오버레이와 입력 포커스를 가른다 — 어긋나면 숨은 입력에
 * 포커스를 보낸다.
 *
 * 두 표면의 경계(`xl:hidden`/`xl:flex`)는 **같은 값**이어야 한다. 어긋나면 특정 폭 구간에서
 * 검색 표면이 둘 다 보이거나 둘 다 사라진다.
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
                    className="ml-auto xl:hidden"
                />
            )}
            {/*
                폭은 브레이크포인트마다 다르다. `xl`(1280px)에서는 로고·내비·관심·계정 영역과
                한 줄을 나눠 쓰고, `2xl` 이상에서는 남는 공백이 검색창 쪽에 몰린다.
            */}
            <div className="ml-auto hidden w-full max-w-md min-w-0 justify-end xl:flex 2xl:max-w-lg">
                {/* 압축형(`compact`)이다 — 돋보기를 입력 안에 두고 "검색" 버튼을 없앤다. 버튼과
                    긴 예시를 함께 두면 좁은 데스크톱에서 입력이 몇 글자만 보였다.
                    `w-full`이 없으면 입력이 **내용 폭**(브라우저 기본 `size=20`,
                    ≈176px)에 머문다 — 래퍼의 `max-w-*`는 상한일 뿐 늘리지 못한다.
                    1440px에서도 176px이던 원인이 이것이다. */}
                <TickerAutocomplete
                    size="sm"
                    className="w-full"
                    inputId={HEADER_SEARCH_INPUT_ID}
                    showWatchlistStar
                    compact
                />
            </div>
        </>
    );
}
