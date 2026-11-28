describe('isAdPlacementConfigured', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
    });

    async function load(env: Record<string, string | undefined>) {
        for (const [key, value] of Object.entries(env)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        return import('@/features/ad-slot/model/adPlacement');
    }

    it('is true when ads are on and both ids are set', async () => {
        const { isAdPlacementConfigured } = await load({
            NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
            NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1',
            NEXT_PUBLIC_ADSENSE_SLOT_NEWS: 'slot-news',
        });
        expect(isAdPlacementConfigured('news')).toBe(true);
    });

    it('is false when ads are off', async () => {
        const { isAdPlacementConfigured } = await load({
            NEXT_PUBLIC_ADSENSE_ENABLED: 'false',
            NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1',
            NEXT_PUBLIC_ADSENSE_SLOT_NEWS: 'slot-news',
        });
        expect(isAdPlacementConfigured('news')).toBe(false);
    });

    it('is false when the placement has no slot id', async () => {
        const { isAdPlacementConfigured } = await load({
            NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
            NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1',
            NEXT_PUBLIC_ADSENSE_SLOT_GUIDE: undefined,
        });
        expect(isAdPlacementConfigured('guide')).toBe(false);
    });

    it('is false without a publisher id', async () => {
        const { isAdPlacementConfigured } = await load({
            NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
            NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: undefined,
            NEXT_PUBLIC_ADSENSE_SLOT_NEWS: 'slot-news',
        });
        expect(isAdPlacementConfigured('news')).toBe(false);
    });

    it('keeps the reserved box heights in step with the ad sizes', async () => {
        const { AD_PLACEMENTS } = await load({});
        for (const config of Object.values(AD_PLACEMENTS)) {
            expect(config.boxClassName).toContain(
                `h-[${config.mobile.height}px]`
            );
            expect(config.boxClassName).toContain(
                `md:h-[${config.desktop.height}px]`
            );
        }
    });
});
