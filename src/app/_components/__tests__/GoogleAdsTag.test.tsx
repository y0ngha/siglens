import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    consume: vi.fn<() => boolean>(),
    track: vi.fn(),
    pathname: '/',
}));
vi.mock('@/shared/lib/googleAds', () => ({
    consumeSignupConversionFlag: m.consume,
    trackAdsConversion: m.track,
}));
vi.mock('next/navigation', () => ({ usePathname: () => m.pathname }));
vi.mock('next/script', () => ({
    default: ({
        src,
        id,
        children,
    }: {
        src?: string;
        id?: string;
        children?: string;
    }) => (
        <script data-testid={id ?? 'gtag-loader'} data-src={src}>
            {children}
        </script>
    ),
}));

import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';

beforeEach(() => {
    m.consume.mockReset();
    m.track.mockReset();
    m.pathname = '/';
});

describe('GoogleAdsTag', () => {
    it('loads gtag.js for the id with ad personalization off', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(getByTestId('gtag-loader').getAttribute('data-src')).toBe(
            'https://www.googletagmanager.com/gtag/js?id=AW-1'
        );
        expect(getByTestId('google-ads-init').textContent).toContain(
            "gtag('config','AW-1',{allow_ad_personalization_signals:false})"
        );
    });

    it('records a sign-up conversion when the flag cookie is present', () => {
        m.consume.mockReturnValue(true);
        render(<GoogleAdsTag id="AW-1" />);
        expect(m.track).toHaveBeenCalledWith('signUp');
    });

    it('records nothing without the flag', () => {
        m.consume.mockReturnValue(false);
        render(<GoogleAdsTag id="AW-1" />);
        expect(m.track).not.toHaveBeenCalled();
    });

    it('checks the flag again after a client-side navigation (server-action redirect does not remount)', () => {
        m.consume.mockReturnValue(false);
        const { rerender } = render(<GoogleAdsTag id="AW-1" />);
        m.pathname = '/onboarding';
        m.consume.mockReturnValue(true);
        rerender(<GoogleAdsTag id="AW-1" />);
        expect(m.track).toHaveBeenCalledTimes(1);
        expect(m.track).toHaveBeenCalledWith('signUp');
    });
});
