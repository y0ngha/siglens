import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import type { DeveloperSectionId } from '../../lib/developersContent';

interface Props {
    readonly id: DeveloperSectionId;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

/**
 * 본문 섹션 하나. 목차 링크(`#<id>`)가 닿는 자리는 `h2`이고, 고정 헤더 아래로 숨지 않도록 `scroll-mt-24`를 준다.
 * 섹션은 그 `h2`로 이름 붙는다(`aria-labelledby`).
 */
export function DeveloperSection({ id, title, sub, children }: Props) {
    return (
        <section aria-labelledby={id} className="mt-14 first:mt-0">
            <h2 id={id} className={cn(HEADING_SECTION, 'scroll-mt-24')}>
                {title}
            </h2>
            {sub ? (
                <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            {children}
        </section>
    );
}
