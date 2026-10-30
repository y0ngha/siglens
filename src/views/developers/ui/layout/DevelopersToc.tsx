import { cn } from '@/shared/lib/cn';
import type { DeveloperSectionId } from '../../lib/developersContent';
import { TOC_LINK } from '../developersStyles';

/** 목차 항목 하나: 섹션 id와 그 제목. */
export interface TocItem {
    readonly id: DeveloperSectionId;
    readonly label: string;
}

interface Props {
    readonly label: string;
    readonly items: readonly TocItem[];
}

/**
 * 섹션 목차. `lg` 이상에서는 헤더 아래에 따라다니는(sticky) 세로 목록, 그 아래에서는 본문 위에 쌓이는 칩 줄이다 —
 * 같은 `<nav>` 하나가 두 배치를 다 맡아 랜드마크와 링크가 한 벌만 있다.
 */
export function DevelopersToc({ label, items }: Props) {
    return (
        <nav
            aria-label={label}
            className="mb-10 border-y border-secondary-700 py-2 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:mb-0 lg:self-start lg:border-y-0 lg:border-l lg:py-0"
        >
            <ul className="flex flex-wrap gap-x-1 lg:flex-col lg:gap-x-0">
                {items.map(item => (
                    <li key={item.id} className="lg:w-full">
                        <a
                            href={`#${item.id}`}
                            className={cn(TOC_LINK, 'lg:pl-4')}
                        >
                            {item.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
