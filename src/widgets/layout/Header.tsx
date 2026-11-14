import { HeaderSearch } from '@/features/ticker-search/ui/HeaderSearch';
import { WatchlistQuickButton } from '@/features/watchlist/ui/WatchlistQuickButton';
import { cn } from '@/shared/lib/cn';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { HeaderMobileMenu } from './HeaderMobileMenu';
import { HeaderNav } from './HeaderNav';
import { HeaderUserMenu } from './HeaderUserMenu';
import { LocaleSwitcher } from './LocaleSwitcher';
import { LogoLockup } from './LogoLockup';
import type { HeaderUserMenuUser } from './types';
import { HeaderShell } from './ui/header/HeaderShell';
import { NAV_TREE } from './utils/headerNavTree';

interface HeaderProps {
    /** 서버에서 조회한 현재 사용자(`app/layout.tsx`). 비로그인이면 `null`. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * `true`면 사용자 메뉴 자리에 스켈레톤을 그린다. Suspense fallback용이다.
     *   - 바깥 fallback: 항상 `true`(힌트 쿠키를 아직 읽기 전)
     *   - 안쪽 fallback: 힌트 쿠키가 활성 세션을 가리킬 때만 `true`
     */
    readonly loadingUserMenu?: boolean;
    /**
     * 사용자 메뉴와 모바일 드로어의 `/login`·`/signup` href로 전달되는 SSO handoff 쿼리.
     * ai 호스트에서 렌더될 때만 설정되어, 방문자가 로그인 뒤 그곳으로 돌아오게 한다.
     * `undefined`면 인증 href는 그대로다(메인 호스트).
     */
    readonly authNext?: string;
    /**
     * `lg` 미만에서 헤더를 화면 밖으로 밀어낸다(ai 호스트, 아래로 스크롤하는 동안).
     * 데스크톱은 자리가 있어 항상 고정한다.
     */
    readonly hiddenOnMobile?: boolean;
}

/*
 * 모바일 헤더 한 줄의 폭 예산.
 *
 * 한 줄에 서는 것은 좌우 패딩(32) + 로고 + AI 링크 + 44px 아이콘 버튼들(검색·관심종목·언어·테마·
 * 계정·햄버거)과 그 사이 갭이다. 전부 세우면 게스트 408px, 회원(아바타 +44) 452px이 필요해서
 * 360~390px 폰에서 맨 끝의 햄버거가 화면 밖으로 잘렸다(2026-11-14 운영 실측: 360px에서 "메뉴
 * 열기"가 x=348~392). ai 호스트는 넘친 만큼 가로 스크롤이 생겼다. 잘리는 쪽이 유일한 내비 진입점
 * 이므로, 드로어에도 있는 컨트롤부터 폭에 따라 뺀다:
 *
 *  - 30rem(480px) 미만: 테마 토글을 뺀다(드로어에 같은 토글). 게스트 356px.
 *  - 30rem 미만 + 회원: 언어 전환도 뺀다(드로어에 같은 스위처). 회원 348px. 회원 여부는 첫 페인트
 *    전에 찍히는 `<html data-auth-hint>`로 CSS가 가른다(`globals.css`).
 *  - 22.5rem(360px) 미만: 언어 전환을 빼고(드로어에 있다) 로고 옆 AI 링크의 Beta 태그를 숨긴다
 *    (`AiWordmarkLink`). 320px에서 게스트 262px, 회원 306px. 관심종목 버튼은 드로어에 대응 항목이
 *    없어 어느 폭에서도 빼지 않는다.
 *
 * 값은 `HeaderMobileMenu`의 드로어 쪽 표시 조건과 **같은 경계**여야 한다 — 어긋나면 어느 쪽에도
 * 토글이 없는 폭이 생긴다. 헤더에 아이콘을 더하면 이 예산을 다시 잰다
 * (`e2e/specs/header-mobile-nav.spec.ts`의 폭별 테스트가 먼저 깨진다).
 */
/** 30rem 미만에서 숨긴다 — 드로어의 `min-[30rem]:hidden`과 짝이다. */
const HIDE_BELOW_PHONE_BAR = 'max-[30rem]:hidden';
/** 22.5rem(360px) 미만에서 숨긴다. */
const HIDE_BELOW_NARROW_PHONE = 'max-[22.5rem]:hidden';

