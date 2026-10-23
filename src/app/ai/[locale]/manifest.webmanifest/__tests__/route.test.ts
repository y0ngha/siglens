import { describe, expect, it } from 'vitest';
import {
    GET,
    dynamic,
    generateStaticParams,
} from '@/app/ai/[locale]/manifest.webmanifest/route';
import { LOCALES } from '@/shared/i18n/locales';

/** `params`가 `Promise`로 오는 Next.js 16 route handler 계약을 흉내낸다. */
function paramsFor(locale: string): { params: Promise<{ locale: string }> } {
    return { params: Promise.resolve({ locale }) };
}

describe('generateStaticParams', () => {
    it('지원하는 모든 로케일에 대해 정적 파라미터를 만든다', () => {
        expect(generateStaticParams()).toEqual(
            LOCALES.map(locale => ({ locale }))
        );
    });
});

describe('dynamic', () => {
    it("빌드 시 정적으로 굽는다('force-static')", () => {
        expect(dynamic).toBe('force-static');
    });
});

describe('GET /ai/{locale}/manifest.webmanifest', () => {
    it('SIGLENS AI 매니페스트를 manifest content-type으로 반환한다', async () => {
        const response = await GET(
            new Request('https://example.test'),
            paramsFor('en')
        );

        expect(response.headers.get('content-type')).toBe(
            'application/manifest+json'
        );
        const body = await response.json();
        expect(body.short_name).toBe('SIGLENS AI');
        expect(body.start_url).toBe('/en');
        expect(body.lang).toBe('en');
    });

    /** 한 로케일에서 `app.ai.manifest` 키가 빠지면 라우트 수준에서 바로 드러나야 한다. */
    it.each(LOCALES)(
        '%s: 로케일 홈에서 시작하는 매니페스트를 낸다',
        async locale => {
            const response = await GET(
                new Request('https://example.test'),
                paramsFor(locale)
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.name.length).toBeGreaterThan(0);
            expect(body.start_url).toBe(locale === 'ko' ? '/' : `/${locale}`);
        }
    );

    it('알 수 없는 로케일은 기본 로케일(ko) 매니페스트로 폴백한다', async () => {
        const response = await GET(
            new Request('https://example.test'),
            paramsFor('xx-not-a-locale')
        );

        const body = await response.json();
        expect(body.short_name).toBe('시그렌즈 AI');
        expect(body.start_url).toBe('/');
    });
});
