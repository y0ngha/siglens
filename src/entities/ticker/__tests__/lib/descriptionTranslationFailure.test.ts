const { credentials, runCommand } = vi.hoisted(() => ({
    credentials: vi.fn(),
    runCommand: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({
    getUpstashWriterCredentials: () => credentials(),
}));
vi.mock('@/shared/cache/upstashRenderSafeCommand', () => ({
    runUpstashCommandOutsideFetch: (args: unknown) => runCommand(args),
}));

import {
    hasDescriptionTranslationFailed,
    markDescriptionTranslationFailed,
} from '@/entities/ticker/lib/descriptionTranslationFailure';

describe('descriptionTranslationFailure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        credentials.mockReturnValue({ url: 'https://redis', token: 't' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('표시는 심볼(대문자)별 키에 하루 TTL로 남긴다 — 전역 fetch를 거치지 않는다', async () => {
        runCommand.mockResolvedValue('OK');
        await markDescriptionTranslationFailed('aapl');
        expect(runCommand).toHaveBeenCalledWith([
            'SET',
            'ticker:description-ko-failed:AAPL',
            '1',
            'EX',
            86_400,
        ]);
    });

    it('표시가 있으면 true, 없으면(null) false', async () => {
        runCommand.mockResolvedValueOnce('1').mockResolvedValueOnce(null);
        expect(await hasDescriptionTranslationFailed('AAPL')).toBe(true);
        expect(await hasDescriptionTranslationFailed('AAPL')).toBe(false);
        expect(runCommand).toHaveBeenCalledWith([
            'GET',
            'ticker:description-ko-failed:AAPL',
        ]);
    });

    it('Redis 미설정이면 읽기는 false, 쓰기는 noop', async () => {
        credentials.mockReturnValue(null);
        expect(await hasDescriptionTranslationFailed('AAPL')).toBe(false);
        await markDescriptionTranslationFailed('AAPL');
        expect(runCommand).not.toHaveBeenCalled();
    });

    it('Redis 오류는 삼킨다 (읽기 false, 쓰기 noop)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        runCommand.mockRejectedValue(new Error('upstash down'));
        expect(await hasDescriptionTranslationFailed('AAPL')).toBe(false);
        await expect(
            markDescriptionTranslationFailed('AAPL')
        ).resolves.toBeUndefined();
    });
});
