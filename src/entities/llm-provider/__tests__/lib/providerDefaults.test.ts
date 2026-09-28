import {
    CHATGPT_MODEL_PRIORITY,
    CLAUDE_MODEL_PRIORITY,
    DEEPSEEK_MODEL_PRIORITY,
    GEMINI_MODEL_PRIORITY,
} from '@/entities/llm-provider/lib/providerDefaults';
import { MODEL_SPECS } from '@y0ngha/siglens-core';

describe('priority list coverage', () => {
    // core에 모델을 추가하고 이 목록에 반영하지 않는 드리프트를 막는다.
    // (이 목록들은 현재 production 소비처가 없다 — providerDefaults.ts 상단 주석 참고.
    //  소비처가 붙는 시점에 낡은 목록이면 신규 모델이 조용히 후보에서 빠지므로 감시한다.)
    it.each([
        ['claude', CLAUDE_MODEL_PRIORITY],
        ['gemini', GEMINI_MODEL_PRIORITY],
        ['chatgpt', CHATGPT_MODEL_PRIORITY],
        ['deepseek', DEEPSEEK_MODEL_PRIORITY],
    ] as const)('covers every %s model in MODEL_SPECS', (provider, list) => {
        const specModels = Object.entries(MODEL_SPECS)
            .filter(([, spec]) => spec.provider === provider)
            .map(([id]) => id);
        expect([...list].toSorted()).toEqual(specModels.toSorted());
    });

    it('pins the head of every provider list', () => {
        expect(CLAUDE_MODEL_PRIORITY[0]).toBe('claude-fable-5-1');
        expect(CHATGPT_MODEL_PRIORITY[0]).toBe('gpt-6-astra');
        // 의도적 예외 — Gemini는 최신 세대가 Flash 라인뿐이라 구세대 Pro가 앞선다.
        // "최신 모델을 맨 앞으로" 라는 순진한 수정이 여기서 실패해야 한다.
        expect(GEMINI_MODEL_PRIORITY[0]).toBe('gemini-3.1-pro-preview');
        expect(DEEPSEEK_MODEL_PRIORITY[0]).toBe('deepseek-v4.1-flash');
    });
});
