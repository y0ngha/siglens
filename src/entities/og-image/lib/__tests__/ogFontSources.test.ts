import { OG_FONT_BY_LOCALE } from '../ogFontSources';

describe('OG_FONT_BY_LOCALE', () => {
    it.each([
        ['ko', 'Pretendard', /pretendard@1\.3\.9\/.*Pretendard-Bold\.woff$/],
        ['en', 'Pretendard', /pretendard@1\.3\.9\/.*Pretendard-Bold\.woff$/],
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

    it.each(Object.entries(OG_FONT_BY_LOCALE))(
        '%s URL은 jsdelivr npm 경로의 버전 고정 WOFF/TTF/OTF다(gh/ 금지)',
        (_locale, { url }) => {
            expect(url).toMatch(
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[\w-]+\/)?[\w-]+@\d+\.\d+\.\d+\/.+\.(woff|ttf|otf)$/
            );
            expect(url).not.toContain('/gh/');
            expect(url).not.toContain('@latest');
        }
    );
});
