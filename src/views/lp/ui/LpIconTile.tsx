/**
 * The square icon tile on the landing pages' cards.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import type { LpIcon } from '../lib/types';

interface LpIconTileProps {
    readonly Icon: LpIcon;
    readonly className?: string;
}

/** A decorative icon on a nested surface; the card's heading carries the meaning. */
export function LpIconTile({ Icon, className }: LpIconTileProps) {
    return (
        <span
            className={cn(
                SURFACE_NESTED,
                'flex size-10 items-center justify-center text-secondary-200',
                className
            )}
        >
            <Icon className="size-5" />
        </span>
    );
}
