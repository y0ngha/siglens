import {
    REQUEST_LOCALE_HEADER,
    resolveRequestSurface,
} from '@/shared/i18n/requestSurface';

function headersOf(entries: Record<string, string>): Headers {
    return new Headers(entries);
}

describe('resolveRequestSurface', () => {
    it('미들웨어가 심은 로케일 헤더를 읽는다', () => {
        const surface = resolveRequestSurface(
            headersOf({ [REQUEST_LOCALE_HEADER]: 'ja', host: 'siglens.io' })
        );

        expect(surface).toEqual({ locale: 'ja', onAiHost: false });
    });

    it('ai 호스트(포트 포함 개발 호스트도)를 알아본다', () => {
        expect(
            resolveRequestSurface(headersOf({ host: 'ai.siglens.io' })).onAiHost
        ).toBe(true);
        expect(
            resolveRequestSurface(headersOf({ host: 'ai.localhost:4300' }))
                .onAiHost
        ).toBe(true);
    });

    it('헤더가 전혀 없으면 던지지 않고 한국어 · 메인 호스트로 떨어진다', () => {
        expect(resolveRequestSurface(headersOf({}))).toEqual({
            locale: 'ko',
            onAiHost: false,
        });
    });

    it('지원하지 않는 로케일 값은 한국어로 떨어진다', () => {
        expect(
            resolveRequestSurface(headersOf({ [REQUEST_LOCALE_HEADER]: 'xx' }))
                .locale
        ).toBe('ko');
    });
});
