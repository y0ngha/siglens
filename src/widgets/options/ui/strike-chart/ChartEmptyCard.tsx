import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

interface ChartEmptyCardProps {
    /** Chart title, kept so the empty state lines up with its sibling chart. */
    title: string;
    /** Explanation of why there is nothing to draw. */
    message: string;
}

/**
 * Empty state for a strike chart. Uses the same card as the populated chart so
 * the two sibling charts keep equal visual weight on the grid.
 */
export function ChartEmptyCard({ title, message }: ChartEmptyCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'space-y-2 p-4')}>
            <span className="text-sm font-medium text-secondary-300">
                {title}
            </span>
            <p className="text-xs leading-relaxed text-secondary-500">
                {message}
            </p>
        </div>
    );
}
