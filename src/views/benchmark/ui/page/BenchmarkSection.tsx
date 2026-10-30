/**
 * 벤치마크 본문의 구역 틀(h2 + 부제 + 본문).
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface Props {
    /** h2의 id. 구역 이름(`aria-labelledby`)과 앵커 링크가 이 값을 쓴다. */
    readonly id: string;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

/** 제목이 이름이 되는 본문 구역. */
export function BenchmarkSection({ id, title, sub, children }: Props) {
    return (
        <section aria-labelledby={id} className="mt-14 first:mt-0">
            <h2 id={id} className={cn(HEADING_SECTION, 'scroll-mt-24')}>
                {title}
            </h2>
            {sub ? (
                <p className="mt-2 text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            <div className="mt-5">{children}</div>
        </section>
    );
}
