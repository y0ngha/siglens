vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => `t:${key}`),
}));

import { buildBacktestingMetadata } from '@/app/[locale]/backtesting/_lib/backtestingMetadata';
import { LOCALES } from '@/shared/i18n/locales';
import { backtestingDescription } from '@/shared/lib/seo';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const metadataFor = (locale: string) =>
    buildBacktestingMetadata(Promise.resolve({ locale }));

describe('/backtesting 메타데이터', () => {
    it('타이틀은 브랜드가 붙은 absolute 값이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.title).toEqual({
            absolute: 't:backtesting.title | SIGLENS',
        });
    });

    it('robots는 선언하지 않고 로케일 레이아웃 값을 상속한다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata).not.toHaveProperty('robots');
    });

    it('og:url은 en에서 /en 접두사 URL이다', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.openGraph?.url).toBe(
            'https://siglens.io/en/backtesting'
        );
    });

    it('OG 이미지 alt는 backtestingOgAlt 키로 만든다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({
                url: '/og-image.png',
                alt: 't:backtestingOgAlt',
            }),
        ]);
    });

    it('twitter 카드는 summary_large_image다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.twitter).toMatchObject({
            card: 'summary_large_image',
        });
    });
});

/**
 * 메타·OG·JSON-LD에는 수익률 수치를 싣지 않는다(기간을 골라 보이는 수치가 되고, 기준선이 같은
 * 자리에 없다). 실제 카탈로그를 읽어 네 로케일을 모두 확인한다 — 위 테스트는 번역자를 `t:key`로
 * 바꿔 문구를 보지 못한다.
 */
describe('/backtesting 메타 문구에는 숫자가 없다', () => {
    it.each(LOCALES)('description (%s)', locale => {
        const seo = catalogTranslator('shared.seo', locale);
        expect(backtestingDescription(seo)).not.toMatch(/\d/);
    });

    it.each(LOCALES)('Dataset variableMeasured (%s)', locale => {
        const page = catalogTranslator('app.backtesting.seo', locale);
        expect(page('variableMeasured')).not.toMatch(/\d/);
    });

    it('한국어 description은 비교 대상을 말하고 성과 보장을 부인한다', () => {
        const seo = catalogTranslator('shared.seo', 'ko');
        const description = backtestingDescription(seo);
        expect(description).toContain('계속 보유한 경우');
        expect(description).toContain('미래 성과를 보장하지 않습니다');
    });

    it.each(LOCALES)('description은 주장 표현을 쓰지 않는다 (%s)', locale => {
        const seo = catalogTranslator('shared.seo', locale);
        expect(backtestingDescription(seo)).not.toMatch(
            /이겼|줄였|연환산|outperform|annuali[sz]ed/i
        );
    });
});
