/**
 * `/methodology` 본문 섹션 하나의 틀(앵커가 걸린 `<h2>`와 부제).
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import type { MethodologySectionId } from '../../lib/methodologySections';

interface Props {
    readonly id: MethodologySectionId;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

/**
 * 섹션 랜드마크. id는 `<h2>`에 달려 목차·외부 링크의 앵커가 되고, 섹션은 그 제목으로
 * 이름 붙는다(`aria-labelledby`). `scroll-mt-24`는 고정 헤더에 제목이 가리지 않게 한다.
 */
export function MethodologySection({ id, title, sub, children }: Props) {
    return (
        <section aria-labelledby={id} className="mt-16">
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
