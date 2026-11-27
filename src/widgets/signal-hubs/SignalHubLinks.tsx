import type { ReactElement } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

export interface SignalHubLinkItem {
    readonly href: string;
    readonly label: string;
}

interface SignalHubLinksProps {
    readonly heading: string;
    readonly headingId: string;
    /** 그릴 링크 — 목록·경로·문구는 호출 라우트가 만든다(위젯은 표시만 맡는다). */
    readonly links: readonly SignalHubLinkItem[];
    readonly className?: string;
    /**
     * 제목 단계. 기본 `h2`(`/market` 본문 끝처럼 자기 섹션일 때). 다른 카드 안에 들어가는
     * 홈 "오늘의 시장"은 `h3`로 내려 위계를 지킨다(DS-4).
     */
    readonly headingLevel?: 'h2' | 'h3';
}

/**
 * 신호 페이지(`/market/signals/*`)로 가는 링크 묶음. `/market` 본문 끝(입구, `src/app/CLAUDE.md#AP-4`)과
 * 신호 페이지의 "다른 신호" 내비가 같은 모양을 쓴다. 서버 렌더라 크롤러도 따라간다.
 */
export function SignalHubLinks({
    heading,
    headingId,
    links,
    className,
    headingLevel = 'h2',
}: SignalHubLinksProps): ReactElement {
    const Heading = headingLevel;
    return (
        <nav aria-labelledby={headingId} className={cn(className)}>
            <Heading
                id={headingId}
                className={
                    headingLevel === 'h2' ? HEADING_SECTION : HEADING_SUBSECTION
                }
            >
                {heading}
            </Heading>
            <ul className="mt-3 flex flex-wrap gap-2">
                {links.map(link => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            prefetch={false}
                            className="inline-flex min-h-9 items-center rounded-full border border-border-control px-3 text-xs text-secondary-200 hover:border-primary-500 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
