import { cn } from '@/shared/lib/cn';
import { SKELETON_BAR, SKELETON_BLOCK_RADIUS } from '../../model/barClasses';

interface SkeletonCardsProps {
    readonly count: number;
    /** 격자 열 클래스(`grid-cols-*`). */
    readonly grid: string;
    /** 카드 한 장의 높이 클래스. */
    readonly card: string;
}

/**
 * 카드 격자 자리 — 같은 크기의 카드 막대 `count`장.
 */
export function SkeletonCards({ count, grid, card }: SkeletonCardsProps) {
    const cards = Array.from({ length: count }, () => card);
    return (
        <div className={cn('grid gap-3', grid)}>
            {cards.map((cardClass, i) => (
                <div
                    // 개수만 정해진 정적 장식 카드라 정체성이 없고 재정렬되지 않는다.
                    // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                    key={i}
                    className={cn(
                        SKELETON_BAR,
                        SKELETON_BLOCK_RADIUS,
                        cardClass
                    )}
                />
            ))}
        </div>
    );
}
