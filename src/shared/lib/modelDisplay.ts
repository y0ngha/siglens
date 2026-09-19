import type { ModelId } from '@y0ngha/siglens-core';

/**
 * Human-readable label + full name for an AI model, shown in the analysis
 * model dropdown (`widgets/analysis`'s `ModelSelector`). Extracted to `shared`
 * because it used to be duplicated by a second consumer (the now-removed
 * symbol chatbot's own model dropdown) — a shared, presentation-only lookup
 * table belongs in `shared` rather than being owned by either widget.
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
 * 세대가 V4.1 하나뿐이라 오독될 다른 세대가 없고, 접힌 트리거에서 `'Flash 3.6'`
 * 같은 Gemini 라벨과 구분되도록 provider 이름을 앞에 둔다. V4.1 외 세대가
 * 추가되면 그때 세대를 붙일 것.
 */
export const MODEL_DISPLAY_MAP: Partial<Record<ModelId, ModelDisplayInfo>> = {
    'gemini-3.5-flash-lite': {
        label: 'Flash Lite 3.5',
        fullName: 'Gemini 3.5 Flash Lite',
    },
    'gemini-3.6-flash': { label: 'Flash 3.6', fullName: 'Gemini 3.6 Flash' },
    'gemini-3.7-flash': { label: 'Flash 3.7', fullName: 'Gemini 3.7 Flash' },
    'gemini-3.8-flash': { label: 'Flash 3.8', fullName: 'Gemini 3.8 Flash' },
    'gemini-3.1-pro-preview': {
        label: 'Pro 3.1',
        fullName: 'Gemini 3.1 Pro Preview',
    },
    'claude-haiku-4-5': { label: 'Haiku 4.5', fullName: 'Claude Haiku 4.5' },
    'claude-sonnet-5': { label: 'Sonnet 5', fullName: 'Claude Sonnet 5' },
    'claude-opus-4-8': { label: 'Opus 4.8', fullName: 'Claude Opus 4.8' },
    'claude-opus-5': { label: 'Opus 5', fullName: 'Claude Opus 5' },
    'claude-fable-5-1': { label: 'Fable 5.1', fullName: 'Claude Fable 5.1' },
    'gpt-5.6-luna': { label: 'GPT 5.6 Luna', fullName: 'GPT-5.6 Luna' },
    'gpt-5.6-terra': { label: 'GPT 5.6 Terra', fullName: 'GPT-5.6 Terra' },
    'gpt-5.6-sol': { label: 'GPT 5.6 Sol', fullName: 'GPT-5.6 Sol' },
    'gpt-6-astra': { label: 'GPT 6 Astra', fullName: 'GPT-6 Astra' },
    'deepseek-v4.1-flash': {
        label: 'DeepSeek Flash',
        fullName: 'DeepSeek V4.1 Flash',
    },
    'deepseek-v4.1-pro': {
        label: 'DeepSeek Pro',
        fullName: 'DeepSeek V4.1 Pro',
    },
};

/** Falls back to the raw model id (for both label and fullName) when unmapped. */
export function getModelDisplay(id: ModelId): ModelDisplayInfo {
    return MODEL_DISPLAY_MAP[id] ?? { label: id, fullName: id };
}
