import type { GuideFaqItem } from '@/entities/guide/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';

interface GuideFaqProps {
    readonly heading: string;
    readonly items: readonly GuideFaqItem[];
}

const FAQ_HEADING_ID = 'guide-faq-heading';

/**
 * 항목 FAQ — 접고 펴는 `details`. 닫혀 있어도 답변은 HTML에 있고, JSON-LD `FAQPage`는
 * 라우트가 **같은 배열**로 만든다(구글은 마크업과 보이는 질문·답변이 같을 것을 요구한다).
 * `details`는 네이티브 토글이라 키보드(Enter/Space)와 `aria-expanded` 의미가 따로 필요 없다.
 */
export function GuideFaq({ heading, items }: GuideFaqProps) {
    if (items.length === 0) return null;
    return (
        <section aria-labelledby={FAQ_HEADING_ID} className="mt-14">
            <h2 id={FAQ_HEADING_ID} className={HEADING_SECTION}>
                {heading}
            </h2>
            <div className="mt-4 space-y-3">
                {items.map(({ q, a }) => (
                    <details key={q} className={cn(SURFACE_CARD, 'group')}>
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                            <span>{q}</span>
                            <ChevronDownIcon className="size-4 shrink-0 text-secondary-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                        </summary>
                        <p className="px-4 pb-4 text-sm leading-relaxed text-secondary-300">
                            {a}
                        </p>
                    </details>
                ))}
            </div>
        </section>
    );
}
