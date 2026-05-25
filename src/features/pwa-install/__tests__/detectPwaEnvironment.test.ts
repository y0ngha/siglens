// @vitest-environment jsdom
import { detectPwaEnvironment } from '@/features/pwa-install/lib/detectPwaEnvironment';

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
