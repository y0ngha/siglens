import type { ModelId } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';
import {
    isServerKeyModelDisabled,
    listDisabledServerKeyModels,
    readDisabledServerKeyProviders,
    resolveServableModelId,
} from '@/entities/llm-provider/lib/serverKeyKillSwitch';

const HAIKU = 'claude-haiku-5-5' as ModelId;
const SONNET = 'claude-sonnet-5-5' as ModelId;
const OPUS_BYOK = 'claude-opus-5-5' as ModelId;
const GEMINI_FREE = 'gemini-3.6-flash' as ModelId;

describe('readDisabledServerKeyProviders', () => {
    it('미설정이면 빈 집합', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', undefined);
        expect(readDisabledServerKeyProviders().size).toBe(0);
    });

    it('쉼표 목록을 대소문자·공백 무시로 읽는다', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', ' Anthropic , openai ');
        expect([...readDisabledServerKeyProviders()].sort()).toEqual([
            'anthropic',
            'openai',
        ]);
    });

    it('모르는 값은 버린다(SSM에서 다시 켤 때 none을 넣는 경로)', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'none,claude,');
        expect(readDisabledServerKeyProviders().size).toBe(0);
    });
});

describe('isServerKeyModelDisabled', () => {
    beforeEach(() => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
    });

    it('꺼진 provider의 free·member 모델은 꺼짐', () => {
        expect(isServerKeyModelDisabled(HAIKU)).toBe(true);
        expect(isServerKeyModelDisabled(SONNET)).toBe(true);
    });

    it('BYOK 모델은 사용자 키라 켜짐', () => {
        expect(isServerKeyModelDisabled(OPUS_BYOK)).toBe(false);
    });

    it('다른 provider 모델은 켜짐', () => {
        expect(isServerKeyModelDisabled(GEMINI_FREE)).toBe(false);
        expect(isServerKeyModelDisabled(DEFAULT_ANALYSIS_MODEL)).toBe(false);
    });
});

describe('listDisabledServerKeyModels', () => {
    it('꺼진 provider가 없으면 빈 배열', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', undefined);
        expect(listDisabledServerKeyModels()).toEqual([]);
    });

    it('anthropic이면 서버 키 Claude 모델만 담고 BYOK Claude는 뺀다', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
        const models = listDisabledServerKeyModels();
        expect(models).toEqual(expect.arrayContaining([HAIKU, SONNET]));
        expect(models).not.toContain(OPUS_BYOK);
        expect(models.every(model => model.startsWith('claude-'))).toBe(true);
    });
});

describe('resolveServableModelId', () => {
    it('켜진 모델은 그대로', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
        expect(resolveServableModelId(GEMINI_FREE)).toEqual({
            modelId: GEMINI_FREE,
            fallbackFrom: null,
        });
    });

    it('꺼진 모델은 기본 모델로 바꾸고 원래 모델을 남긴다', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
        expect(resolveServableModelId(SONNET)).toEqual({
            modelId: DEFAULT_ANALYSIS_MODEL,
            fallbackFrom: SONNET,
        });
    });

    it('로스터에 없는 값은 그대로 넘긴다(거절은 게이트 몫)', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
        const unknown = 'claude-made-up' as ModelId;
        expect(resolveServableModelId(unknown)).toEqual({
            modelId: unknown,
            fallbackFrom: null,
        });
    });

    it('대체 모델까지 꺼져 있으면 바꾸지 않는다', () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic,deepseek');
        expect(resolveServableModelId(HAIKU)).toEqual({
            modelId: HAIKU,
            fallbackFrom: null,
        });
    });
});
