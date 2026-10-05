import { getTranslations } from 'next-intl/server';
import { buildHomeFaq } from '@/app/[locale]/homeJsonLd';
import { SECTOR_ETFS, SIGNAL_SECTORS } from '@/shared/config/dashboard-tickers';
import type { Locale } from '@/shared/i18n/locales';

/**
 * `/market` 스캐너의 개수 문구. 탭은 13개지만 업종(GICS 섹터)은 11개이고 나머지 둘은
 * ETF 없는 테마(양자·우주)다 — FAQ가 "11개 섹터"만 말하면 화면의 13개 탭과 어긋나고,
 * 13개를 섹터라 부르면 테마를 부풀린다. 숫자는 설정에서 파생돼야 한다.
 */
describe('buildHomeFaq — 시장 신호 스캐너 개수', () => {
    const INDUSTRIES = SECTOR_ETFS.length;
    const THEMES = SIGNAL_SECTORS.length - SECTOR_ETFS.length;

    async function scannerAnswer(locale: Locale): Promise<string> {
        const t = await getTranslations({
            locale,
            namespace: 'app.home.jsonLd',
        });
        // q2 = 시장 현황 문항. 위치가 아니라 `/market`을 말하는 답변으로 찾는다.
        const faq = buildHomeFaq(t, locale);
        const answer = faq.find(item => item.answer.includes('/market'));
        if (answer === undefined) throw new Error('market FAQ not found');
        return answer.answer;
    }

    it('설정에서 파생한 값이 업종 11 / 테마 2다 (13개 탭 = 11 + 2)', () => {
        expect(INDUSTRIES).toBe(11);
        expect(THEMES).toBe(2);
        expect(INDUSTRIES + THEMES).toBe(SIGNAL_SECTORS.length);
    });

    it('ko: 업종과 테마를 구분해 말한다', async () => {
        const answer = await scannerAnswer('ko');
        expect(answer).toContain(`미국 ${INDUSTRIES}개 업종(GICS 섹터)`);
        expect(answer).toContain(`양자컴퓨팅·우주 등 ${THEMES}개 테마`);
    });

    it('플레이스홀더가 치환되지 않은 채 남지 않는다 (ko)', async () => {
        expect(await scannerAnswer('ko')).not.toMatch(/\{v\d\}/);
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 두 숫자가 모두 들어가고 플레이스홀더가 남지 않는다',
        async locale => {
            const answer = await scannerAnswer(locale);
            expect(answer).toContain(String(INDUSTRIES));
            expect(answer).toContain(String(THEMES));
            expect(answer).not.toMatch(/\{v\d\}/);
        }
    );
});
