/**
 * `register()` — Edge/Node 런타임 분기. `process.on`/`process.exit`는 Edge에서
 * 미지원이라 이 파일이 Node 분기에서만 `instrumentation.node`를 동적 import한다.
 * 여기서는 그 위임이 실제로 조건부인지(edge에서는 호출하지 않는지)를 검증한다.
 */
describe('instrumentation register()', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('NEXT_RUNTIME=nodejs면 instrumentation.node의 registerShutdownHandlers를 호출한다', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        const mockRegister = vi.fn();
        const mockRedact = vi.fn();
        const mockReport = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
            registerErrorLogRedaction: mockRedact,
            reportRequestError: mockReport,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).toHaveBeenCalledTimes(1);
        expect(mockRedact).toHaveBeenCalledTimes(1);
    });

    it('NEXT_RUNTIME=edge면 instrumentation.node를 import하지 않는다', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        const mockRegister = vi.fn();
        const mockRedact = vi.fn();
        const mockReport = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
            registerErrorLogRedaction: mockRedact,
            reportRequestError: mockReport,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).not.toHaveBeenCalled();
    });

    it('NEXT_RUNTIME이 없으면(빌드·기타 컨텍스트) 아무것도 등록하지 않는다', async () => {
        vi.stubEnv('NEXT_RUNTIME', '');
        const mockRegister = vi.fn();
        const mockRedact = vi.fn();
        const mockReport = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
            registerErrorLogRedaction: mockRedact,
            reportRequestError: mockReport,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).not.toHaveBeenCalled();
    });

    it('onRequestError는 nodejs 런타임에서 reportRequestError에 위임한다', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        const mockReport = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            reportRequestError: mockReport,
        }));
        const context = {
            routerKind: 'App Router' as const,
            routePath: '/[symbol]',
            routeType: 'render' as const,
            revalidateReason: undefined,
        };
        const error = new Error('x');
        const request = { path: '/', method: 'GET', headers: {} };

        const { onRequestError } = await import('../instrumentation');
        await onRequestError(error, request, context);

        expect(mockReport).toHaveBeenCalledWith(error, context);
    });

    it('onRequestError는 edge 런타임에서는 아무것도 하지 않는다', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        const mockReport = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            reportRequestError: mockReport,
        }));

        const { onRequestError } = await import('../instrumentation');
        await onRequestError(
            new Error('x'),
            { path: '/', method: 'GET', headers: {} },
            {
                routerKind: 'App Router',
                routePath: '/',
                routeType: 'render',
                revalidateReason: undefined,
            }
        );

        expect(mockReport).not.toHaveBeenCalled();
    });
});
