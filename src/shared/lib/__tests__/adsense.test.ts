describe('adsense', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
    });

    describe('ADSENSE_PUBLISHER_ID', () => {
        it('returns env value when NEXT_PUBLIC_ADSENSE_PUBLISHER_ID is set', async () => {
            process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-123';
            const { ADSENSE_PUBLISHER_ID } = await import(
                '@/shared/lib/adsense'
            );
            expect(ADSENSE_PUBLISHER_ID).toBe('ca-pub-123');
        });

        it('defaults to empty string when env var is not set', async () => {
            delete process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
            const { ADSENSE_PUBLISHER_ID } = await import(
                '@/shared/lib/adsense'
            );
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
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS = 'slot-progress-1';
            process.env.NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM =
                'slot-panel-bottom-1';
            const { ADSENSE_SLOTS } = await import('@/shared/lib/adsense');
            expect(ADSENSE_SLOTS.PROGRESS).toBe('slot-progress-1');
            expect(ADSENSE_SLOTS.PANEL_BOTTOM).toBe('slot-panel-bottom-1');
        });

        it('defaults to empty strings when slot env vars are not set', async () => {
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS;
            delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM;
            const { ADSENSE_SLOTS } = await import('@/shared/lib/adsense');
            expect(ADSENSE_SLOTS.PROGRESS).toBe('');
            expect(ADSENSE_SLOTS.PANEL_BOTTOM).toBe('');
        });
    });
});
