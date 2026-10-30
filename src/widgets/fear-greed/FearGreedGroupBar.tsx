import { useTranslations } from 'next-intl';
import type { FearGreedGroup } from '@y0ngha/siglens-core';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FearGreedScoreBar } from '@/shared/ui/FearGreedScoreBar';
import { FearGreedFactorRow } from './ui/group/FearGreedFactorRow';

interface FearGreedGroupBarProps {
    group: FearGreedGroup;
    /**
     * 스냅샷의 표시용 200일선 이격(퍼센트). 있으면 `ma200_distance` 행이 차트·분석과 같은
     * 숫자를 보여 준다(`formatFactorRaw` JSDoc).
     */
    ma200DistancePct?: number | null;
}

/** 그룹(수급/추세) 한 개의 점수 막대와 요인별 원값·백분위 목록. */
export function FearGreedGroupBar({
    group,
    ma200DistancePct,
}: FearGreedGroupBarProps) {
    const t = useTranslations('widgets.fear-greed');
    const score = Math.round(group.score);
    // core의 그룹 이름('Flow'/'Trend')은 식별자일 뿐 화면 문구가 아니다 — 그대로 찍으면
    // 한국어 화면에 "Flow Group"이 박힌다. 번역자 호출이 리터럴이어야 추출기가 키를 싣는다.
    const groupName =
        group.name === 'Flow'
            ? t('FearGreedGroupBar.groupNameFlow')
            : t('FearGreedGroupBar.groupNameTrend');

    return (
        <section className="flex flex-col gap-2 rounded bg-secondary-800/40 p-3">
            <header className="flex items-center justify-between">
                <h3 className={HEADING_SUBSECTION}>
                    {t('FearGreedGroupBar.groupTitle', { v0: groupName })}
                </h3>
                <span className="font-mono text-sm text-secondary-100">
                    {score} / 100
                </span>
            </header>
            <FearGreedScoreBar
                value={score}
                label={t('FearGreedGroupBar.groupScore', {
                    v0: groupName,
                    v1: score,
                })}
            />
            <ul className="flex flex-col gap-1 text-xs text-secondary-400">
                {group.factors.map(factor => (
                    <FearGreedFactorRow
                        key={factor.key}
                        factor={factor}
                        ma200DistancePct={ma200DistancePct}
                    />
                ))}
            </ul>
        </section>
    );
}
