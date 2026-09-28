'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SearchIcon } from '@/shared/ui/StrokeIcons';
import { SEARCH_TRIGGER_LABEL_KEY } from '../lib/searchLabels';

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
 * 아이콘은 `shared/ui/StrokeIcons`의 **인라인 SVG**다. 이 버튼은 root layout의 `SearchOverlayProvider`와 헤더의
 * `HeaderSearch`(둘 다 클라이언트 컴포넌트)를 통해 33개 전 라우트의 first-load 청크에
 * 들어간다. 아이콘 패키지를 들이면 그 무게가 그대로 전역으로 퍼진다.
 * `widgets/layout/HeaderMobileMenu`도 같은 이유로 인라인 SVG를 쓴다.
 */
export function SearchTriggerButton({
    onClick,
    className,
}: SearchTriggerButtonProps) {
    const t = useTranslations('features.ticker-search');
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t(SEARCH_TRIGGER_LABEL_KEY)}
            className={cn(
                // 44×44 — WCAG 2.5.8 최소 타깃.
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg',
                'text-secondary-300 transition-colors hover:bg-secondary-800 hover:text-secondary-100',
                'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                className
            )}
        >
            <SearchIcon className="size-5" />
        </button>
    );
}
