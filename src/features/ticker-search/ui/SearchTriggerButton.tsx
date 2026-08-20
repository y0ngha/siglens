'use client';

import { cn } from '@/shared/lib/cn';
import { SEARCH_TRIGGER_LABEL } from '../lib/searchLabels';

/**
 * 돋보기 글리프. 헤더 아이콘 버튼과 홈 히어로 트리거가 **같은 모양**을 써야 하므로
 * 별도 export로 둔다. 아이콘 패키지를 쓰지 않는 이유는 `SearchTriggerButton` JSDoc 참고.
 */
export function SearchGlyph({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

interface SearchTriggerButtonProps {
    onClick: () => void;
    className?: string;
}

/**
 * 모바일 헤더의 검색 진입점. 탭하면 전체화면 오버레이가 열린다.
 *
 * 인라인 입력을 아이콘으로 줄이는 이유는 폭이다 — 390px 헤더에서 로고·입력·검색버튼·
 * 회원가입·햄버거가 경쟁해 입력이 104px(한글 6자)까지 눌렸다. 아이콘 하나로 줄이면
 * 그 폭이 오버레이 전폭으로 옮겨 간다.
 *
 * `ml-auto`가 이 버튼에 붙는 것은 **레이아웃 계약**이다. 원래 헤더에서 유저메뉴와
 * 햄버거를 오른쪽 끝으로 미는 것은 검색 래퍼의 `ml-auto` 하나뿐이었는데, 그 래퍼가
 * 모바일에서 `display:none`이 되면 `ml-auto`도 함께 사라져 CTA와 햄버거가 로고 쪽으로
 * 붕괴한다. 그래서 모바일에서 보이는 이 버튼이 그 역할을 이어받는다.
 *
 * 아이콘은 **인라인 SVG**다. `features/ticker-search` 배럴은 이미 33개 전 라우트의
 * first-load 청크에 들어 있다 — root layout의 `SearchOverlayProvider`와 헤더의
 * `HeaderSearch`(둘 다 클라이언트 컴포넌트)가 이 배럴을 소비하고 `package.json`에
 * `sideEffects`가 없어 미사용 re-export가 제거되지 않기 때문이다. 아이콘 패키지를
 * 들이면 그 무게가 그대로 전역으로 퍼진다.
 * `widgets/layout/HeaderMobileMenu`도 같은 이유로 인라인 SVG를 쓴다.
 */
export function SearchTriggerButton({
    onClick,
    className,
}: SearchTriggerButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={SEARCH_TRIGGER_LABEL}
            className={cn(
                // 44×44 — WCAG 2.5.8 최소 타깃.
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg',
                'text-secondary-300 transition-colors hover:bg-secondary-800 hover:text-secondary-100',
                'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                className
            )}
        >
            <SearchGlyph />
        </button>
    );
}
