/**
 * AI가 만든 사건 문장 목록 — 핵심 사건과 예정 사건이 마커만 달리해 같은 목록을 쓴다.
 */
import { cn } from '@/shared/lib/cn';

interface EventBulletListProps {
    events: readonly string[];
    marker: string;
    ariaLabel: string;
    /** 마커에 덧붙일 색 클래스. */
    markerClassName?: string;
}

/**
 * 키는 인덱스다 — AI 문장은 유일하다는 보장이 없어 문장을 키로 쓰면 중복 키가 생긴다. 목록은 정적이고
 * 재정렬되지 않으므로 인덱스가 안전하다.
 */
export function EventBulletList({
    events,
    marker,
    ariaLabel,
    markerClassName,
}: EventBulletListProps) {
    return (
        <ul className="space-y-1.5" aria-label={ariaLabel}>
            {events.map((event, index) => (
                <li
                    key={index}
                    className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
                >
                    <span
                        aria-hidden="true"
                        className={cn('mt-0.5 shrink-0', markerClassName)}
                    >
                        {marker}
                    </span>
                    <span className="min-w-0 wrap-break-word">{event}</span>
                </li>
            ))}
        </ul>
    );
}
