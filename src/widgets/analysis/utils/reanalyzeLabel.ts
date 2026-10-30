/**
 * 재분석 버튼 상태 판정 — 분석 중 / 쿨다운 / 대기 중 하나를 고르고 카운트다운을 표기한다.
 * 번역은 버튼 컴포넌트가 리터럴 키로 한다(extract.mjs가 키를 정적으로 수집하도록).
 */
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';

export type ReanalyzeLabelKind = 'analyzing' | 'cooldown' | 'idle';

/** 남은 쿨다운(ms)을 `m:ss` 카운트다운 표기로 만든다(초 단위 올림). */
export function formatCooldown(ms: number): string {
    const totalSec = Math.ceil(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
    const seconds = totalSec % SECONDS_PER_MINUTE;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** 재분석 버튼 문구의 종류. 분석 중이 쿨다운보다 우선한다. */
export function selectReanalyzeLabelKind(
    isAnalyzing: boolean,
    cooldownMs: number
): ReanalyzeLabelKind {
    if (isAnalyzing) return 'analyzing';
    if (cooldownMs > 0) return 'cooldown';
    return 'idle';
}
