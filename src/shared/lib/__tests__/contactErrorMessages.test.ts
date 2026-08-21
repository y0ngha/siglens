import { CONTACT_ERROR_KEY } from '@/shared/lib/contactErrorMessages';
import type { ContactFormErrorCode } from '@/shared/lib/types';
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

const ALL_ERROR_CODES: ContactFormErrorCode[] = [
    'title_required',
    'title_too_long',
    'email_required',
    'email_invalid',
    'content_required',
    'content_too_long',
    'submission_failed',
];

/**
 * 이 표는 표시 문자열이 아니라 `shared.lib.contactError` **키**를 담는다 —
 * 예전에는 한국어 리터럴이라 `/en/contact`가 영어 폼에 한국어 검증 메시지를
 * 띄웠다. 그래서 문자열을 고정하는 대신 모든 코드가 네 로케일에 다 있는지,
 * 길이 제한 메시지가 `{v0}` 자리를 갖는지를 본다.
 */
describe('CONTACT_ERROR_KEY', () => {
    const group = (locale: keyof typeof CATALOGS) =>
        (
            CATALOGS[locale].shared.lib as unknown as Record<
                string,
                Record<string, string>
            >
        ).contactError;

    it('has exactly one key per ContactFormErrorCode', () => {
        expect(Object.keys(CONTACT_ERROR_KEY)).toHaveLength(
            ALL_ERROR_CODES.length
        );
    });

    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        '%s: 모든 코드가 비지 않은 메시지로 해석된다',
        locale => {
            for (const code of ALL_ERROR_CODES) {
                const value = group(locale)[CONTACT_ERROR_KEY[code]];
                expect(value, `${locale}.${code}`).toBeTruthy();
            }
        }
    );

    it.each(['title_too_long', 'content_too_long'] as const)(
        '%s: 상한을 값으로 받는 자리(`{v0}`)가 네 로케일에 다 있다',
        code => {
            for (const locale of Object.keys(CATALOGS) as Array<
                keyof typeof CATALOGS
            >) {
                expect(
                    group(locale)[CONTACT_ERROR_KEY[code]],
                    `${locale}.${code}`
                ).toContain('{v0}');
            }
        }
    );

    it('비-ko 로케일에 한글이 남지 않았다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            for (const [key, value] of Object.entries(group(locale))) {
                expect(value, `${locale}.${key}`).not.toMatch(/[가-힣]/);
            }
        }
    });
});
