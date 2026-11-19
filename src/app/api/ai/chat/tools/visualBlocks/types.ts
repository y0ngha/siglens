import type { ChatVisualBlock } from '@/entities/chat-conversation/types';
import type { Locale } from '@/shared/i18n/locales';

/**
 * `show_chart` 빌더가 받는 실행 환경 — 도구 인자 밖에서 오는 값만 모았다.
 */
export interface VisualBuildEnv {
    locale: Locale;
    /** 회원은 계정 id, 게스트는 `guest:` 접두 주체(`portfolio`만 읽는다). */
    userId: string;
    /** `false`면 비공식 외부 소스(네이버 증권)를 읽지 않는다(`ToolRuntime.allowUnofficialSources`). */
    allowUnofficialSources: boolean;
    now: Date;
}

/** 블록과, 모델이 받을 같은 값의 요약(그림에 나온 수치를 인용할 근거). */
export interface VisualBuilt {
    block: ChatVisualBlock;
    summary: Record<string, unknown>;
}

/** 그릴 수 없을 때 모델에 가는 사유 — 그림은 내지 않는다. */
export interface VisualRefusal {
    error: 'no_data' | 'invalid_args' | 'login_required';
    reason: string;
}

export type VisualOutcome = VisualBuilt | VisualRefusal;

export const noData = (reason: string): VisualRefusal => ({
    error: 'no_data',
    reason,
});

export const isRefusal = (outcome: VisualOutcome): outcome is VisualRefusal =>
    'error' in outcome;
