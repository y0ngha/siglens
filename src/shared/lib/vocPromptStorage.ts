import { MS_PER_DAY } from '@/shared/config/time';
import {
    LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
    LOCAL_STORAGE_VOC_PROMPTED_KEY,
} from '@/shared/lib/storageKeys';

/**
 * VOC 별점 모달을 **언제 물어도 되는가** — "써 보고 쓸모를 느낀 뒤"를 판정하는 이용 기록.
 *
 * 가입 넛지(`features/analysis-nudge`), 코치 마크(`features/watchlist`), VOC 호스트
 * (`features/voc-prompt`)가 함께 읽는 값이라 feature 사이 import를 만들지 않으려고 shared에 둔다.
 *
 * 규칙(사이트마다 `VOC_PROMPT_POLICY`의 숫자만 다르다):
 * 1. **이용 횟수가 `minUses` 이상이거나, 이용한 날이 `minActiveDays`일 이상**이면 물어볼 때다.
 *    한 번 본 것은 "써 봤다"일 뿐이고, 여러 번 쓰거나 다른 날 다시 온 것이 "쓸모를 느꼈다"다.
 * 2. 별점을 보내면 다시 묻지 않는다.
 * 3. 닫기만 했으면 `VOC_PROMPT_COOLDOWN_MS` 뒤에, 그 사이 1번 조건을 **다시** 채운 방문자에게만
 *    또 묻는다. 모두 합쳐 `VOC_PROMPT_MAX_PROMPTS`번까지다.
 *
 * 저장소가 막혀 있으면(사파리 개인 정보 보호 등) 묻지 않는다. 기록을 못 남기는데 물으면 모달이
 * 매 방문 뜬다.
 */
export type VocPromptSurface = 'analysis' | 'agent_chat';

interface VocPromptPolicy {
    /** 이만큼 쓰면 묻는다. `analysis`는 서로 다른 종목 수, `agent_chat`은 끝난 답변 수. */
    readonly minUses: number;
    /** 서로 다른 날 이만큼 쓰면 묻는다(방문자 현지 날짜). */
    readonly minActiveDays: number;
}

export const VOC_PROMPT_POLICY: Record<VocPromptSurface, VocPromptPolicy> = {
    // 종목 페이지는 저장된 분석을 첫 페인트에 그리므로 검색 유입 한 번도 "분석 1회"다. 종목 셋을
    // 봤거나 다른 날 다시 와서 분석을 본 방문자만 이 서비스를 쓰는 사람으로 친다.
    analysis: { minUses: 3, minActiveDays: 2 },
    // 답변 하나는 시험 삼아 던진 질문일 수 있다. 세 번 주고받았거나 다른 날 다시 와서 물은 사람.
    agent_chat: { minUses: 3, minActiveDays: 2 },
};

/** 닫기만 한 방문자에게 다시 묻기까지의 간격. */
export const VOC_PROMPT_COOLDOWN_MS = 14 * MS_PER_DAY;

/** 별점을 안 남긴 방문자에게 묻는 횟수의 상한(첫 번째 포함). */
export const VOC_PROMPT_MAX_PROMPTS = 3;

interface VocPromptState {
    /** 마지막으로 물은 뒤의 이용 횟수. */
    readonly uses: number;
    /** `uses`에 이미 센 중복 제거 키(종목 코드). `minUses`개까지만 둔다. */
    readonly seen: readonly string[];
    /** 마지막으로 물은 뒤 이용한 날(`YYYY-MM-DD`, 현지). `minActiveDays`개까지만 둔다. */
    readonly days: readonly string[];
    readonly promptCount: number;
    /** 마지막으로 물은 시각(epoch ms). 물은 적이 없거나 시각을 모르면 0. */
    readonly lastPromptedAt: number;
    readonly submitted: boolean;
}

const INITIAL_STATE: VocPromptState = {
    uses: 0,
    seen: [],
    days: [],
    promptCount: 0,
    lastPromptedAt: 0,
    submitted: false,
};

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function parseState(raw: string): VocPromptState | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { uses, seen, days, promptCount, lastPromptedAt, submitted } =
        parsed as Record<string, unknown>;
    if (
        typeof uses !== 'number' ||
        !isStringArray(seen) ||
        !isStringArray(days) ||
        typeof promptCount !== 'number' ||
        typeof lastPromptedAt !== 'number' ||
        typeof submitted !== 'boolean'
    ) {
        return null;
    }
    return { uses, seen, days, promptCount, lastPromptedAt, submitted };
}

