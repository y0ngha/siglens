import { ANALYSIS_LOCALE_HEADER, DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';

function requestWith(value?: string): Request {
    return new Request('https://siglens.test/api/x', {
        headers: value === undefined ? {} : { [ANALYSIS_LOCALE_HEADER]: value },
    });
}

describe('localeFromRequestHeader', () => {
    it('지원 로케일은 그대로 돌려준다', () => {
        expect(localeFromRequestHeader(requestWith('en'))).toBe('en');
        expect(localeFromRequestHeader(requestWith('zh'))).toBe('zh');
    });

    it('헤더가 없거나 알 수 없는 값이면 기본 로케일', () => {
        expect(localeFromRequestHeader(requestWith())).toBe(DEFAULT_LOCALE);
        expect(localeFromRequestHeader(requestWith('fr'))).toBe(DEFAULT_LOCALE);
        expect(localeFromRequestHeader(requestWith(''))).toBe(DEFAULT_LOCALE);
    });
});
