/** One numbered step of the `/about` method section. */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { MethodStep } from '../../lib/types';

interface MethodStepCardProps {
    readonly step: MethodStep;
    /** 1-based position in the parent `<ol>`. */
    readonly number: number;
}

/**
 * The number badge only repeats the parent `<ol>`'s own numbering, so it is
 * `aria-hidden` and the step reads as its h3 and body.
 */
export function MethodStepCard({ step, number }: MethodStepCardProps) {
    return (
        <li className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
            <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full border border-border-control text-xs font-semibold text-secondary-200 tabular-nums"
            >
                {number}
            </span>
            <h3 className={cn('mt-3', HEADING_SUBSECTION)}>{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-secondary-300">
                {step.body}
            </p>
        </li>
    );
}
