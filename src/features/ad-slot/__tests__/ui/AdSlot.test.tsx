import { render, screen } from '@testing-library/react';
import { AdSlot } from '@/features/ad-slot/ui/AdSlot';

const state = vi.hoisted(() => ({
    configured: true,
    activation: { tier: 'pending', active: false } as {
        tier: 'pending' | 'show' | 'hide';
        active: boolean;
    },
}));

vi.mock('@/shared/lib/adsense', () => ({
    ADSENSE_ENABLED: true,
    ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890',
    ADSENSE_SCRIPT_SRC:
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890',
    ADSENSE_SLOTS: {
        SYMBOL_BOTTOM: 'slot-bottom',
        FEAR_GREED: 'slot-fg',
        NEWS: 'slot-news',
        GUIDE: 'slot-guide',
    },
}));
vi.mock('@/features/ad-slot/model/adPlacement', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@/features/ad-slot/model/adPlacement')
        >();
    return { ...actual, isAdPlacementConfigured: () => state.configured };
});
vi.mock('@/features/ad-slot/hooks/useAdActivation', () => ({
    useAdActivation: () => state.activation,
}));
vi.mock('@/features/ad-slot/hooks/useAdSensePush', () => ({
    useAdSensePush: vi.fn(),
}));
vi.mock('next/script', () => ({
    default: ({ id, src }: { id: string; src: string }) => (
        <script data-testid={id} data-src={src} />
    ),
}));

function stubDesktop(matches: boolean) {
    vi.stubGlobal(
        'matchMedia',
        (query: string) =>
            ({
                matches,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
            }) as unknown as MediaQueryList
    );
}

beforeEach(() => {
    state.configured = true;
    state.activation = { tier: 'pending', active: false };
    stubDesktop(false);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AdSlot', () => {
    it('renders nothing when the placement is not configured', () => {
        state.configured = false;
        const { container } = render(<AdSlot placement="news" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('reserves a labelled box before the ad may load', () => {
        const { container } = render(<AdSlot placement="news" />);

        expect(
            screen.getByRole('complementary', { name: '광고' })
        ).toBeVisible();
        expect(container.querySelector('ins')).toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('.h-\\[100px\\]')).not.toBeNull();
    });

    it('renders nothing for pro members', () => {
        state.activation = { tier: 'hide', active: false };
        const { container } = render(<AdSlot placement="news" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('inserts a fixed-size mobile unit and the script once active', () => {
        state.activation = { tier: 'show', active: true };
        const { container } = render(<AdSlot placement="news" />);

        const ins = container.querySelector('ins.adsbygoogle');
        expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-1234567890');
        expect(ins).toHaveAttribute('data-ad-slot', 'slot-news');
        expect(ins).toHaveStyle({ width: '320px', height: '100px' });
        expect(ins).not.toHaveAttribute('data-full-width-responsive');
        expect(ins).not.toHaveAttribute('data-ad-format');
        expect(screen.getByTestId('adsbygoogle-js')).toHaveAttribute(
            'data-src',
            expect.stringContaining('client=ca-pub-1234567890')
        );
    });

    it('uses the desktop size from the md breakpoint up', () => {
        stubDesktop(true);
        state.activation = { tier: 'show', active: true };
        const { container } = render(<AdSlot placement="guide" />);

        expect(container.querySelector('ins')).toHaveStyle({
            width: '300px',
            height: '250px',
        });
    });
});
