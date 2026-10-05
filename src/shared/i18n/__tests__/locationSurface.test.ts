import {
    DEFAULT_LOCATION_SURFACE,
    resolveLocationSurface,
} from '@/shared/i18n/locationSurface';

describe('resolveLocationSurface', () => {
    it('기본 표면은 한국어 · 메인 호스트다', () => {
        expect(DEFAULT_LOCATION_SURFACE).toEqual({
            locale: 'ko',
            onAiHost: false,
        });
    });

    it('첫 경로 세그먼트가 지원 로케일이면 그 로케일이다', () => {
        expect(resolveLocationSurface('siglens.io', '/en/foo/bar')).toEqual({
            locale: 'en',
            onAiHost: false,
        });
        expect(resolveLocationSurface('siglens.io', '/ja').locale).toBe('ja');
    });

    it('접두사가 없거나 모르는 값이면 한국어다', () => {
        expect(resolveLocationSurface('siglens.io', '/foo/bar').locale).toBe(
            'ko'
        );
        expect(resolveLocationSurface('siglens.io', '/xx/foo').locale).toBe(
            'ko'
        );
        expect(resolveLocationSurface('siglens.io', '').locale).toBe('ko');
    });

    it('ai 호스트(포트 포함 개발 호스트도)를 알아본다', () => {
        expect(resolveLocationSurface('ai.siglens.io', '/x').onAiHost).toBe(
            true
        );
        expect(resolveLocationSurface('ai.localhost', '/x').onAiHost).toBe(
            true
        );
    });

    it('메인 호스트와 다른 호스트는 ai가 아니다', () => {
        expect(resolveLocationSurface('siglens.io', '/x').onAiHost).toBe(false);
        expect(resolveLocationSurface('localhost', '/x').onAiHost).toBe(false);
    });

    it('호스트와 로케일은 독립이다', () => {
        expect(resolveLocationSurface('ai.siglens.io', '/zh/c/abc')).toEqual({
            locale: 'zh',
            onAiHost: true,
        });
    });
});
