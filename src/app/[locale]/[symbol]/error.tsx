'use client';

import { useTranslations } from 'next-intl';
import { RouteErrorView } from '@/app/_components/RouteErrorView';
import { SuppressSymbolBottomAd } from '@/features/ad-slot/model/SymbolBottomAdContext';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';

interface SymbolErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the whole `[symbol]` subtree (chart / fundamental / news /
 * options / fear-greed / overall).
 *
 * These routes fan out to external providers (FMP / Yahoo / LLM). Most call
 * sites degrade gracefully, but any uncaught throw during render — e.g. an FMP
 * infra failure on a cold ISR cache — would otherwise surface as a bare 500.
 * This boundary contains that into a branded, retryable UI. `reset()` re-renders
 * the segment (a fresh attempt, which on transient outages will often succeed).
 *
 * The boundary sits inside the `[symbol]` layout, so the layout's shared bottom ad would
 * stay under the error view. AdSense forbids ads on error screens, so it is suppressed here.
 */
export default function SymbolError({ error, reset }: SymbolErrorProps) {
    const t = useTranslations('app.symbol');
    const locale = useCurrentLocale();
    return (
        <>
            <SuppressSymbolBottomAd />
            <RouteErrorView
                error={error}
                reset={reset}
                logTag="SymbolRoute"
                eyebrow={t('error.729779')}
                title={t('error.0de4f6')}
                body={t('error.2e23eb')}
                retryLabel={t('error.0c767c')}
                homeLabel={t('error.eb2523', { v0: brandName(locale) })}
                containerClassName="symbol-container"
            />
        </>
    );
}
