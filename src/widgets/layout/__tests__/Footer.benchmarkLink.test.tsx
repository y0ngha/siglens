vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('../ContactDialog', () => ({
    ContactDialog: () => null,
}));
vi.mock('../CurrentYear', () => ({
    CurrentYear: () => <>2026</>,
}));
// 게이트만 연다. 나머지 설정은 실제 값이다.
vi.mock('@/shared/config/benchmark', () => ({
    BENCHMARK_PUBLISHED: true,
    BENCHMARK_PATH: '/benchmark',
}));

import React from 'react';
import { screen } from '@testing-library/react';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import en from '../../../../messages/en.json';
import ko from '../../../../messages/ko.json';
import { Footer } from '../Footer';

describe('Footer benchmark link once the gate is open', () => {
    it('points at the canonical ai-host page with an absolute URL', () => {
        renderWithIntl(<Footer />);
        expect(
            screen
                .getByRole('link', {
                    name: ko.widgets.layout.Footer.benchmarkLink,
                })
                .getAttribute('href')
        ).toBe(`${AI_SITE_URL}/benchmark`);
    });

    it('keeps the locale prefix for other locales', () => {
        renderWithIntl(<Footer />, { locale: 'en' });
        expect(
            screen
                .getByRole('link', {
                    name: en.widgets.layout.Footer.benchmarkLink,
                })
                .getAttribute('href')
        ).toBe(`${AI_SITE_URL}/en/benchmark`);
    });
});
