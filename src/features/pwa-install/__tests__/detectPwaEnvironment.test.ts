// @vitest-environment jsdom
import {
    SERVER_PWA_ENVIRONMENT,
    detectPwaEnvironment,
    readPwaEnvironment,
} from '@/features/pwa-install/lib/detectPwaEnvironment';

describe('detectPwaEnvironment', () => {
    it('iPhone UA → isMobile=true, isIos=true', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            undefined,
            false,
            undefined
        );
        expect(result.isMobile).toBe(true);
        expect(result.isIos).toBe(true);
        expect(result.isInAppBrowser).toBe(false);
        expect(result.isStandalone).toBe(false);
    });

    it('Android Chrome UA → isMobile=true, isIos=false', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            undefined,
            false,
            undefined
        );
        expect(result.isMobile).toBe(true);
        expect(result.isIos).toBe(false);
        expect(result.isInAppBrowser).toBe(false);
    });

    it('데스크탑 Mac UA → isMobile=false', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            false,
            false,
            undefined
        );
        expect(result.isMobile).toBe(false);
    });

    it('KakaoTalk 인앱 브라우저 → isInAppBrowser=true', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) KAKAOTALK/10.0.0',
            undefined,
            false,
            undefined
        );
        expect(result.isInAppBrowser).toBe(true);
    });

    it('Instagram 인앱 브라우저 → isInAppBrowser=true', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Instagram/280.0 FBAN',
            undefined,
            false,
            undefined
        );
        expect(result.isInAppBrowser).toBe(true);
    });

    it('display-mode: standalone → isStandalone=true', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
            undefined,
            true,
            undefined
        );
        expect(result.isStandalone).toBe(true);
    });

    it('navigator.standalone=true → isStandalone=true (iOS PWA 전통 방식)', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
            undefined,
            false,
            true
        );
        expect(result.isStandalone).toBe(true);
    });

    it('userAgentData.mobile=false는 UA보다 우선', () => {
        const result = detectPwaEnvironment(
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120.0.0.0 Mobile Safari/537.36',
            false,
            false,
            undefined
        );
        expect(result.isMobile).toBe(false);
    });
});

describe('readPwaEnvironment', () => {
    const ANDROID_UA =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';

    function stubStandaloneMediaQuery(matches: boolean): void {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query === '(display-mode: standalone)' && matches,
            media: query,
        }));
    }

    beforeEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
            value: ANDROID_UA,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        // 인스턴스에 얹은 값을 지워 프로토타입 getter로 되돌린다.
        Reflect.deleteProperty(navigator, 'userAgent');
    });

    it('브라우저의 UA를 판정에 넘긴다', () => {
        stubStandaloneMediaQuery(false);
        expect(readPwaEnvironment()).toEqual({
            isMobile: true,
            isIos: false,
            isInAppBrowser: false,
            isStandalone: false,
        });
    });

    it('display-mode: standalone 미디어 쿼리를 읽는다', () => {
        stubStandaloneMediaQuery(true);
        expect(readPwaEnvironment().isStandalone).toBe(true);
    });

    it('window가 없으면(서버) 모든 플래그가 꺼진 환경', () => {
        vi.stubGlobal('window', undefined);
        expect(readPwaEnvironment()).toBe(SERVER_PWA_ENVIRONMENT);
    });
});