/**
 * 사이트 헤더 조립. 해석된 현재 사용자를 prop으로 받는 프레젠테이션 셸이다 — 레이어 규칙상 여기서
 * 인프라에 직접 접근하지 않는다. 훅이 없어 서버 컴포넌트로 남는다.
 */
export function Header({
    currentUser,
    loadingUserMenu,
    authNext,
    hiddenOnMobile = false,
}: HeaderProps) {
    return (
        <HeaderShell hiddenOnMobile={hiddenOnMobile}>
            <LogoLockup />
            {/*
                데스크톱 내비. Suspense로 감싸지 않는다 — 같은 내비 마크업을 전 페이지
                HTML에 fallback + 숨김 청크로 두 번 싣기만 한다(`navPanelIdUniqueness.test.tsx`).

                브레이크포인트가 `lg`(1024px)인 것은 의도다. 헤더는 고정 한 줄이고 로고·검색·
                인증 메뉴가 같은 줄을 나눠 쓰는데, `md`(768px)에 두면 768~896px 구간에서 한글이
                글자 단위로 줄바꿈돼 링크 높이가 56px 행 위아래로 삐져나온다. 드롭다운 트리거에
                캐럿(▾)이 붙어 항목당 폭이 라벨 길이만으로 결정되지 않으므로 `md` 복귀는 실측
                전까지 하지 않는다. `HeaderMobileMenu`의 `lg:hidden`과 **반드시 같은 값**이어야
                한다 — 어긋나면 둘 다 보이거나 둘 다 사라진다.
            */}
            <div className="hidden shrink-0 lg:flex">
                <HeaderNav items={NAV_TREE} />
            </div>
            {/* 모바일은 아이콘 트리거 + 전체화면 오버레이, 데스크톱은 인라인 자동완성. 폭 계약
                (`ml-auto`)까지 이 컴포넌트가 소유한다 — `HeaderSearch` JSDoc 참고. */}
            <HeaderSearch />
            {/* 관심종목 상시 진입점. ai 호스트(`authNext`가 있을 때)에는 두지 않는다 — 비회원
                관심종목은 출처별 localStorage라 ai.siglens.io에서는 비어 보이고, 목록 행·"전체 보기"가
                모두 메인 호스트로 나가는 전체 이동이 된다. */}
            {authNext === undefined && <WatchlistQuickButton />}
            {/* 모바일 갭이 **행 갭(`gap-2`)과 같아야** 한다. 검색 트리거와 햄버거는 이 div의
                형제라 행 갭을 쓰는데, 안쪽만 다른 값을 쓰면 아이콘 간격이 어긋나 보인다. 데스크톱은
                라벨이 붙어 폭이 커지므로 좁은 갭이 낫다. */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-0.5">
                {/* 모바일에서도 노출한다 — 드로어 안에도 같은 스위처가 있지만, 언어 전환을 쓰려고
                    햄버거를 여는 것은 한 홉이 더 든다. 다만 회원은 아바타가 한 칸을 더 쓰므로
                    폰 폭에서는 드로어의 스위처만 남긴다(`globals.css`의 `[data-header-locale]`). */}
                <div
                    data-header-locale=""
                    className={cn('flex', HIDE_BELOW_NARROW_PHONE)}
                >
                    <LocaleSwitcher />
                </div>
                {/* 폰 폭에서는 드로어로 옮긴다(`HeaderMobileMenu`) — 위 "폭 예산" 참고. */}
                <div className={HIDE_BELOW_PHONE_BAR}>
                    <ThemeToggle />
                </div>
                {/* 인증 영역의 폭은 `globals.css`의 `[data-header-auth-slot]`이 첫 페인트 전부터
                    잡는다(게스트 CTA 11rem / 회원 추정 2.5rem). 하이드레이션 때 CTA↔아바타 교체로
                    헤더가 밀리지 않게 한다. 내용은 오른쪽에 붙인다. */}
                <div data-header-auth-slot="" className="flex justify-end">
                    <HeaderUserMenu
                        currentUser={currentUser}
                        loading={loadingUserMenu}
                        authNext={authNext}
                    />
                </div>
            </div>
            <HeaderMobileMenu
                items={NAV_TREE}
                showAuthCta={currentUser === null && !loadingUserMenu}
                authNext={authNext}
            />
        </HeaderShell>
    );
}
