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
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    it('NEXT_RUNTIME=edge면 instrumentation.node를 import하지 않는다', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        const mockRegister = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).not.toHaveBeenCalled();
    });

    it('NEXT_RUNTIME이 없으면(빌드·기타 컨텍스트) 아무것도 등록하지 않는다', async () => {
        vi.stubEnv('NEXT_RUNTIME', '');
        const mockRegister = vi.fn();
        vi.doMock('../instrumentation.node', () => ({
            registerShutdownHandlers: mockRegister,
        }));

        const { register } = await import('../instrumentation');
        await register();

        expect(mockRegister).not.toHaveBeenCalled();
    });
});
