import type { ModelId } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';
import { pickFallbackModel } from '@/features/symbol-model/lib/pickFallbackModel';

vi.mock('@y0ngha/siglens-core', () => ({
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
}));

const PREMIUM_MODEL = 'gemini-3.1-pro-preview' as ModelId;

describe('pickFallbackModel', () => {
    it('기본 모델이 목록에 있으면 기본 모델', () => {
        expect(pickFallbackModel([PREMIUM_MODEL, DEFAULT_ANALYSIS_MODEL])).toBe(
            DEFAULT_ANALYSIS_MODEL
        );
    });

    it('기본 모델이 빠졌으면(DeepSeek를 끈 경우) BYOK가 아닌 첫 free 모델', () => {
        expect(
            pickFallbackModel([
                'claude-opus-5',
                'gemini-3.6-flash',
            ] as ModelId[])
        ).toBe('gemini-3.6-flash');
    });

    it('free 모델이 없으면 첫 항목', () => {
        expect(pickFallbackModel(['claude-opus-5'] as ModelId[])).toBe(
            'claude-opus-5'
        );
    });

    it('목록이 비면 기본 모델', () => {
        expect(pickFallbackModel([])).toBe(DEFAULT_ANALYSIS_MODEL);
    });
});
