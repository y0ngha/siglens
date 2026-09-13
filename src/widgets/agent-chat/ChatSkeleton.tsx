import { useTranslations } from 'next-intl';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

const BAR = cn('rounded motion-safe:animate-pulse', PLACEHOLDER_ON_CARD);

/**
 * Route-level loading state for the chat pages. Mirrors `ChatShell`'s frame
 * (rail on the left, centred column) so the real screen lands without a
 * layout shift; the shared header above it comes from the layout and stays
 * put.
 */
export function ChatSkeleton() {
    const t = useTranslations('widgets.agent-chat');
    return (
        <div
            className="flex min-h-[calc(100dvh-3.5rem)]"
            aria-busy="true"
            aria-label={t('ChatSkeleton.loading')}
            role="status"
        >
            <aside className="hidden w-64 shrink-0 border-r border-border-control p-3 lg:block">
                <div className={cn(BAR, 'h-10 w-full rounded-lg')} />
                <div className="mt-6 space-y-2">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className={cn(
                                BAR,
                                'h-8',
                                i % 2 ? 'w-4/5' : 'w-full'
                            )}
                        />
                    ))}
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
                    <div className="flex justify-end">
                        <div className={cn(BAR, 'h-10 w-2/5 rounded-lg')} />
                    </div>
                    <div className="mt-7 flex items-start gap-3">
                        <div className={cn(BAR, 'size-7 rounded-full')} />
                        <div className="flex-1 space-y-2.5 pt-1">
                            <div className={cn(BAR, 'h-4 w-full')} />
                            <div className={cn(BAR, 'h-4 w-11/12')} />
                            <div className={cn(BAR, 'h-4 w-3/5')} />
                        </div>
                    </div>
                </div>
                <div className="px-4 pb-4">
                    <div
                        className={cn(
                            BAR,
                            'mx-auto h-14 w-full max-w-3xl rounded-lg'
                        )}
                    />
                </div>
            </div>
        </div>
    );
}
