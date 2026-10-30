import type { LlmProvider, ModelId } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';
import {
    isServerKeyModelDisabled,
    parseDisabledServerKeyProviders,
    pickServableModel,
    selectDisabledServerKeyModels,
} from '@/entities/llm-provider/lib/serverKeyKillSwitch';

const HAIKU = 'claude-haiku-5-5' as ModelId;
const SONNET = 'claude-sonnet-5-5' as ModelId;
const OPUS_BYOK = 'claude-opus-5-5' as ModelId;
const GEMINI_FREE = 'gemini-3.6-flash' as ModelId;
const ANTHROPIC_OFF: ReadonlySet<LlmProvider> = new Set(['anthropic']);

describe('parseDisabledServerKeyProviders', () => {
    it('빈 문자열이면 빈 집합', () => {
        expect(parseDisabledServerKeyProviders('').size).toBe(0);
    });

    it('쉼표 목록을 대소문자·공백 무시로 읽는다', () => {
        expect(
            [...parseDisabledServerKeyProviders(' Anthropic , openai ')].sort()
        ).toEqual(['anthropic', 'openai']);
    });

    it('모르는 값은 버린다(SSM에서 다시 켤 때 none을 넣는 경로)', () => {
        expect(parseDisabledServerKeyProviders('none,claude,').size).toBe(0);
    });
});

describe('isServerKeyModelDisabled', () => {
    it('꺼진 provider의 free·member 모델은 꺼짐', () => {
        expect(isServerKeyModelDisabled(HAIKU, ANTHROPIC_OFF)).toBe(true);
        expect(isServerKeyModelDisabled(SONNET, ANTHROPIC_OFF)).toBe(true);
    });

    it('BYOK 모델은 사용자 키라 켜짐', () => {
        expect(isServerKeyModelDisabled(OPUS_BYOK, ANTHROPIC_OFF)).toBe(false);
    });

    it('다른 provider 모델은 켜짐', () => {
        expect(isServerKeyModelDisabled(GEMINI_FREE, ANTHROPIC_OFF)).toBe(
            false
        );
        expect(
            isServerKeyModelDisabled(DEFAULT_ANALYSIS_MODEL, ANTHROPIC_OFF)
        ).toBe(false);
    });

    it('꺼진 provider가 없으면 켜짐', () => {
        expect(isServerKeyModelDisabled(HAIKU, new Set())).toBe(false);
    });
});

describe('selectDisabledServerKeyModels', () => {
    it('꺼진 provider가 없으면 빈 배열', () => {
        expect(selectDisabledServerKeyModels(new Set())).toEqual([]);
    });

    it('anthropic이면 서버 키 Claude 모델만 담고 BYOK Claude는 뺀다', () => {
        const models = selectDisabledServerKeyModels(ANTHROPIC_OFF);
        expect(models).toEqual(expect.arrayContaining([HAIKU, SONNET]));
        expect(models).not.toContain(OPUS_BYOK);
        expect(models.every(model => model.startsWith('claude-'))).toBe(true);
    });
});

describe('pickServableModel', () => {
    it('켜진 모델은 그대로', () => {
        expect(pickServableModel(GEMINI_FREE, ANTHROPIC_OFF)).toEqual({
            modelId: GEMINI_FREE,
            fallbackFrom: null,
        });
    });

    it('꺼진 모델은 기본 모델로 바꾸고 원래 모델을 남긴다', () => {
        expect(pickServableModel(SONNET, ANTHROPIC_OFF)).toEqual({
            modelId: DEFAULT_ANALYSIS_MODEL,
            fallbackFrom: SONNET,
        });
    });

    it('로스터에 없는 값은 그대로 넘긴다(거절은 게이트 몫)', () => {
        const unknown = 'claude-made-up' as ModelId;
        expect(pickServableModel(unknown, ANTHROPIC_OFF)).toEqual({
            modelId: unknown,
            fallbackFrom: null,
        });
    });

    it('대체 모델까지 꺼져 있으면 바꾸지 않는다', () => {
        expect(
            pickServableModel(HAIKU, new Set(['anthropic', 'deepseek']))
        ).toEqual({ modelId: HAIKU, fallbackFrom: null });
    });
});
