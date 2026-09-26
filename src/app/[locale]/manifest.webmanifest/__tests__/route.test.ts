import { describe, expect, it } from 'vitest';
import {
    GET,
    dynamic,
    generateStaticParams,
} from '@/app/[locale]/manifest.webmanifest/route';
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

describe('GET /{locale}/manifest.webmanifest', () => {
    it('지원 로케일이면 그 로케일로 해석된 매니페스트를 content-type과 함께 반환한다', async () => {
        const response = await GET(new Request('https://example.test'), {
            params: Promise.resolve({ locale: 'en' }),
        });

        expect(response.headers.get('content-type')).toBe(
            'application/manifest+json'
        );
        const body = await response.json();
        expect(body.lang).toBe('en');
        expect(body.start_url).toBe('/en/');
        expect(typeof body.name).toBe('string');
        expect(body.name.length).toBeGreaterThan(0);
    });

    /**
     * 알 수 없는 로케일 세그먼트가 오면(예: 프록시가 아직 걸러내지 못한 값)
     * 기본 로케일로 조용히 떨어진다 — 매니페스트 요청이 그대로 실패해 PWA
     * 설치 프롬프트가 깨지는 것보다 낫다.
     */
    it('알 수 없는 로케일은 기본 로케일(ko) 매니페스트로 폴백한다', async () => {
        const response = await GET(
            new Request('https://example.test'),
            paramsFor('xx-not-a-locale')
        );

        const body = await response.json();
        expect(body.lang).toBe('ko');
        expect(body.start_url).toBe('/');
    });

    it('ko 로케일은 로케일 접두사 없는 루트 경로를 start_url로 쓴다', async () => {
        const response = await GET(
            new Request('https://example.test'),
            paramsFor('ko')
        );

        const body = await response.json();
        expect(body.start_url).toBe('/');
        expect(body.scope).toBe('/');
        expect(body.id).toBe('/');
    });
});
