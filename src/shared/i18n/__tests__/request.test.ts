// @vitest-environment node
import { IntlError, IntlErrorCode } from 'use-intl';
import requestConfig from '../request';
import koMessages from '../../../../messages/ko.json';
import jaMessages from '../../../../messages/ja.json';

/**
 * `next-intl/server`의 `getRequestConfig`는 콜백을 그대로 돌려주는 identity
 * 래퍼다(`node_modules/next-intl/.../getRequestConfig.js`) — 그래서
 * `request.ts`의 기본 export를 `next-intl` 런타임 바깥에서 직접 함수로 호출해
 * 로케일 해석·메시지 로딩·onError 분기를 관찰할 수 있다.
 */
describe('shared/i18n/request', () => {
    it('유효한 requestLocale이면 그 로케일과 해당 카탈로그를 반환한다', async () => {
        const config = await requestConfig({
            requestLocale: Promise.resolve('ja'),
        });

        expect(config.locale).toBe('ja');
        expect(config.messages).toEqual(jaMessages);
    });

    it('지원하지 않는 로케일이면 기본 로케일(ko)로 떨어진다', async () => {
        const config = await requestConfig({
            requestLocale: Promise.resolve('xx'),
        });

        expect(config.locale).toBe('ko');
        expect(config.messages).toEqual(koMessages);
    });

    it('requestLocale이 undefined면 기본 로케일로 떨어진다', async () => {
        const config = await requestConfig({
            requestLocale: Promise.resolve(undefined),
        });

        expect(config.locale).toBe('ko');
    });

    it('timeZone은 Asia/Seoul로 고정된다', async () => {
        const config = await requestConfig({
            requestLocale: Promise.resolve('en'),
        });

        expect(config.timeZone).toBe('Asia/Seoul');
    });

    describe('getMessageFallback', () => {
        it('namespace가 있으면 "namespace.key" 형태로 만든다', async () => {
            const config = await requestConfig({
                requestLocale: Promise.resolve('ko'),
            });

            expect(
                config.getMessageFallback?.({
                    key: 'title',
                    namespace: 'app.home',
                    error: new IntlError(
                        IntlErrorCode.MISSING_MESSAGE,
                        'missing'
                    ),
                })
            ).toBe('app.home.title');
        });

        it('namespace가 없으면 key만 반환한다', async () => {
            const config = await requestConfig({
                requestLocale: Promise.resolve('ko'),
            });

            expect(
                config.getMessageFallback?.({
                    key: 'title',
                    namespace: undefined,
                    error: new IntlError(
                        IntlErrorCode.MISSING_MESSAGE,
                        'missing'
                    ),
                })
            ).toBe('title');
        });
    });

    describe('onError', () => {
        it('서버(node) 환경에서는 콘솔에 에러 메시지를 남긴다', async () => {
            const config = await requestConfig({
                requestLocale: Promise.resolve('ko'),
            });
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            config.onError?.(
                new IntlError(IntlErrorCode.MISSING_MESSAGE, 'app.home.title')
            );

            expect(errorSpy).toHaveBeenCalledWith(
                '[i18n]',
                expect.stringContaining('app.home.title')
            );
            errorSpy.mockRestore();
        });

        /**
         * `window`가 있는 쪽(클라이언트 콘솔)은 의도적으로 채우지 않는다 — 키 패리티
         * 신호는 서버 로그에만 남기고, 클라이언트 콘솔은 침묵시킨다는 분기다.
         * `typeof window === 'undefined'` 가드의 두 갈래를 모두 실행해야 이 침묵이
         * 실제로 지켜지는지 검증할 수 있다.
         */
        it('window가 정의된 환경(클라이언트)에서는 콘솔을 채우지 않는다', async () => {
            const config = await requestConfig({
                requestLocale: Promise.resolve('ko'),
            });
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            vi.stubGlobal('window', {});
            try {
                config.onError?.(
                    new IntlError(IntlErrorCode.MISSING_MESSAGE, 'x')
                );
                expect(errorSpy).not.toHaveBeenCalled();
            } finally {
                vi.unstubAllGlobals();
                errorSpy.mockRestore();
            }
        });
    });
});
