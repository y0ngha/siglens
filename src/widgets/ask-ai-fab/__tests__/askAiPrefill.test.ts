/**
 * `resolveAskAiPrefill` — 프리필 질문 출처(`name`/`question`)별 분기.
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveAskAiPrefill } from '../utils/askAiPrefill';

describe('resolveAskAiPrefill', () => {
    it('name을 주면 문구 생성 콜백에 종목명을 넘긴 결과를 쓴다', () => {
        const format = vi.fn((name: string) => `${name} 지금 어때?`);

        expect(resolveAskAiPrefill({ name: '애플' }, format)).toBe(
            '애플 지금 어때?'
        );
        expect(format).toHaveBeenCalledExactlyOnceWith('애플');
    });

    it('question을 주면 그 문장을 그대로 쓰고 콜백을 부르지 않는다', () => {
        const format = vi.fn((name: string) => name);

        expect(
            resolveAskAiPrefill({ question: '가이드: RSI. 설명해 줘' }, format)
        ).toBe('가이드: RSI. 설명해 줘');
        expect(format).not.toHaveBeenCalled();
    });

    it('빈 question도 질문으로 취급한다 — name 문구로 바꿔치지 않는다', () => {
        const format = vi.fn((name: string) => name);

        expect(resolveAskAiPrefill({ question: '' }, format)).toBe('');
        expect(format).not.toHaveBeenCalled();
    });
});
