import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tryGetDatabaseClient = vi.fn();
const isE2E = vi.fn();
const isOfflineBuild = vi.fn();
const repoFind = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => isE2E() }));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: () => isOfflineBuild(),
}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => tryGetDatabaseClient(),
}));
vi.mock('../../plainTextRepository', () => ({
    DrizzlePlainTextRepository: class {
        find = (...args: unknown[]) => repoFind(...args);
    },
}));

const {
    PLAIN_STORE_READ_TIMEOUT_MS,
    buildInputDigest,
    findStored,
    tryCreateRepository,
} = await import('../plainStore');
const { PLAIN_PROMPT_VERSION } = await import('../../lib/buildPlainPrompt');

beforeEach(() => {
    vi.clearAllMocks();
    isE2E.mockReturnValue(false);
    isOfflineBuild.mockReturnValue(false);
    tryGetDatabaseClient.mockReturnValue({ db: {} });
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('buildInputDigest', () => {
    it('프롬프트의 sha256 hex다(저장 키 형식)', () => {
        expect(buildInputDigest('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });
});

describe('tryCreateRepository', () => {
    it('클라이언트가 있으면 저장소를 만든다', () => {
        expect(tryCreateRepository()).not.toBeNull();
    });

    it('클라이언트 생성이 던지면 null이고 오류를 남긴다', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const boom = new Error('boom');
        tryGetDatabaseClient.mockImplementation(() => {
            throw boom;
        });
        expect(tryCreateRepository()).toBeNull();
        expect(error).toHaveBeenCalledWith(
            '[analysisPlain] repository unavailable',
            { error: boom }
        );
    });

    it('DB가 없으면 null이고 프로세스당 한 번만 경고한다', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        tryGetDatabaseClient.mockReturnValue(null);
        expect(tryCreateRepository()).toBeNull();
        expect(tryCreateRepository()).toBeNull();
        expect(error).toHaveBeenCalledTimes(1);
    });
});

describe('findStored', () => {
    it('저장소가 없으면 조회 없이 null이다', async () => {
        expect(await findStored(null, 'ko', 'd')).toBeNull();
    });

    it('프롬프트 버전·로케일·digest로 조회한다', async () => {
        repoFind.mockResolvedValue('저장된 글');
        const repo = tryCreateRepository();
        expect(await findStored(repo, 'en', 'dg')).toBe('저장된 글');
        expect(repoFind).toHaveBeenCalledWith(PLAIN_PROMPT_VERSION, 'en', 'dg');
    });

    it('조회가 거절되면 미스(null)다', async () => {
        repoFind.mockRejectedValue(new Error('db down'));
        expect(await findStored(tryCreateRepository(), 'ko', 'd')).toBeNull();
    });

    it('상한을 넘기면 미스(null)로 물러나고 경고한다', async () => {
        vi.useFakeTimers();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        repoFind.mockReturnValue(new Promise(() => {}));
        const pending = findStored(tryCreateRepository(), 'ko', 'd');
        await vi.advanceTimersByTimeAsync(PLAIN_STORE_READ_TIMEOUT_MS);
        expect(await pending).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[analysisPlain] store read timed out',
            { ms: PLAIN_STORE_READ_TIMEOUT_MS }
        );
    });

    it('조회가 끝나면 타이머를 남기지 않는다', async () => {
        vi.useFakeTimers();
        repoFind.mockResolvedValue('x');
        await findStored(tryCreateRepository(), 'ko', 'd');
        expect(vi.getTimerCount()).toBe(0);
    });
});
