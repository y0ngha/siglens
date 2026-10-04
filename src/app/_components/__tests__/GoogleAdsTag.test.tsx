import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    consume: vi.fn<() => boolean>(),
    track: vi.fn(),
    init: vi.fn(),
    pathname: '/',
    fromAdClick: false,
    queued: false,
}));
vi.mock('@/shared/lib/googleAds', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/googleAds')>()),
    consumeSignupConversionFlag: m.consume,
    trackAdsConversion: m.track,
    initAdsCommandQueue: m.init,
    wasOpenedFromAdClick: () => m.fromAdClick,
    hasQueuedAdsConversion: () => m.queued,
}));
vi.mock('next/navigation', () => ({ usePathname: () => m.pathname }));
vi.mock('next/script', () => ({
    default: ({ src, strategy }: { src?: string; strategy?: string }) => (
        <script
            data-testid="gtag-loader"
            data-src={src}
            data-strategy={strategy}
        />
    ),
}));

import { act } from '@testing-library/react';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { ADS_CONVERSION_QUEUED_EVENT } from '@/shared/lib/googleAds';

beforeEach(() => {
    m.consume.mockReset();
    m.track.mockReset();
    m.init.mockReset();
    m.pathname = '/';
    m.fromAdClick = false;
    m.queued = false;
});

const strategy = (getByTestId: (id: string) => HTMLElement) =>
    getByTestId('gtag-loader').getAttribute('data-strategy');

describe('GoogleAdsTag', () => {
    it('queues the config (personalization off) on mount and loads gtag.js for the id', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(m.init).toHaveBeenCalledWith('AW-1');
        expect(getByTestId('gtag-loader').getAttribute('data-src')).toBe(
            'https://www.googletagmanager.com/gtag/js?id=AW-1'
        );
    });

    /**
     * 평소에는 페이지가 다 뜬 뒤 한가할 때 불러온다 — 느린 회선에서 폰트·앱 JS와
     * 대역을 다투지 않게 한다.
     */
    it('waits for idle by default', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(strategy(getByTestId)).toBe('lazyOnload');
    });

    it('loads at once on the ad landing (eager)', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" eager />);
        expect(strategy(getByTestId)).toBe('afterInteractive');
    });

    it('loads at once when the page was opened from an ad click', () => {
        m.consume.mockReturnValue(false);
        m.fromAdClick = true;
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(strategy(getByTestId)).toBe('afterInteractive');
    });

    it('switches to loading at once when a conversion is queued while waiting', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(strategy(getByTestId)).toBe('lazyOnload');

        act(() => {
            m.queued = true;
            window.dispatchEvent(new Event(ADS_CONVERSION_QUEUED_EVENT));
        });

        expect(strategy(getByTestId)).toBe('afterInteractive');
    });

    /** 태그가 마운트되기 전에 큐에 들어간 전환도 놓치지 않는다(이벤트만 들었다면 놓쳤다). */
    it('loads at once when a conversion was queued before mount', () => {
        m.consume.mockReturnValue(false);
        m.queued = true;
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(strategy(getByTestId)).toBe('afterInteractive');
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
        m.pathname = '/portfolio';
        m.consume.mockReturnValue(true);
        rerender(<GoogleAdsTag id="AW-1" />);
        expect(m.track).toHaveBeenCalledTimes(1);
        expect(m.track).toHaveBeenCalledWith('signUp');
    });
});
