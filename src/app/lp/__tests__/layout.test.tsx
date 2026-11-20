import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const { marker } = vi.hoisted(() => ({
    marker:
        (name: string) =>
        ({ children }: { children?: React.ReactNode }) =>
            React.createElement('div', { 'data-chrome': name }, children),
}));

vi.mock('@/features/visitor-ping/ui/VisitorPing', () => ({
    VisitorPing: marker('visitor-ping'),
}));
vi.mock('@/app/_components/GoogleAdsTag', () => ({
    GoogleAdsTag: marker('google-ads'),
}));
vi.mock('@/app/fontVariables', () => ({ FONT_VARIABLE_CLASSES: '' }));
vi.mock('next/script', () => ({ default: marker('script') }));
vi.mock('../../globals.css', () => ({}));

import LandingRootLayout from '@/app/lp/layout';

describe('LandingRootLayout', () => {
    const html = renderToStaticMarkup(
        <LandingRootLayout>
            <main data-testid="page" />
        </LandingRootLayout>
    );

    it('방문 비콘을 싣는다 — 광고 클릭이 이 페이지에서 시작되기 때문이다', () => {
        expect(html).toContain('data-chrome="visitor-ping"');
    });

    it('비콘은 본문 앞(테마 스크립트 다음)에 놓인다', () => {
        expect(html.indexOf('data-chrome="script"')).toBeLessThan(
            html.indexOf('data-chrome="visitor-ping"')
        );
        expect(html.indexOf('data-chrome="visitor-ping"')).toBeLessThan(
            html.indexOf('data-testid="page"')
        );
    });

    it('전역 크롬(헤더·푸터)은 여전히 없다', () => {
        expect(html).not.toContain('data-chrome="header"');
        expect(html).not.toContain('data-chrome="footer"');
    });
});
