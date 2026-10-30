import React from 'react';

const { marker } = vi.hoisted(() => ({
    marker:
        (name: string) =>
        ({ children }: { children?: React.ReactNode }) =>
            React.createElement('div', { 'data-chrome': name }, children),
}));

vi.mock('@/app/_components/AuthSessionHeaderClient', () => ({
    AuthSessionHeaderClient: marker('header'),
}));
vi.mock('@/app/_components/RoutePendingSlot', () => ({
    RoutePendingSlot: marker('route-pending'),
}));
vi.mock('@/app/providers', () => ({ ReactQueryProvider: marker('query') }));
vi.mock('@/widgets/layout/Footer', () => ({ Footer: marker('footer') }));
vi.mock('@/widgets/notice-popup/ui/NoticePopupLoader', () => ({
    NoticePopupLoader: marker('notice'),
}));
vi.mock('@/features/pwa-install/ui/PwaBanner', () => ({
    PwaBanner: marker('pwa'),
}));
vi.mock('@/features/watchlist/ui/WatchlistMergeHost', () => ({
    WatchlistMergeHost: marker('watchlist-merge'),
}));
vi.mock('@/features/analysis-rate-limit/ui/AnalysisRateLimitModalHost', () => ({
    AnalysisRateLimitModalHost: marker('rate-limit'),
}));
vi.mock('@/features/email-report-nudge/ui/EmailReportNudgeHost', () => ({
    EmailReportNudgeHost: marker('email-nudge'),
}));
vi.mock('@/features/visitor-ping/ui/VisitorPing', () => ({
    VisitorPing: marker('visitor-ping'),
}));
vi.mock('@/features/visitor-ping/ui/FunnelSignupPing', () => ({
    FunnelSignupPing: marker('funnel-ping'),
}));
vi.mock('@/features/ticker-search/model/SearchOverlayContext', () => ({
    SearchOverlayProvider: marker('search-overlay'),
}));
vi.mock('@/shared/model/NavigationPendingContext', () => ({
    NavigationPendingProvider: marker('navigation-pending'),
}));
vi.mock('@/shared/ui/ToastProvider', () => ({
    ToastProvider: marker('toast'),
}));

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLocale, useMessages } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { SiteChrome } from '@/app/_components/SiteChrome';

function LocaleProbe() {
    return (
        <>
            <span>app-locale:{useCurrentLocale()}</span>
            <span>intl-locale:{useLocale()}</span>
            <span>namespaces:{Object.keys(useMessages()).join(',')}</span>
        </>
    );
}

function chromeOrder(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-chrome]')].map(
        element => element.getAttribute('data-chrome') ?? ''
    );
}

describe('SiteChrome', () => {
    it('페이지를 헤더 뒤·푸터 앞의 라우트 전환 슬롯 안에 그린다', () => {
        const { container } = render(
            <SiteChrome locale="ko" messages={{}}>
                <p>page body</p>
            </SiteChrome>
        );

        const order = chromeOrder(container);
        expect(order.indexOf('header')).toBeLessThan(
            order.indexOf('route-pending')
        );
        expect(order.indexOf('route-pending')).toBeLessThan(
            order.indexOf('footer')
        );
        expect(
            container.querySelector('[data-chrome="route-pending"]')
        ).toContainElement(screen.getByText('page body'));
    });

    it('받은 로케일·메시지를 번역 프로바이더에, 로케일을 LocaleProvider에 넘긴다', () => {
        render(
            <SiteChrome locale="en" messages={{ widgets: {}, shared: {} }}>
                <LocaleProbe />
            </SiteChrome>
        );

        expect(screen.getByText('app-locale:en')).toBeInTheDocument();
        expect(screen.getByText('intl-locale:en')).toBeInTheDocument();
        expect(
            screen.getByText('namespaces:widgets,shared')
        ).toBeInTheDocument();
    });

    it('루트 호스트(비콘·배너·모달)를 모두 한 번씩 싣는다', () => {
        const { container } = render(
            <SiteChrome locale="ko" messages={{}}>
                {null}
            </SiteChrome>
        );

        expect(chromeOrder(container)).toEqual([
            'query',
            'navigation-pending',
            'toast',
            'search-overlay',
            'visitor-ping',
            'funnel-ping',
            'pwa',
            'notice',
            'rate-limit',
            'email-nudge',
            'watchlist-merge',
            'header',
            'route-pending',
            'footer',
        ]);
    });
});
