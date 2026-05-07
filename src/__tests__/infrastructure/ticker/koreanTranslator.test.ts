const callGeminiMock = jest.fn();

jest.mock('@/infrastructure/ai/gemini', () => ({
    callGeminiChat: (...args: unknown[]) => callGeminiMock(...args),
}));

import {
    translateCompanyDescription,
    translateCompanyNames,
} from '@/infrastructure/ticker/koreanTranslator';

describe('translateCompanyNames', () => {
    beforeEach(() => {
        callGeminiMock.mockReset();
        process.env.TRANSLATE_API_KEY = 'server-api-key';
        process.env.TRANSLATE_FREE_API_KEY = 'free-api-key';
        process.env.TRANSLATE_MODEL = 'gemini-test';
    });

    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_FREE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
    });

    it('빈 입력은 즉시 빈 객체를 반환한다', async () => {
        await expect(translateCompanyNames([])).resolves.toEqual({});
        expect(callGeminiMock).not.toHaveBeenCalled();
    });

    it('TRANSLATE_API_KEY 가 없으면 빈 객체 반환', async () => {
        delete process.env.TRANSLATE_API_KEY;
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
        expect(callGeminiMock).not.toHaveBeenCalled();
    });

    it('freeApiKey가 있으면 freeApiKey로 먼저 호출한다', async () => {
        callGeminiMock.mockResolvedValue('{"AAPL":"애플","NVDA":"엔비디아"}');
        const result = await translateCompanyNames([
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'NVDA', name: 'NVIDIA' },
        ]);
        expect(result).toEqual({ AAPL: '애플', NVDA: '엔비디아' });
        expect(callGeminiMock).toHaveBeenCalledTimes(1);
        expect(callGeminiMock).toHaveBeenCalledWith({
            serverApiKey: 'free-api-key',
            userApiKey: undefined,
            model: 'gemini-test',
            contents: expect.stringContaining('AAPL: Apple Inc.'),
            thinkingBudget: 0,
        });
    });

    it('freeApiKey 호출 실패 시 apiKey로 fallback한다', async () => {
        callGeminiMock
            .mockRejectedValueOnce(new Error('quota'))
            .mockResolvedValueOnce('{"AAPL":"애플"}');
        const result = await translateCompanyNames([
            { symbol: 'AAPL', name: 'Apple Inc.' },
        ]);
        expect(result).toEqual({ AAPL: '애플' });
        expect(callGeminiMock).toHaveBeenCalledTimes(2);
        expect(callGeminiMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ serverApiKey: 'free-api-key', thinkingBudget: 0 })
        );
        expect(callGeminiMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ serverApiKey: 'server-api-key', thinkingBudget: 0 })
        );
    });

    it('freeApiKey 없으면 apiKey로 직접 호출한다', async () => {
        delete process.env.TRANSLATE_FREE_API_KEY;
        callGeminiMock.mockResolvedValue('{"AAPL":"애플"}');
        await translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }]);
        expect(callGeminiMock).toHaveBeenCalledTimes(1);
        expect(callGeminiMock).toHaveBeenCalledWith(
            expect.objectContaining({ serverApiKey: 'server-api-key', thinkingBudget: 0 })
        );
    });

    it('JSON 파싱 실패 시 빈 객체 반환', async () => {
        callGeminiMock.mockResolvedValue('not-json');
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
    });

    it('응답이 string record 가 아니면 빈 객체 반환', async () => {
        callGeminiMock.mockResolvedValue('{"AAPL":123}');
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
    });

    it('freeApiKey, apiKey 모두 실패 시 빈 객체 반환', async () => {
        callGeminiMock.mockRejectedValue(new Error('all failed'));
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
    });

    it('TRANSLATE_MODEL 미설정 시 기본 모델을 사용한다', async () => {
        delete process.env.TRANSLATE_MODEL;
        callGeminiMock.mockResolvedValue('{}');
        await translateCompanyNames([{ symbol: 'AAPL', name: 'Apple' }]);
        expect(callGeminiMock).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-2.5-flash' })
        );
    });
});

describe('translateCompanyDescription', () => {
    beforeEach(() => {
        callGeminiMock.mockReset();
        process.env.TRANSLATE_API_KEY = 'server-api-key';
        process.env.TRANSLATE_FREE_API_KEY = 'free-api-key';
        process.env.TRANSLATE_MODEL = 'gemini-test';
    });

    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_FREE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
    });

    it('TRANSLATE_API_KEY 가 없으면 null 반환', async () => {
        delete process.env.TRANSLATE_API_KEY;
        await expect(
            translateCompanyDescription('Apple designs consumer electronics.')
        ).resolves.toBeNull();
        expect(callGeminiMock).not.toHaveBeenCalled();
    });

    it('freeApiKey로 번역 후 결과를 반환한다', async () => {
        callGeminiMock.mockResolvedValue(
            '애플은 소비자 가전 제품을 설계합니다.'
        );
        const result = await translateCompanyDescription(
            'Apple designs consumer electronics.'
        );
        expect(result).toBe('애플은 소비자 가전 제품을 설계합니다.');
        expect(callGeminiMock).toHaveBeenCalledTimes(1);
        expect(callGeminiMock).toHaveBeenCalledWith(
            expect.objectContaining({
                serverApiKey: 'free-api-key',
                thinkingBudget: 0,
                contents: expect.stringContaining(
                    'Apple designs consumer electronics.'
                ),
            })
        );
    });

    it('freeApiKey 실패 시 apiKey로 fallback한다', async () => {
        callGeminiMock
            .mockRejectedValueOnce(new Error('quota'))
            .mockResolvedValueOnce('번역된 설명');
        const result = await translateCompanyDescription('Description.');
        expect(result).toBe('번역된 설명');
        expect(callGeminiMock).toHaveBeenCalledTimes(2);
        expect(callGeminiMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ serverApiKey: 'free-api-key', thinkingBudget: 0 })
        );
        expect(callGeminiMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ serverApiKey: 'server-api-key', thinkingBudget: 0 })
        );
    });

    it('LLM 호출 실패 시 null을 반환한다', async () => {
        callGeminiMock.mockRejectedValue(new Error('all failed'));
        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();
    });

    it('freeApiKey 없으면 apiKey로 직접 호출한다', async () => {
        delete process.env.TRANSLATE_FREE_API_KEY;
        callGeminiMock.mockResolvedValue('번역된 설명');
        await translateCompanyDescription('Description.');
        expect(callGeminiMock).toHaveBeenCalledTimes(1);
        expect(callGeminiMock).toHaveBeenCalledWith(
            expect.objectContaining({ serverApiKey: 'server-api-key', thinkingBudget: 0 })
        );
    });

    it('빈 응답은 null로 반환한다', async () => {
        callGeminiMock.mockResolvedValue('   ');
        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();
    });
});
