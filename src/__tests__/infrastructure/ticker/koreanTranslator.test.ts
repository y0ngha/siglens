const callGeminiMock = jest.fn();

jest.mock('@/infrastructure/ai/gemini', () => ({
    callGeminiWithKeyFallback: (...args: unknown[]) => callGeminiMock(...args),
}));

import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';

describe('translateCompanyNames', () => {
    beforeEach(() => {
        callGeminiMock.mockReset();
        process.env.TRANSLATE_API_KEY = 'paid-key';
        process.env.TRANSLATE_FREE_API_KEY = 'free-key';
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

    it('Gemini 응답을 JSON 으로 파싱하여 반환한다', async () => {
        callGeminiMock.mockResolvedValue('{"AAPL":"애플","NVDA":"엔비디아"}');
        const result = await translateCompanyNames([
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'NVDA', name: 'NVIDIA' },
        ]);
        expect(result).toEqual({ AAPL: '애플', NVDA: '엔비디아' });
        expect(callGeminiMock).toHaveBeenCalledWith({
            primaryApiKey: 'free-key',
            fallbackApiKey: 'paid-key',
            model: 'gemini-test',
            contents: expect.stringContaining('AAPL: Apple Inc.'),
        });
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

    it('Gemini 호출 실패 시 빈 객체 반환', async () => {
        callGeminiMock.mockRejectedValue(new Error('quota'));
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
