import { MODEL_SPECS } from '@y0ngha/siglens-core';

const { callDeepseekMock } = vi.hoisted(() => ({
    callDeepseekMock: vi.fn(),
}));

vi.mock('@/entities/llm-provider', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/llm-provider/lib/parseJsonResponse')
    >('@/entities/llm-provider/lib/parseJsonResponse');
    return {
        callDeepseekChat: (...args: unknown[]) => callDeepseekMock(...args),
        parseJsonResponse: actual.parseJsonResponse,
    };
});

import {
    translateCompanyDescription,
    translateCompanyNames,
} from '../../lib/koreanTranslator';

// DEEPSEEK_API_KEY는 분석·챗과 공유하는 서버 키라 `delete process.env`로
// 지우면 같은 worker process의 sibling suite로 "키 없음"이 leak된다.
// `vi.stubEnv` + config의 `unstubEnvs: true` 조합으로 케이스마다 자동 복원.
function stubTranslatorEnv(): void {
    vi.stubEnv('DEEPSEEK_API_KEY', 'server-api-key');
    // 기본값(deepseek-v4-flash)과 다른 유효 모델을 써서 env pass-through가
    // 실제로 일어나는지 검증한다 — config.ts의 TRANSLATE_MODEL 검증이 알 수
    // 없는 값이나 타 provider 모델을 기본 모델로 폴백시키므로, 임의 문자열은
    // 그대로 통과하지 않는다.
    vi.stubEnv('TRANSLATE_MODEL', 'deepseek-v4-pro');
}

describe('translateCompanyNames', () => {
    beforeEach(() => {
        callDeepseekMock.mockReset();
        stubTranslatorEnv();
    });

    it('빈 입력은 즉시 빈 객체를 반환한다', async () => {
        await expect(translateCompanyNames([])).resolves.toEqual({});
        expect(callDeepseekMock).not.toHaveBeenCalled();
    });

    it('DEEPSEEK_API_KEY 가 없으면 빈 객체 반환', async () => {
        vi.stubEnv('DEEPSEEK_API_KEY', undefined);
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
        expect(callDeepseekMock).not.toHaveBeenCalled();
    });

    it('apiKey로 호출하고 번역 결과를 반환한다', async () => {
        callDeepseekMock.mockResolvedValue('{"AAPL":"애플","NVDA":"엔비디아"}');
        const result = await translateCompanyNames([
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'NVDA', name: 'NVIDIA' },
        ]);
        expect(result).toEqual({ AAPL: '애플', NVDA: '엔비디아' });
        expect(callDeepseekMock).toHaveBeenCalledTimes(1);
        // 정확 일치로 단언한다 — `thinkingBudget`이 다시 새어 들어오면
        // (DeepSeek 어댑터가 모르는 필드) 이 케이스가 깨진다. 추론 on/off는
        // `MODEL_SPECS[model].thinking`이 결정하며 호출부는 관여하지 않는다.
        expect(callDeepseekMock).toHaveBeenCalledWith({
            apiKey: 'server-api-key',
            // 리터럴이 아니라 MODEL_SPECS에서 파생한 값과 비교한다.
            model: MODEL_SPECS['deepseek-v4-pro'].apiModelId,
            contents: expect.stringContaining('AAPL: Apple Inc.'),
            // 번역 비용이 챗 비용과 섞이지 않도록 별도 라벨로 집계된다.
            jobId: 'translate',
        });
    });

    it('마크다운 코드펜스로 감싼 JSON 응답도 파싱한다', async () => {
        // DeepSeek chat 어댑터는 챗봇과 공유되어 `response_format:
        // json_object`를 걸지 않는다(산문을 뱉어야 하므로). 스키마 강제가
        // 없으므로 펜스가 붙은 응답이 현실적인 경로 — parseJsonResponse의
        // fence-stripping이 이 경로를 받아낸다.
        callDeepseekMock.mockResolvedValue('```json\n{"AAPL":"애플"}\n```');
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({ AAPL: '애플' });
    });

    it('JSON 파싱 실패 시 빈 객체 반환', async () => {
        callDeepseekMock.mockResolvedValue('not-json');
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
    });

    it('응답이 string record 가 아니면 빈 객체 반환', async () => {
        callDeepseekMock.mockResolvedValue('{"AAPL":123}');
        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});
    });

    it('호출 실패 시 빈 객체 반환 + console.error로 진단 정보를 남긴다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const boom = new Error('failed');
        callDeepseekMock.mockRejectedValue(boom);

        await expect(
            translateCompanyNames([{ symbol: 'AAPL', name: 'Apple Inc.' }])
        ).resolves.toEqual({});

        // 우아한 디그레이드(빈 객체)는 유지하되, 실패가 더 이상 조용히
        // 삼켜지지 않는다는 것이 이 테스트의 핵심.
        expect(errorSpy).toHaveBeenCalledWith(
            '[koreanTranslator] translateCompanyNames failed',
            expect.objectContaining({
                model: MODEL_SPECS['deepseek-v4-pro'].apiModelId,
                entryCount: 1,
                error: boom,
            })
        );

        errorSpy.mockRestore();
    });

    it('TRANSLATE_MODEL 미설정 시 기본 모델을 사용한다', async () => {
        vi.stubEnv('TRANSLATE_MODEL', undefined);
        callDeepseekMock.mockResolvedValue('{}');
        await translateCompanyNames([{ symbol: 'AAPL', name: 'Apple' }]);
        expect(callDeepseekMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: MODEL_SPECS['deepseek-v4-flash'].apiModelId,
            })
        );
    });
});

describe('translateCompanyDescription', () => {
    beforeEach(() => {
        callDeepseekMock.mockReset();
        stubTranslatorEnv();
    });

    it('DEEPSEEK_API_KEY 가 없으면 null 반환', async () => {
        vi.stubEnv('DEEPSEEK_API_KEY', undefined);
        await expect(
            translateCompanyDescription('Apple designs consumer electronics.')
        ).resolves.toBeNull();
        expect(callDeepseekMock).not.toHaveBeenCalled();
    });

    it('apiKey로 번역 후 결과를 반환한다', async () => {
        callDeepseekMock.mockResolvedValue(
            '애플은 소비자 가전 제품을 설계합니다.'
        );
        const result = await translateCompanyDescription(
            'Apple designs consumer electronics.'
        );
        expect(result).toBe('애플은 소비자 가전 제품을 설계합니다.');
        expect(callDeepseekMock).toHaveBeenCalledTimes(1);
        expect(callDeepseekMock).toHaveBeenCalledWith(
            expect.objectContaining({
                apiKey: 'server-api-key',
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
        callDeepseekMock.mockRejectedValue(boom);

        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();

        expect(errorSpy).toHaveBeenCalledWith(
            '[koreanTranslator] translateCompanyDescription failed',
            expect.objectContaining({
                model: MODEL_SPECS['deepseek-v4-pro'].apiModelId,
                descriptionLength: 'Description.'.length,
                error: boom,
            })
        );

        errorSpy.mockRestore();
    });

    it('빈 응답은 null로 반환한다', async () => {
        callDeepseekMock.mockResolvedValue('   ');
        await expect(
            translateCompanyDescription('Description.')
        ).resolves.toBeNull();
    });
});
