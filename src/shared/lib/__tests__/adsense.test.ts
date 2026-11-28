describe('adsense', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
    });

    describe('ADSENSE_PUBLISHER_ID', () => {
        it('returns env value when NEXT_PUBLIC_ADSENSE_PUBLISHER_ID is set', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-123';
            const { ADSENSE_PUBLISHER_ID } =
                await import('@/shared/lib/adsense');
            expect(ADSENSE_PUBLISHER_ID).toBe('ca-pub-123');
        });

        it('defaults to empty string when env var is not set', async () => {
            delete process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
            const { ADSENSE_PUBLISHER_ID } =
                await import('@/shared/lib/adsense');
            expect(ADSENSE_PUBLISHER_ID).toBe('');
        });
    });

    describe('ADSENSE_ENABLED', () => {
        it('is true when NEXT_PUBLIC_ADSENSE_ENABLED is "true"', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
            const { ADSENSE_ENABLED } = await import('@/shared/lib/adsense');
            expect(ADSENSE_ENABLED).toBe(true);
        });

        it('is false when NEXT_PUBLIC_ADSENSE_ENABLED is "false"', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'false';
            const { ADSENSE_ENABLED } = await import('@/shared/lib/adsense');
            expect(ADSENSE_ENABLED).toBe(false);
        });

        it('is false when NEXT_PUBLIC_ADSENSE_ENABLED is not set', async () => {
            delete process.env.NEXT_PUBLIC_ADSENSE_ENABLED;
            const { ADSENSE_ENABLED } = await import('@/shared/lib/adsense');
            expect(ADSENSE_ENABLED).toBe(false);
        });

        it('is false for other string values', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'yes';
            const { ADSENSE_ENABLED } = await import('@/shared/lib/adsense');
            expect(ADSENSE_ENABLED).toBe(false);
        });
    });

    describe('ADSENSE_SLOTS', () => {
        it('returns env values when slot env vars are set', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_SYMBOL_BOTTOM = 'slot-bottom';
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEAR_GREED = 'slot-fg';
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_NEWS = 'slot-news';
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDE = 'slot-guide';
            const { ADSENSE_SLOTS } = await import('@/shared/lib/adsense');
            expect(ADSENSE_SLOTS).toEqual({
                SYMBOL_BOTTOM: 'slot-bottom',
                FEAR_GREED: 'slot-fg',
                NEWS: 'slot-news',
                GUIDE: 'slot-guide',
            });
        });

        it('defaults to empty strings when slot env vars are not set', async () => {
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_SYMBOL_BOTTOM;
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEAR_GREED;
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_NEWS;
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDE;
            const { ADSENSE_SLOTS } = await import('@/shared/lib/adsense');
            expect(ADSENSE_SLOTS).toEqual({
                SYMBOL_BOTTOM: '',
                FEAR_GREED: '',
                NEWS: '',
                GUIDE: '',
            });
        });
    });

    describe('ADSENSE_SCRIPT_SRC', () => {
        it('carries the publisher id as the client parameter', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-123';
            const { ADSENSE_SCRIPT_SRC } = await import('@/shared/lib/adsense');
            expect(ADSENSE_SCRIPT_SRC).toBe(
                'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123'
            );
        });
    });
});
