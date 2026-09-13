import { cn } from '@/shared/lib/cn';

/**
 * "Beta" tag for SiglensAI — sits next to the `AI` wordmark in the header and
 * in the product's own eyebrow. Same mono/tracked grammar as the wordmark so it
 * reads as part of the lockup, not a sticker. The word is a product label, not
 * copy: it stays in Latin script in every locale and is excluded from page
 * translators.
 */
export function BetaBadge({ className }: { readonly className?: string }) {
    return (
        <span
            translate="no"
            className={cn(
                'inline-flex items-center rounded border border-primary-400/40 px-1 py-px font-mono text-[9px] leading-none font-semibold tracking-[0.12em] text-primary-400 uppercase select-none',
                className
            )}
        >
            Beta
        </span>
    );
}
