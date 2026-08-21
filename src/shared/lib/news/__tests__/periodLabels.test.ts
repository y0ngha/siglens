import {
    NEWS_LIST_PERIOD_KEY,
    NEWS_ANALYSIS_PERIOD_KEY,
} from '@/shared/lib/news/periodLabels';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

/**
 * 기간 라벨은 `shared.lib.newsPeriod` **키**다 — 예전엔 한국어 리터럴이라
 * `/en/news`가 영어 목록 위에 `최근 6개월`을 렌더했다. 그래서 한국어를
 * 고정하지 않고, 두 키가 네 로케일에 다 있고 비-ko에 한글이 남지 않았는지 본다.
 */
describe('뉴스 기간 라벨 키', () => {
    const group = (locale: keyof typeof CATALOGS) =>
        (
            CATALOGS[locale].shared.lib as unknown as Record<
                string,
                Record<string, string>
            >
        ).newsPeriod;

    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        '%s: 두 키가 모두 있다',
        locale => {
            for (const key of [
                NEWS_LIST_PERIOD_KEY,
                NEWS_ANALYSIS_PERIOD_KEY,
            ]) {
                expect(group(locale)[key], `${locale}.${key}`).toBeTruthy();
            }
        }
    );

    it('ko 라벨은 lookback 기간과 일치한다', () => {
        expect(group('ko')[NEWS_LIST_PERIOD_KEY]).toContain('6개월');
        expect(group('ko')[NEWS_ANALYSIS_PERIOD_KEY]).toContain('30일');
    });

    it('비-ko 로케일에 한글이 남지 않았다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            for (const [key, value] of Object.entries(group(locale))) {
                expect(value, `${locale}.${key}`).not.toMatch(/[가-힣]/);
            }
        }
    });
});
