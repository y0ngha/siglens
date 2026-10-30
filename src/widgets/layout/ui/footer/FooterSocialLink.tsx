import type { ReactNode } from 'react';

interface FooterSocialLinkProps {
    readonly href: string;
    /** 아이콘만 보이는 링크의 접근 가능한 이름(보이는 글자가 없으므로 전체 이름을 적는다). */
    readonly label: string;
    readonly children: ReactNode;
}

/**
 * 외부 소셜 링크(아이콘 버튼). 새 탭으로 열고 opener를 끊는다 — `noreferrer`는 `noopener`를
 * 포함하지만 둘 다 적어 의도를 남긴다.
 *
 * 아이콘은 20px이지만 터치 영역은 44px(`size-11`)이다. 음수 마진(`-m-3`)이 늘어난 12px씩을 되돌려
 * 레이아웃 몫은 20px 그대로고, 행 간격(`gap-x-6` = 24px)이 이웃 상자와의 바깥 여백 합(12 + 12)과
 * 같아 상자끼리 겹치지 않는다.
 */
export function FooterSocialLink({
    href,
    label,
    children,
}: FooterSocialLinkProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="-m-3 inline-flex size-11 items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {children}
        </a>
    );
}
