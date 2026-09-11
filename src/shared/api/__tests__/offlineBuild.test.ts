import {
    isOfflineBuild,
    warnOfflineBuildOnce,
    assertOnline,
    OFFLINE_BUILD_SERVICE,
    __resetOfflineBuildWarningsForTests,
} from '../offlineBuild';

describe('isOfflineBuild', () => {
    const original = process.env.SIGLENS_OFFLINE_BUILD;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.SIGLENS_OFFLINE_BUILD;
            return;
        }
        process.env.SIGLENS_OFFLINE_BUILD = original;
    });

    it('SIGLENS_OFFLINE_BUILD=1이면 true를 반환한다', () => {
        process.env.SIGLENS_OFFLINE_BUILD = '1';
        expect(isOfflineBuild()).toBe(true);
    });

    it('SIGLENS_OFFLINE_BUILD가 미설정이면 false를 반환한다', () => {
        delete process.env.SIGLENS_OFFLINE_BUILD;
        expect(isOfflineBuild()).toBe(false);
    });

    it('SIGLENS_OFFLINE_BUILD가 1이 아니면 false를 반환한다', () => {
        process.env.SIGLENS_OFFLINE_BUILD = 'true';
        expect(isOfflineBuild()).toBe(false);
    });
});

describe('warnOfflineBuildOnce', () => {
    beforeEach(() => {
        __resetOfflineBuildWarningsForTests();
    });

    it('같은 서비스는 프로세스당 한 번만 경고한다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        warnOfflineBuildOnce('FMP');
        warnOfflineBuildOnce('FMP');
        warnOfflineBuildOnce('FMP');

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[offline-build] blocking FMP request'
        );

        warnSpy.mockRestore();
    });

    it('다른 서비스는 각각 별도로 경고한다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        warnOfflineBuildOnce('FMP');
        warnOfflineBuildOnce('Neon');
        warnOfflineBuildOnce('Upstash');

        expect(warnSpy).toHaveBeenCalledTimes(3);

        warnSpy.mockRestore();
    });
});

describe('assertOnline', () => {
    beforeEach(() => {
        __resetOfflineBuildWarningsForTests();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('offline이면 경고 후 [offline-build] 에러를 던진다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() =>
            assertOnline(OFFLINE_BUILD_SERVICE.YAHOO, 'quote AAPL')
        ).toThrow('[offline-build] blocked Yahoo request to quote AAPL');
        expect(warnSpy).toHaveBeenCalledTimes(1);

        warnSpy.mockRestore();
    });

    it('같은 서비스로 여러 번 불려도 경고는 한 번만 남긴다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() => assertOnline(OFFLINE_BUILD_SERVICE.FMP, 'a')).toThrow();
        expect(() => assertOnline(OFFLINE_BUILD_SERVICE.FMP, 'b')).toThrow();

        expect(warnSpy).toHaveBeenCalledTimes(1);

        warnSpy.mockRestore();
    });

    it('online이면 아무 것도 하지 않는다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() =>
            assertOnline(OFFLINE_BUILD_SERVICE.NEON, 'connection')
        ).not.toThrow();
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});
