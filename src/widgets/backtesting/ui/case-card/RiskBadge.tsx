import { useTranslations } from 'next-intl';
import type { BacktestRiskLevel } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

interface RiskBadgeProps {
    level: BacktestRiskLevel;
}

const WARNING_TONE =
    'bg-ui-warning/10 text-ui-warning-text border-ui-warning/30';
const SUCCESS_TONE =
    'bg-ui-success/10 text-ui-success-text border-ui-success/30';
const NEUTRAL_TONE = 'bg-secondary-800 text-secondary-400 border-secondary-700';

/**
 * 위험도 → `shared.enumLabel.backtestRiskLevel` 키와 배색. 원문 enum(`HIGH`)을 그대로
 * 찍지 않고 라벨로 푼다. 데이터의 별칭(`medium`)은 entity 검증이 `moderate`로 정규화한다.
 */
const RISK_BADGE: Record<
    BacktestRiskLevel,
    { labelKey: string; toneClass: string }
> = {
    low: { labelKey: 'backtestRiskLevel.low', toneClass: SUCCESS_TONE },
    moderate: {
        labelKey: 'backtestRiskLevel.moderate',
        toneClass: NEUTRAL_TONE,
    },
    high: { labelKey: 'backtestRiskLevel.high', toneClass: WARNING_TONE },
    extreme: { labelKey: 'backtestRiskLevel.extreme', toneClass: WARNING_TONE },
};

/** AI 위험도 배지. */
export function RiskBadge({ level }: RiskBadgeProps) {
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는 패턴"만 본다 —
    // 번역자 호출에 조회 결과를 직접 넘겨야 `shared.enumLabel`이 이 라우트의 클라이언트
    // 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    const { labelKey, toneClass } = RISK_BADGE[level];
    return (
        <span
            className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-semibold',
                toneClass
            )}
        >
            {tLabel(labelKey)}
        </span>
    );
}
