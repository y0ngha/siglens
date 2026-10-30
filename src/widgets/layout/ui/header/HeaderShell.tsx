import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface HeaderShellProps {
    /**
     * 모바일(`lg` 미만)에서 헤더를 화면 위로 밀어 숨긴다(ai 호스트, 아래로 스크롤하는 동안).
     * 데스크톱에는 자리가 있어 항상 고정한다.
     */
    readonly hiddenOnMobile: boolean;
    readonly children: ReactNode;
}

/**
 * 사이트 헤더의 `<header>` 셸 — 고정 위치·표면·높이 행.
 *
 * 최상위 `<header>`는 암시적으로 `role="banner"`이므로 role을 명시하지 않는다(중복 ARIA).
 *
 * `inert`는 화면 밖으로 나간 헤더와 그 안의 포커스 가능한 컨트롤을 탭·클릭·스크린리더에서
 * 닿지 않게 한다 — `-translate-y-full`만으로는 시각적으로만 가려져 포커스 트랩이 남는다.
 * `hiddenOnMobile`은 `lg` 미만에서만 `true`가 되어(`useHideOnScrollDown`의 미디어 쿼리 게이트)
 * 아래 `max-lg:` 변형과 같은 경계를 쓴다 — 데스크톱에서 CSS는 헤더를 보이게 고정하는데
 * `inert`만 걸리는 일이 없다.
 *
 * 크롬은 **뷰포트에** 맞춘다(전폭 `px-4`). 심볼 페이지의 브레드크럼·탭·차트 제목이 모두 16px에
 * 서 있으므로 헤더 로고도 같은 선에 둬야 제품의 주 표면에서 좌측이 하나로 읽힌다. 푸터도 같은
 * 규약을 쓴다. 본문과는 1px 선 대신 옅은 빛 한 줄·짧은 그늘로 나눈다(`.surface-bar`).
 */
export function HeaderShell({ hiddenOnMobile, children }: HeaderShellProps) {
    return (
        <header
            data-scroll-chrome=""
            inert={hiddenOnMobile}
            className={cn(
                'surface-bar sticky top-0 z-50 bg-secondary-900/90 backdrop-blur-md transition-transform duration-200 supports-backdrop-filter:bg-secondary-900/75 motion-reduce:transition-none',
                hiddenOnMobile && 'max-lg:-translate-y-full'
            )}
        >
            <div className="flex h-(--header-h) items-center gap-2 px-4 sm:gap-4">
                {children}
            </div>
        </header>
    );
}
