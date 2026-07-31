import type { ModelId } from '@y0ngha/siglens-core';

/**
 * Human-readable label + full name for an AI model, shown in model-selector
 * UI (analysis model dropdown, chat model dropdown). Extracted to `shared`
 * because `widgets/analysis` (ModelSelector) and `widgets/chat` (ChatPanel)
 * previously duplicated an identical map — cross-widget imports are allowed by
 * FSD here, but a shared, presentation-only lookup table belongs in `shared`
 * rather than being owned by either widget.
 */
export interface ModelDisplayInfo {
    label: string;
    fullName: string;
}

/**
 * `label`은 접힌 표면(ModelSelector 트리거, 분석 설정 기어의 aria-label/title,
 * 챗 패널 칩)에서 **단독으로** 노출되는 유일한 문자열이다 — `fullName`은 드롭다운을
 * 펼쳐야 보인다.
 *
 * 규칙: **세대가 둘 이상인 패밀리의 라벨은 세대를 포함해야 한다.** `'Opus'`/
 * `'Sonnet'`/`'Flash'` 같은 무버전 라벨은 새 세대가 나온 뒤 "최신"으로 오독되기
 * 때문이다. 자리 배치는 각 provider가 실제로 쓰는 명명을 따른다 — Claude/Gemini는
 * `<라인> <세대>`(`Opus 5`, `Flash Lite 2.5`), GPT는 세대가 가운데 오는
 * `GPT <세대> <변형>`(`GPT 5.6 Sol`). 고정 포맷보다 provider 표기와의 일치를
 * 우선한다.
 *
 * DeepSeek만 세대 표기가 없다(`'DeepSeek Flash'` / `'DeepSeek Pro'`) — 등재된
 * 세대가 V4 하나뿐이라 오독될 다른 세대가 없고, 접힌 트리거에서 `'Flash 2.5'`
 * 같은 Gemini 라벨과 구분되도록 provider 이름을 앞에 둔다. V4 외 세대가 추가되면
 * 그때 세대를 붙일 것.
 */
export const MODEL_DISPLAY_MAP: Partial<Record<ModelId, ModelDisplayInfo>> = {
    'gemini-2.5-flash-lite': {
        label: 'Flash Lite 2.5',
        fullName: 'Gemini 2.5 Flash Lite',
    },
    'gemini-2.5-flash': { label: 'Flash 2.5', fullName: 'Gemini 2.5 Flash' },
    'gemini-2.5-pro': { label: 'Pro 2.5', fullName: 'Gemini 2.5 Pro' },
    'gemini-3.1-pro-preview': {
        label: 'Pro 3.1',
        fullName: 'Gemini 3.1 Pro Preview',
    },
    'gemini-3-flash-preview': {
        label: 'Flash 3',
        fullName: 'Gemini 3 Flash Preview',
    },
    'gemini-3.5-flash-lite': {
        label: 'Flash Lite 3.5',
        fullName: 'Gemini 3.5 Flash Lite',
    },
    'gemini-3.6-flash': {
        label: 'Flash 3.6',
        fullName: 'Gemini 3.6 Flash',
    },
    'claude-haiku-4-5': { label: 'Haiku 4.5', fullName: 'Claude Haiku 4.5' },
    'claude-sonnet-4-6': { label: 'Sonnet 4.6', fullName: 'Claude Sonnet 4.6' },
    'claude-opus-4-7': { label: 'Opus 4.7', fullName: 'Claude Opus 4.7' },
    'claude-sonnet-5': { label: 'Sonnet 5', fullName: 'Claude Sonnet 5' },
    'claude-opus-5': { label: 'Opus 5', fullName: 'Claude Opus 5' },
    'gpt-5-mini': { label: 'GPT 5 Mini', fullName: 'GPT-5 Mini' },
    'gpt-5.4': { label: 'GPT 5.4', fullName: 'GPT-5.4' },
    'gpt-5.5': { label: 'GPT 5.5', fullName: 'GPT-5.5' },
    'gpt-5.6-terra': { label: 'GPT 5.6 Terra', fullName: 'GPT-5.6 Terra' },
    'gpt-5.6-sol': { label: 'GPT 5.6 Sol', fullName: 'GPT-5.6 Sol' },
    'deepseek-v4-flash': {
        label: 'DeepSeek Flash',
        fullName: 'DeepSeek V4 Flash',
    },
    'deepseek-v4-pro': { label: 'DeepSeek Pro', fullName: 'DeepSeek V4 Pro' },
};

/** Falls back to the raw model id (for both label and fullName) when unmapped. */
export function getModelDisplay(id: ModelId): ModelDisplayInfo {
    return MODEL_DISPLAY_MAP[id] ?? { label: id, fullName: id };
}
