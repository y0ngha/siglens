/**
 * 사실 요약의 최근 헤드라인 번호 목록.
 */
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { HeadlineItem } from '../../utils/newsFacts';

interface HeadlineListProps {
    heading: string;
    headlines: readonly HeadlineItem[];
}

/** 헤드라인이 없으면 아무것도 그리지 않는다. */
export function HeadlineList({ heading, headlines }: HeadlineListProps) {
    if (headlines.length === 0) return null;
    return (
        <div>
            <h3 className={HEADING_SUBSECTION}>{heading}</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
                {headlines.map(headline => (
                    <li key={headline.id}>{headline.title}</li>
                ))}
            </ol>
        </div>
    );
}
