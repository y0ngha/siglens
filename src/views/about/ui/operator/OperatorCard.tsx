/** Who runs SIGLENS and how to reach them — the `/about` page's E-E-A-T anchor. */
import { cn } from '@/shared/lib/cn';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { GithubIcon } from '@/shared/ui/GithubIcon';
import type { OperatorLink } from '../../lib/types';
import { TEXT_LINK } from '../aboutStyles';

interface OperatorCardProps {
    /** What the operator does, e.g. "개발·운영". */
    readonly jobTitle: string;
    readonly body: string;
    /** Contact and source links (absolute URLs, so plain `<a>`). */
    readonly links: readonly OperatorLink[];
}

/**
 * The operator's name with their role, a short statement of independence and
 * the contact/source links.
 *
 * The `{' '}` between name and role keeps them apart in the page text (the
 * role span's own margin is trimmed by the width of that space).
 */
export function OperatorCard({ jobTitle, body, links }: OperatorCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'mt-7 p-5 sm:p-6')}>
            <p className="text-base font-semibold text-secondary-50">
                <span translate="no">{SITE_OPERATOR.name}</span>{' '}
                <span className="ml-1 text-xs font-normal text-secondary-400">
                    {jobTitle}
                </span>
            </p>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-secondary-300">
                {body}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {links.map(({ href, label, rel, withGithubIcon }) => (
                    <li key={href}>
                        <a
                            href={href}
                            rel={rel}
                            className={cn(
                                TEXT_LINK,
                                'inline-flex min-h-10 items-center',
                                withGithubIcon && 'gap-1.5'
                            )}
                        >
                            {withGithubIcon ? (
                                <GithubIcon className="size-4" />
                            ) : null}
                            {label}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
