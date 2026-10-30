import { cn } from '@/shared/lib/cn';
import { SKELETON_BAR, SKELETON_LINE_WIDTHS } from '../../model/barClasses';
import { cycleTake } from '../../utils/cycleTake';

/**
 * 본문 문단 자리 — `count`줄의 막대를 폭을 번갈아 가며 쌓는다.
 */
export function SkeletonLines({ count }: { readonly count: number }) {
    const widths = cycleTake(SKELETON_LINE_WIDTHS, count);
    return (
        <div className="space-y-2">
            {widths.map((width, i) => (
                <div
                    // 개수만 정해진 정적 장식 줄이라 정체성이 없고, 폭 값은 줄마다 겹친다.
                    // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                    key={i}
                    className={cn(SKELETON_BAR, 'h-4', width)}
                />
            ))}
        </div>
    );
}
