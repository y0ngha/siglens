import {
    TRENDLINE_DIRECTION_LABEL_KEY,
    TRENDLINE_DIRECTION_COLOR,
} from '@/shared/lib/trendline';
import { CHART_COLORS } from '@/shared/lib/chartColors';
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
 * 라벨은 문자열이 아니라 `shared.lib.trendline`의 **키**다 — 예전에는 한국어
 * 리터럴이라 `/en/…`이 `상승 추세선`을 그대로 렌더했다. 그래서 이 테스트는
 * 한국어를 고정하지 않고 키가 네 로케일에 다 있는지를 본다. `fallback`은
 * 방향 enum이 확장됐을 때 쓰이므로 함께 검사한다.
 */
describe('TRENDLINE_DIRECTION_LABEL_KEY', () => {
    it('has exactly two entries', () => {
        expect(Object.keys(TRENDLINE_DIRECTION_LABEL_KEY)).toHaveLength(2);
    });

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: 두 방향 + fallback 키가 모두 카탈로그에 있다',
        locale => {
            const group = (
                CATALOGS[locale].shared.lib as unknown as Record<
                    string,
                    Record<string, string>
                >
            ).trendline;
            for (const key of [
                ...Object.values(TRENDLINE_DIRECTION_LABEL_KEY),
                'fallback',
            ]) {
                expect(group[key], `${locale}.${key}`).toBeTruthy();
            }
            if (locale !== 'ko') {
                for (const [key, value] of Object.entries(group)) {
                    expect(value, `${locale}.${key}`).not.toMatch(/[가-힣]/);
                }
            }
        }
    );
});

describe('TRENDLINE_DIRECTION_COLOR', () => {
    it('maps ascending to CHART_COLORS.trendlineAscending', () => {
        expect(TRENDLINE_DIRECTION_COLOR.ascending).toBe(
            CHART_COLORS.trendlineAscending
        );
    });

    it('maps descending to CHART_COLORS.trendlineDescending', () => {
        expect(TRENDLINE_DIRECTION_COLOR.descending).toBe(
            CHART_COLORS.trendlineDescending
        );
    });

    it('has exactly two entries', () => {
        expect(Object.keys(TRENDLINE_DIRECTION_COLOR)).toHaveLength(2);
    });
});
