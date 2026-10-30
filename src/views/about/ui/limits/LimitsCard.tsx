/** The `/about` limits card: what an analysis cannot do, then the disclaimer. */
import { cn } from '@/shared/lib/cn';
import { TERMS_PATH } from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { TEXT_LINK } from '../aboutStyles';

interface LimitsCardProps {
    readonly limits: readonly string[];
    readonly disclaimer: string;
    readonly termsLabel: string;
}

/** The disclaimer ends on a link to the terms page. */
export function LimitsCard({
    limits,
    disclaimer,
    termsLabel,
}: LimitsCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'mt-7 px-4 py-4 sm:px-5')}>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                {limits.map(line => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
            <p className="mt-4 border-t border-secondary-700 pt-4 text-sm leading-6 text-secondary-200">
                {disclaimer}{' '}
                <LocaleLink href={TERMS_PATH} className={TEXT_LINK}>
                    {termsLabel}
                </LocaleLink>
            </p>
        </div>
    );
}
