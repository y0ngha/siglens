import { getAllowedModels, type ModelId } from '@y0ngha/siglens-core';
import { MODEL_DISPLAY_MAP, getModelDisplay } from '@/shared/lib/modelDisplay';

describe('MODEL_DISPLAY_MAP', () => {
    // 셀렉터가 그리는 목록은 getAllowedModels('pro')와 동일하다 (tier 제한이 꺼져 있어
    // 모든 사용자가 전체 목록을 본다). 여기 누락된 모델은 raw id가 UI에 그대로 노출되므로
    // core에 모델을 추가하고 라벨을 빠뜨리는 드리프트를 이 테스트로 막는다.
    const selectableModels: readonly ModelId[] = getAllowedModels('pro');

    it('has a display entry for every selectable model', () => {
        const missing = selectableModels.filter(
            id => MODEL_DISPLAY_MAP[id] === undefined
        );
        expect(missing).toEqual([]);
    });

    // label은 접힌 트리거/기어 aria-label/챗 칩에서 단독 노출되는 유일한 문자열이라,
    // 두 모델이 같은 label을 쓰면 사용자가 구분할 방법이 없다. fullName보다 이쪽이
    // 더 중요한 불변식이다.
    it('gives every selectable model a unique label', () => {
        const labels = selectableModels.map(id => getModelDisplay(id).label);
        const duplicated = labels.filter(
            (label, index) => labels.indexOf(label) !== index
        );
        expect(duplicated).toEqual([]);
    });

    it('gives every selectable model a unique full name', () => {
        const fullNames = selectableModels.map(
            id => getModelDisplay(id).fullName
        );
        const duplicated = fullNames.filter(
            (name, index) => fullNames.indexOf(name) !== index
        );
        expect(duplicated).toEqual([]);
    });

    it('labels the 2026-07 model generation', () => {
        expect(getModelDisplay('claude-opus-5')).toEqual({
            label: 'Opus 5',
            fullName: 'Claude Opus 5',
        });
        expect(getModelDisplay('claude-sonnet-5')).toEqual({
            label: 'Sonnet 5',
            fullName: 'Claude Sonnet 5',
        });
        expect(getModelDisplay('gpt-5.6-sol')).toEqual({
            label: 'GPT 5.6 Sol',
            fullName: 'GPT-5.6 Sol',
        });
        expect(getModelDisplay('gpt-5.6-terra')).toEqual({
            label: 'GPT 5.6 Terra',
            fullName: 'GPT-5.6 Terra',
        });
        expect(getModelDisplay('gemini-3.6-flash')).toEqual({
            label: 'Flash 3.6',
            fullName: 'Gemini 3.6 Flash',
        });
        expect(getModelDisplay('gemini-3.5-flash-lite')).toEqual({
            label: 'Flash Lite 3.5',
            fullName: 'Gemini 3.5 Flash Lite',
        });
    });

    // 세대가 둘 이상인 패밀리의 구세대 라벨이 무버전으로 남으면 접힌 트리거에서
    // "최신"으로 오독된다 (예: "Opus"가 4.7인데 Opus 5가 나온 뒤에도 최신처럼 보임).
    it('versions the older generation labels that now share a family', () => {
        expect(getModelDisplay('claude-opus-4-7').label).toBe('Opus 4.7');
        expect(getModelDisplay('claude-sonnet-4-6').label).toBe('Sonnet 4.6');
        expect(getModelDisplay('gemini-2.5-flash').label).toBe('Flash 2.5');
        expect(getModelDisplay('gemini-2.5-flash-lite').label).toBe(
            'Flash Lite 2.5'
        );
        expect(getModelDisplay('gemini-2.5-pro').label).toBe('Pro 2.5');
    });

    it('falls back to the raw id for an unmapped model', () => {
        // 배포된 적 있는 deprecated alias — MODEL_DISPLAY_MAP에 없다.
        const legacy: ModelId = 'claude-sonnet-4';
        expect(getModelDisplay(legacy)).toEqual({
            label: legacy,
            fullName: legacy,
        });
    });
});
