import { RadarRequestDialog } from '@/features/radar-request/ui/RadarRequestDialog';
import {
    RADAR_DASHBOARDS,
    RADAR_SITE_URL,
    radarDashboardUrl,
} from '@/shared/config/radar';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface HomeRadarCtaProps {
    readonly title: string;
    readonly badge: string;
    readonly body: string;
    readonly viewAllLabel: string;
    readonly requestPrompt: string;
    readonly requestCta: string;
    /** 칩 `aria-label`을 만든다. 대시보드 이름을 받아 한 문장으로 돌려준다. */
    readonly chipAriaLabel: (name: string) => string;
}

const LINK_FOCUS =
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 홈의 종목 레이더 진입 카드(한국어 전용 — 목적지가 한국어 전용 대시보드다).
 *
 * 목적지는 다른 오리진이라 새 탭 없이 일반 `<a>`로 건다(`AiNavLink`와 같은 이유). 문구는 페이지가
 * 번역해 넘긴다(`HomeBacktestingCta`와 같은 이유). 칩은 좁은 화면에서 줄바꿈되고, 모든 링크는
 * 터치 높이 44px 이상이다.
 */
export function HomeRadarCta({
    title,
    badge,
    body,
    viewAllLabel,
    requestPrompt,
    requestCta,
    chipAriaLabel,
}: HomeRadarCtaProps) {
    return (
        <div className={cn(SURFACE_CARD, 'space-y-4 px-6 py-6')}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-secondary-100">
                            {title}
                        </h2>
                        <span className="rounded border border-primary-500/60 px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide text-primary-300">
                            {badge}
                        </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                        {body}
                    </p>
                </div>
                <a
                    href={RADAR_SITE_URL}
                    className={cn(
                        'inline-flex min-h-11 items-center rounded text-sm font-medium text-primary-400 hover:underline',
                        LINK_FOCUS
                    )}
                >
                    {viewAllLabel} ↗
                </a>
            </div>

            <ul className="flex flex-wrap gap-2">
                {RADAR_DASHBOARDS.map(dashboard => (
                    <li key={dashboard.slug}>
                        <a
                            href={radarDashboardUrl(dashboard.slug)}
                            aria-label={chipAriaLabel(dashboard.label)}
                            className={cn(
                                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-control bg-secondary-950 px-4 text-sm font-medium text-secondary-100 transition-colors hover:border-primary-500',
                                LINK_FOCUS
                            )}
                        >
                            {dashboard.label}
                            <span className="text-secondary-400">
                                ${dashboard.ticker}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>

            <div className="flex flex-wrap items-center gap-x-3 border-t border-secondary-700 pt-3 text-sm">
                <span className="text-secondary-400">{requestPrompt}</span>
                <RadarRequestDialog
                    triggerLabel={requestCta}
                    triggerClassName="inline-flex min-h-11 items-center font-medium text-primary-400 hover:underline"
                />
            </div>
        </div>
    );
}
