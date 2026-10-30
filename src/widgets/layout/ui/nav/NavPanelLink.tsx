import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';

type NavPanelLinkTone = 'overview' | 'region' | 'leaf';

// 패널 항목도 트리거와 같은 한글 라벨(`미국`·`한국`·`전체`)이라 0.08em 자간을 걷어내고
// 크기를 트리거(14px)에 맞춘다. 이 항목들은 메뉴가 닫혀 있을 때 `visibility: hidden`이라
// 조판 검사에서 걸러지기 쉬운데, 메뉴를 열면 그대로 보이므로 예외가 아니다.
const ITEM_BASE =
    'flex min-h-11 touch-manipulation items-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:-outline-offset-2';

const TONE_LAYOUT: Record<NavPanelLinkTone, string> = {
    overview: 'px-4',
    region: 'px-4',
    // 들여쓰기로 계층을 표현한다. 지역 링크와 같은 눈금에 두면 `미국`과 `미국 주식`이
    // 형제로 보여 무엇이 상위인지 사라진다.
    leaf: 'pr-4 pl-7 font-normal',
};

const TONE_IDLE: Record<NavPanelLinkTone, string> = {
    overview:
        'text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100',
    region: 'text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100',
    leaf: 'text-secondary-500 hover:bg-secondary-800 hover:text-secondary-200',
};

interface NavPanelLinkProps {
    readonly href: string;
    readonly label: string;
    readonly active: boolean;
    readonly tone: NavPanelLinkTone;
    readonly onNavigate: () => void;
}

/**
 * 드롭다운 패널의 링크 한 줄. 개요·지역·하위 목적지가 같은 컴포넌트를 쓰고 들여쓰기·구분선만 다르다.
 *
 * 전역 헤더 링크라 `prefetch`를 끈다 — 진입 페이지마다 다른 `_rsc` 해시가 CDN 캐시를 파편화시킨다.
 */
export function NavPanelLink({
    href,
    label,
    active,
    tone,
    onNavigate,
}: NavPanelLinkProps) {
    return (
        <Link
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
                ITEM_BASE,
                TONE_LAYOUT[tone],
                active ? 'bg-secondary-800 text-secondary-100' : TONE_IDLE[tone]
            )}
        >
            {label}
        </Link>
    );
}
