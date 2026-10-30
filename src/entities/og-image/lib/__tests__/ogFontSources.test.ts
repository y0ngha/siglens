import { OG_FONT_BY_LOCALE } from '../ogFontSources';

describe('OG_FONT_BY_LOCALE', () => {
    it.each([
        ['ko', 'Pretendard', /pretendard@v1\.3\.9\/.*pretendard-bold\.otf$/],
        ['en', 'Pretendard', /pretendard@v1\.3\.9\/.*pretendard-bold\.otf$/],
        [
            'ja',
            'Noto Sans JP',
            /noto-sans-jp@5\.3\.0\/.*noto-sans-jp-japanese-700-normal\.woff$/,
        ],
        [
            'zh',
            'Noto Sans SC',
            /noto-sans-sc@5\.3\.0\/.*noto-sans-sc-chinese-simplified-700-normal\.woff$/,
        ],
    ] as const)('%s → %s (버전 고정 URL)', (locale, name, url) => {
        expect(OG_FONT_BY_LOCALE[locale].name).toBe(name);
        expect(OG_FONT_BY_LOCALE[locale].url).toMatch(url);
    });
});
