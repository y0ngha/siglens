import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';

interface BotBlockedNoticeProps {
    className?: string;
}

/**
 * Neutral fallback shown when a Server Action determines that the request
 * is a bot/crawler and the analysis cache missed. Rendered in place of the
 * four analysis sections (technical, fundamental, news, overall) so we do
 * not enqueue Redis worker jobs for crawler traffic.
 *
 * Styling stays in the neutral `secondary-*` scale rather than the
 * `ui-danger` semantic — this is not an error state, just an explanation.
 */
export function BotBlockedNotice({ className }: BotBlockedNoticeProps) {
    const t = useTranslations('shared.ui');
    return (
        <div
            role="status"
            className={cn(
                'border-secondary-800 bg-secondary-900/60 space-y-2 rounded-md border p-4 text-sm',
                className
            )}
        >
            <p className="text-secondary-200">{t('BotBlockedNotice.90ee5f')}</p>
            <p className="text-secondary-300">{t('BotBlockedNotice.2040a8')}</p>
        </div>
    );
}
