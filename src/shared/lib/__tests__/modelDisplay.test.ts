import {
    getAllowedModels,
    MODEL_SPECS,
    type ModelId,
} from '@y0ngha/siglens-core';
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

    // 세대가 둘 이상인 패밀리는 라벨에 세대를 포함해야 한다 — 접힌 트리거에서
    // 라벨만 단독 노출되므로, 무버전 라벨은 새 세대가 나온 뒤 "최신"으로 오독된다.
    it('versions every label in a family that has more than one generation', () => {
        // Claude Opus: 4.8과 5가 공존한다.
        expect(getModelDisplay('claude-opus-4-8').label).toBe('Opus 4.8');
        expect(getModelDisplay('claude-opus-5').label).toBe('Opus 5');
        // Gemini Flash: 3.6/3.7/3.8이 공존한다.
        expect(getModelDisplay('gemini-3.6-flash').label).toBe('Flash 3.6');
        expect(getModelDisplay('gemini-3.7-flash').label).toBe('Flash 3.7');
        expect(getModelDisplay('gemini-3.8-flash').label).toBe('Flash 3.8');
        // Flash Lite는 Flash와 다른 라인이므로 라인명도 함께 남긴다.
        expect(getModelDisplay('gemini-3.5-flash-lite').label).toBe(
            'Flash Lite 3.5'
        );
    });

    it('covers every registered model so no id falls back to its raw string', () => {
        // 폴백은 저장된 옛 값을 위한 안전망이지, 현재 모델의 표시 경로가 아니다.
        for (const model of Object.keys(MODEL_SPECS) as ModelId[]) {
            expect(getModelDisplay(model).label, model).not.toBe(model);
        }
    });

    it('falls back to the raw id for an id that is no longer registered', () => {
        // 레지스트리에서 제거된 모델이 localStorage나 분석 이력에 남아 있을 수
        // 있다. 표시 경로가 그 값에 대해 죽지 않고 원문을 그대로 보여줘야 한다.
        const removed = 'gpt-5.4' as ModelId;
        expect(getModelDisplay(removed)).toEqual({
            label: removed,
            fullName: removed,
        });
    });
});
