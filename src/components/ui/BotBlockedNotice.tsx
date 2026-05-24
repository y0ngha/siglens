import { cn } from '@/lib/cn';

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
    return (
        <div
            role="status"
            className={cn(
                'border-secondary-800 bg-secondary-900/60 space-y-2 rounded-md border p-4 text-sm',
                className
            )}
        >
            <p className="text-secondary-200">
                봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.
            </p>
            <p className="text-secondary-300">
                실제 사용자라면 새로고침하거나 다른 브라우저로 접속해 보세요.
            </p>
        </div>
    );
}