/**
 * 저장된 상태. 저장소가 막혀 있으면 `null`.
 *
 * 새 기록이 없고 예전 키(`'1'` = "첫 이용 직후 한 번 띄웠다")만 있으면 한 번 물은 것으로 이어받는다.
 * 그때는 쓸모를 느끼기 전에 물었으므로 간격 없이, 이용 조건을 채우면 다시 묻는다.
 */
function loadState(): VocPromptState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_VOC_PROMPT_STATE_KEY);
        if (raw !== null) return parseState(raw) ?? INITIAL_STATE;
        return localStorage.getItem(LOCAL_STORAGE_VOC_PROMPTED_KEY) === '1'
            ? { ...INITIAL_STATE, promptCount: 1 }
            : INITIAL_STATE;
    } catch {
        return null;
    }
}

/** 저장에 성공했는가. 실패하면 호출부는 모달을 열지 않는다(기록 없이 열면 매번 뜬다). */
function saveState(state: VocPromptState): boolean {
    try {
        localStorage.setItem(
            LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
            JSON.stringify(state)
        );
        return true;
    } catch {
        return false;
    }
}

/** 방문자 현지 달력 날짜. "다른 날 다시 왔다"는 방문자의 하루를 기준으로 한다. */
function localDateKey(now: number): string {
    const date = new Date(now);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/** 이용 한 번을 더한 상태. 같은 `key`(종목)와 같은 날은 다시 세지 않는다. */
function withUse(
    state: VocPromptState,
    policy: VocPromptPolicy,
    key: string | undefined,
    now: number
): VocPromptState {
    const today = localDateKey(now);
    const days =
        state.days.includes(today) || state.days.length >= policy.minActiveDays
            ? state.days
            : [...state.days, today];
    if (key !== undefined && state.seen.includes(key)) {
        return { ...state, days };
    }
    const seen =
        key === undefined || state.seen.length >= policy.minUses
            ? state.seen
            : [...state.seen, key];
    return { ...state, uses: state.uses + 1, seen, days };
}

function isRetired(state: VocPromptState): boolean {
    return state.submitted || state.promptCount >= VOC_PROMPT_MAX_PROMPTS;
}

function isDue(
    state: VocPromptState,
    policy: VocPromptPolicy,
    now: number
): boolean {
    if (isRetired(state)) return false;
    if (
        state.promptCount > 0 &&
        now - state.lastPromptedAt < VOC_PROMPT_COOLDOWN_MS
    ) {
        return false;
    }
    return (
        state.uses >= policy.minUses ||
        state.days.length >= policy.minActiveDays
    );
}

/** 더는 물을 일이 없는가(별점을 보냈거나 상한을 채웠거나 저장소가 막혔다). */
export function isVocPromptRetired(): boolean {
    const state = loadState();
    return state === null || isRetired(state);
}

/**
 * 이번 이용(`key`)까지 세면 물어볼 때인가. **기록하지 않는다.**
 *
 * 같은 신호를 받는 다른 넛지가 양보할지 정할 때 쓴다. 같은 종목·같은 날은 다시 세지 않으므로 VOC
 * 호스트가 이 이용을 먼저 기록했든 아직이든 답이 같다 - 구독 순서와 무관하다. 호스트가 이미
 * "물었다"고 적은 뒤에는 false지만, 그때는 호스트가 세션 넛지 플래그를 선점해 둔 상태다.
 */
export function isVocPromptDue(
    surface: VocPromptSurface,
    key?: string,
    now: number = Date.now()
): boolean {
    const state = loadState();
    if (state === null) return false;
    const policy = VOC_PROMPT_POLICY[surface];
    return isDue(withUse(state, policy, key, now), policy, now);
}

/** 이용 한 번을 기록하고, 이제 물어볼 때인지 돌려준다. 기록에 실패하면 false. */
export function recordVocUse(
    surface: VocPromptSurface,
    key?: string,
    now: number = Date.now()
): boolean {
    const state = loadState();
    if (state === null || isRetired(state)) return false;
    const policy = VOC_PROMPT_POLICY[surface];
    const next = withUse(state, policy, key, now);
    return saveState(next) && isDue(next, policy, now);
}

/**
 * 물어보기로 한 순간 부른다. 이용 기록을 비워, 다음에 물으려면 조건을 다시 채워야 한다.
 * 기록에 실패하면 false - 호출부는 모달을 열지 않는다.
 */
export function markVocPrompted(now: number = Date.now()): boolean {
    const state = loadState();
    if (state === null) return false;
    return saveState({
        ...INITIAL_STATE,
        promptCount: state.promptCount + 1,
        lastPromptedAt: now,
        submitted: state.submitted,
    });
}

/** 별점을 보냈다. 다시 묻지 않는다. */
export function markVocSubmitted(): void {
    const state = loadState();
    if (state === null) return;
    saveState({ ...state, submitted: true });
}
