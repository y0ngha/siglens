import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('GOOGLE_ADS_ID', () => {
    it('is the real ads id in production without E2E_TEST', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://siglens.io');
        vi.stubEnv('E2E_TEST', undefined);
        vi.resetModules();

        const { GOOGLE_ADS_ID } = await import('@/shared/config/googleAds');

        expect(GOOGLE_ADS_ID).toBe('AW-18472071641');
    });

    it('is empty in production when E2E_TEST is set', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://siglens.io');
        vi.stubEnv('E2E_TEST', '1');
        vi.resetModules();

        const { GOOGLE_ADS_ID } = await import('@/shared/config/googleAds');

        expect(GOOGLE_ADS_ID).toBe('');
    });

    it('is empty outside production', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('E2E_TEST', undefined);
        vi.resetModules();

        const { GOOGLE_ADS_ID } = await import('@/shared/config/googleAds');

        expect(GOOGLE_ADS_ID).toBe('');
    });
});

describe('SIGNUP_CONVERSION_COOKIE_DOMAIN', () => {
    it('matches SITE_HOST so the two literals cannot drift apart', async () => {
        vi.resetModules();

        const { SIGNUP_CONVERSION_COOKIE_DOMAIN } =
            await import('@/shared/config/googleAds');
        const { SITE_HOST } = await import('@/shared/lib/seo');

        expect(SIGNUP_CONVERSION_COOKIE_DOMAIN).toBe(SITE_HOST);
    });
});
