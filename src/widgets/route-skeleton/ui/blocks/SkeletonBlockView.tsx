import { cn } from '@/shared/lib/cn';
import { SKELETON_BAR, SKELETON_BLOCK_RADIUS } from '../../model/barClasses';
import type { SkeletonBlock } from '../../types';
import { SkeletonCards } from './SkeletonCards';
import { SkeletonLines } from './SkeletonLines';

/**
 * 골격 블록 한 개를 `type`에 맞는 leaf로 그린다.
 */
export function SkeletonBlockView({
    block,
}: {
    readonly block: SkeletonBlock;
}) {
    switch (block.type) {
        case 'title':
            return <div className={cn(SKELETON_BAR, block.className)} />;
        case 'panel':
            return (
                <div
                    className={cn(
                        SKELETON_BAR,
                        SKELETON_BLOCK_RADIUS,
                        block.className
                    )}
                />
            );
        case 'lines':
            return <SkeletonLines count={block.count} />;
        case 'cards':
            return (
                <SkeletonCards
                    count={block.count}
                    grid={block.grid}
                    card={block.card}
                />
            );
    }
}
