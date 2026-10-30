'use client';

/**
 * "N개 스킬 감지 · M종 인디케이터 적용" 한 줄 요약.
 */
import { useTranslations } from 'next-intl';

interface AnalysisStatsLineProps {
    /**
     * 감지된 스킬 수. `null`이면 개수 세그먼트를 숨긴다 — 잠긴 티어는 스킬이 그룹당
     * 소수만 샘플돼 0일 수 있어 오해를 준다(가입 안내는 업셀 카드가 맡는다).
     */
    detectedSkillCount: number | null;
    indicatorCount: number;
}

export function AnalysisStatsLine({
    detectedSkillCount,
    indicatorCount,
}: AnalysisStatsLineProps) {
    const t = useTranslations('widgets.analysis');
    return (
        // 문장이 `개 스킬 감지 · 39종 인디케이터 적용`처럼 한글이 대부분이라 모노를 쓸 수
        // 없다 — Geist Mono에 한글 글리프가 없어 OS 폰트로 조용히 폴백한다. 숫자 폭만
        // 고정하면 되므로 tabular 숫자로 바꾼다.
        <p className="text-xs text-secondary-500 tabular-nums">
            {detectedSkillCount !== null &&
                t('AnalysisPanel.c80f22', { v0: detectedSkillCount })}
            {t('AnalysisPanel.911acb', { v0: indicatorCount })}
        </p>
    );
}
