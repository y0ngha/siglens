import { MODEL_SPECS } from '@y0ngha/siglens-core';

const { callGeminiMock } = vi.hoisted(() => ({
    callGeminiMock: vi.fn(),
}));

vi.mock('@/entities/llm-provider', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/llm-provider/lib/parseJsonResponse')
    >('@/entities/llm-provider/lib/parseJsonResponse');
    return {
        callGeminiChat: (...args: unknown[]) => callGeminiMock(...args),
        parseJsonResponse: actual.parseJsonResponse,
    };
});

import {
    translateCompanyDescription,
    translateCompanyNames,
} from '../../lib/koreanTranslator';

describe('translateCompanyNames', () => {
    beforeEach(() => {
        callGeminiMock.mockReset();
        process.env.TRANSLATE_API_KEY = 'server-api-key';
        // 사고 비활성화(thinkingBudget: 0)를 지원하는 유효한 Gemini 모델 ID를
        // 사용 — config.ts의 TRANSLATE_MODEL 검증(FIX 3)이 알 수 없는 값이나
        // 사고 비활성화 미지원 모델을 기본 모델로 폴백시키므로, 임의 문자열은
        // 더 이상 그대로 통과하지 않는다.
        process.env.TRANSLATE_MODEL = 'gemini-2.5-flash';
    });

    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
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

    it('apiKey로 호출하고 번역 결과를 반환한다', async () => {
        callGeminiMock.mockResolvedValue('{"AAPL":"애플","NVDA":"엔비디아"}');
        const result = await translateCompanyNames([
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'NVDA', name: 'NVIDIA' },
        ]);
        expect(result).toEqual({ AAPL: '애플', NVDA: '엔비디아' });
        expect(callGeminiMock).toHaveBeenCalledTimes(1);
        expect(callGeminiMock).toHaveBeenCalledWith({
            serverApiKey: 'server-api-key',
            userApiKey: undefined,
            // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다 — REQUIRED 6.
            model: MODEL_SPECS['gemini-2.5-flash'].apiModelId,
            contents: expect.stringContaining('AAPL: Apple Inc.'),
            thinkingBudget: 0,
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

    it('호출 실패 시 빈 객체 반환 + console.error로 진단 정보를 남긴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const boom = new Error('failed');
        callGeminiMock.mockRejectedValue(boom);

        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});

        // 우아한 디그레이드(빈 객체)는 유지하되, 실패가 더 이상 조용히
        // 삼켜지지 않는다는 것이 이 테스트의 핵심 — FIX 3(b).
        expect(errorSpy).toHaveBeenCalledWith(
            '[koreanTranslator] translateCompanyNames failed',
            expect.objectContaining({
                // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다 — REQUIRED 6.
                model: MODEL_SPECS['gemini-2.5-flash'].apiModelId,
                entryCount: 1,
                error: boom,
            })
        );

        errorSpy.mockRestore();
    });

    it('TRANSLATE_MODEL 미설정 시 기본 모델을 사용한다', async () => {
        delete process.env.TRANSLATE_MODEL;
        callGeminiMock.mockResolvedValue('{}');
        await translateCompanyNames([{ symbol: 'AAPL', name: 'Apple' }]);
        expect(callGeminiMock).toHaveBeenCalledWith(
            // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다 — REQUIRED 6.
            expect.objectContaining({
                model: MODEL_SPECS['gemini-2.5-flash-lite'].apiModelId,
            })
        );
    });
});

describe('translateCompanyDescription', () => {
    beforeEach(() => {
        callGeminiMock.mockReset();
        process.env.TRANSLATE_API_KEY = 'server-api-key';
        // 사고 비활성화(thinkingBudget: 0)를 지원하는 유효한 Gemini 모델 ID를
        // 사용 — config.ts의 TRANSLATE_MODEL 검증(FIX 3)이 알 수 없는 값이나
        // 사고 비활성화 미지원 모델을 기본 모델로 폴백시키므로, 임의 문자열은
        // 더 이상 그대로 통과하지 않는다.
        process.env.TRANSLATE_MODEL = 'gemini-2.5-flash';
    });

    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
    });

    it('TRANSLATE_API_KEY 가 없으면 null 반환', async () => {
        delete process.env.TRANSLATE_API_KEY;
        await expect(
            translateCompanyDescription('Apple designs consumer electronics.')
        ).resolves.toBeNull();
        expect(callGeminiMock).not.toHaveBeenCalled();
    });

    it('apiKey로 번역 후 결과를 반환한다', async () => {
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
                serverApiKey: 'server-api-key',
                thinkingBudget: 0,
                contents: expect.stringContaining(
                    'Apple designs consumer electronics.'
                ),
            })
        );
    });

    it('LLM 호출 실패 시 null을 반환 + console.error로 진단 정보를 남긴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const boom = new Error('failed');
        callGeminiMock.mockRejectedValue(boom);

        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();

        expect(errorSpy).toHaveBeenCalledWith(
            '[koreanTranslator] translateCompanyDescription failed',
            expect.objectContaining({
                // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다 — REQUIRED 6.
                model: MODEL_SPECS['gemini-2.5-flash'].apiModelId,
                descriptionLength: 'Description.'.length,
                error: boom,
            })
        );

        errorSpy.mockRestore();
    });

    it('빈 응답은 null로 반환한다', async () => {
        callGeminiMock.mockResolvedValue('   ');
        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();
    });
});
