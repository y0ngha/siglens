/**
 * 다이제스트의 글머리 이벤트 목록.
 */
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

interface DigestEventListProps {
    events: readonly string[];
    heading: string;
    listLabel: string;
    marker: string;
    markerClassName: string;
    className?: string;
}

/** 제목 + 글머리 목록. 주요 이벤트와 예정 이벤트가 마커·간격만 달리 쓴다. 비면 그리지 않는다. */
export function DigestEventList({
    events,
    heading,
    listLabel,
    marker,
    markerClassName,
    className,
}: DigestEventListProps) {
    if (events.length === 0) return null;
    return (
        <div className={className}>
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>{heading}</h3>
            <ul className="space-y-1.5" aria-label={listLabel}>
                {events.map((event, index) => (
                    <li
                        // 문장 외에 안정 id가 없고 같은 문장이 두 번 나올 수 있어 인덱스를 함께 쓴다(정적 목록).
                        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                        key={`${index}-${event}`}
                        className="flex min-w-0 gap-2 text-sm wrap-break-word text-secondary-400"
                    >
                        <span aria-hidden="true" className={markerClassName}>
                            {marker}
                        </span>
                        <span className="min-w-0 wrap-break-word">{event}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
