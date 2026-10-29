/**
 * Class bundles shared by the `/about` page's leaf components, so the same
 * link and heading treatment is defined once.
 */
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** An underlined in-copy link. */
export const TEXT_LINK =
    'rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** The page's section h2: the shared section token, sized up for an intro page. */
export const SECTION_TITLE = cn(HEADING_SECTION, 'text-2xl sm:text-[28px]');

/** The lede under a section h2. */
export const SECTION_SUB =
    'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400';
