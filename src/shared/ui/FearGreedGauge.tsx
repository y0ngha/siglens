import { useTranslations } from 'next-intl';
import {
    FEAR_GREED_LABEL_CUTOFFS,
    type FearGreedLabel,
} from '@y0ngha/siglens-core';
import type { SnapshotConfidence } from '@/shared/lib/types';
import { SENTIMENT_LABEL_KEY } from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    GAUGE_CX,
    GAUGE_CY,
    GAUGE_STROKE_WIDTH,
    GAUGE_VIEWBOX_H,
    GAUGE_VIEWBOX_W,
    NEEDLE_PIVOT_RADIUS,
    NEEDLE_POINTS,
    TICK_VALUES,
    describeSegmentArc,
    needleRotationDeg,
    tickLabelPosition,
    tickTextAnchor,
} from '@/shared/ui/utils/fearGreedGaugeGeometry';

const { EXTREME_FEAR_MAX, FEAR_MAX, NEUTRAL_MAX, GREED_MAX } =
    FEAR_GREED_LABEL_CUTOFFS;

/** Visual variant — Hero is the focal stack; mini is for comparison tiles. */
type FearGreedGaugeSize = 'hero' | 'mini';

interface FearGreedGaugeProps {
    score: number;
    label: FearGreedLabel;
    size: FearGreedGaugeSize;
    /** Optional period label rendered under the score (e.g. "1주", "1개월"). Mini only. */
    periodLabel?: string;
    /** Confidence level for the snapshot. Hero only — renders a badge next to the sentiment label. */
    confidence?: SnapshotConfidence;
}

interface SegmentDef {
    from: number;
    to: number;
    /** Tailwind text-color class applied via stroke="currentColor". */
    strokeClass: string;
}

/**
 * 5-segment palette mapped to design-system semantic tokens (see src/app/globals.css):
 *   EXTREME_FEAR  → text-ui-danger-text
 *   FEAR          → text-ui-warning-text
 *   NEUTRAL       → text-secondary-400
 *   GREED         → text-ui-success-text/85   — 아래 SEGMENTS 주석 참조
 *   EXTREME_GREED → text-ui-success-text
 *
 * 토큰 뒤의 실제 hex는 적지 않는다. 테마마다 다르고 리디자인에서 값이 바뀌는데,
 * 주석에 박아 두면 조용히 낡아 이 목록이 실제로 `/60`·`#94a3b8`을 가리킨 채
 * 남아 있었다.
 *
 * NEVER use raw Tailwind palette (e.g. yellow-500, red-400).
 * SelfNormWarningBadge와 FearGreedHeaderChip에서도 동일한 시맨틱 토큰을 사용한다.
 */
const SEGMENTS: ReadonlyArray<SegmentDef> = [
    { from: 0, to: EXTREME_FEAR_MAX, strokeClass: 'text-ui-danger-text' },
    {
        from: EXTREME_FEAR_MAX,
        to: FEAR_MAX,
        strokeClass: 'text-ui-warning-text',
    },
    { from: FEAR_MAX, to: NEUTRAL_MAX, strokeClass: 'text-secondary-400' },
    /* `/60`은 라이트에서 페이지 배경 대비 2.35:1로 3:1에 못 미쳤다(실측).
       알파를 아예 빼면 EXTREME_GREED와 같은 값이 되어 두 밴드가 하나로 합쳐진다.
       `/85`는 `FearGreedScoreBar`의 `BAR_FILL_COLOR.GREED`와 같은 값이고, 요인 막대에서 다크 4.22 ·
       라이트 3.30으로 이미 검증됐다. */
    {
        from: NEUTRAL_MAX,
        to: GREED_MAX,
        strokeClass: 'text-ui-success-text/85',
    },
    { from: GREED_MAX, to: 100, strokeClass: 'text-ui-success-text' },
];

/** Sentiment-label → focal-stack text color (semantic tokens only). */
const SENTIMENT_TEXT_COLOR: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'text-ui-danger-text',
    FEAR: 'text-ui-warning-text',
    NEUTRAL: 'text-secondary-300',
    /* 알파 없이 전체 값을 쓴다. 이 라벨은 아크와 달리 **단어 자체가**
       밴드를 말하므로(`탐욕` 대 `극단적 탐욕`) 색으로 둘을 갈라 둘 이유가 없다.
       `/80`은 라이트에서 3.24:1로 AA(4.5)에 못 미쳤다(실측). */
    GREED: 'text-ui-success-text',
    EXTREME_GREED: 'text-ui-success-text',
};

/**
 * `sentimentText`는 호출부(컴포넌트 본문)가 이미 `tLabel(SENTIMENT_LABEL_KEY[...])`로
 * 조회해 넘긴 문자열이다 — 이 헬퍼가 번역자를 직접 받지 않는 이유는
 * `scripts/i18n/extract.mjs`의 동적 키 탐지가 "그 파일 안에서 번역자를 직접
 * 호출하는 패턴"만 보기 때문이다. 번역자를 여기로 다시 전달해 이 함수 안에서
 * 호출하면(2단계 전달) 그 호출이 감지되지 않아 `shared.enumLabel`이
 * `messages/_meta/clientKeys.json`의 이 라우트 항목에서 빠진다.
 */
function buildAriaLabel(
    score: number,
    sentimentText: string,
    isHero: boolean,
    t: (key: string, values?: Record<string, string | number>) => string,
    periodLabel?: string
): string {
    if (isHero) {
        return t('ariaScore', { v0: score, v1: sentimentText });
    }
    if (periodLabel) {
        return t('ariaScoreWithPeriod', {
            v0: periodLabel,
            v1: score,
            v2: sentimentText,
        });
    }
    return t('ariaScoreOnly', { v0: score });
}

/**
 * Badge-specific labels intentionally differ from `fearGreedLabels.ts` footer constants:
 * - Footer uses "정상 산출" (fits "표본 N — 정상 산출" phrasing).
 * - Badge uses "신뢰도 정상" / "신뢰도 제한" (standalone status label, needs explicit "신뢰도" prefix).
 */
const CONFIDENCE_BADGE_CONFIG: Record<
    SnapshotConfidence,
    { className: string; labelKey: string; tooltipKeys: readonly string[] }
> = {
    normal: {
        className:
            'bg-ui-success/10 text-ui-success-text border-ui-success/30 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        labelKey: 'confidenceNormal',
        tooltipKeys: ['confidenceNormalNote', 'indicatorStable'],
    },
    limited: {
        className:
            'bg-ui-warning/10 text-ui-warning-text border-ui-warning/30 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        labelKey: 'confidenceLimited',
        tooltipKeys: ['confidenceLimitedNote', 'confidenceLimitedRecovery'],
    },
};

/**
 * Shared semicircle gauge primitive. 0=left/EXTREME_FEAR, 100=right/EXTREME_GREED.
 *
 * - `size='hero'`: full focal stack (large score + sentiment word + "/ 100"), tick labels rendered.
 * - `size='mini'`: compact variant for comparison tiles (small score + period label, no ticks/sentiment).
 */
export function FearGreedGauge({
    score,
    label,
    size,
    periodLabel,
    confidence,
}: FearGreedGaugeProps) {
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 컴포넌트가 닿는 라우트의 클라이언트
    // 번들에 실린다(fearGreedLabels.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    const sentimentText = tLabel(SENTIMENT_LABEL_KEY[label]);
    const rotateDeg = needleRotationDeg(score);

    const tGauge = useTranslations('widgets.fear-greed.gauge');
    const isHero = size === 'hero';
    const ariaLabel = buildAriaLabel(
        score,
        sentimentText,
        isHero,
        tGauge,
        periodLabel
    );
    const badgeConfig =
        isHero && confidence ? CONFIDENCE_BADGE_CONFIG[confidence] : null;

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className={cn(
                    'w-full',
                    isHero ? 'max-w-[420px]' : 'max-w-[120px]'
                )}
                role="img"
                aria-label={ariaLabel}
            >
                {SEGMENTS.map(seg => (
                    <path
                        key={seg.from}
                        d={describeSegmentArc(seg.from, seg.to)}
                        strokeWidth={GAUGE_STROKE_WIDTH}
                        fill="none"
                        stroke="currentColor"
                        className={seg.strokeClass}
                    />
                ))}
                {isHero &&
                    TICK_VALUES.map(value => {
                        const { x, y } = tickLabelPosition(value);
                        return (
                            <text
                                key={value}
                                x={x}
                                y={y}
                                textAnchor={tickTextAnchor(value)}
                                dominantBaseline="middle"
                                className="fill-current text-[10px] font-medium text-secondary-400 tabular-nums"
                            >
                                {value}
                            </text>
                        );
                    })}
                <g transform={`rotate(${rotateDeg} ${GAUGE_CX} ${GAUGE_CY})`}>
                    <polygon
                        points={NEEDLE_POINTS}
                        className="fill-secondary-100"
                    />
                </g>
                <circle
                    cx={GAUGE_CX}
                    cy={GAUGE_CY}
                    r={NEEDLE_PIVOT_RADIUS}
                    className="fill-secondary-100"
                />
            </svg>
            <div className="text-center">
                {isHero ? (
                    <>
                        <div className="flex items-baseline justify-center gap-1.5">
                            <span className="text-5xl font-bold text-secondary-100 tabular-nums">
                                {score}
                            </span>
                            <span className="text-xs text-secondary-400">
                                / 100
                            </span>
                        </div>
                        <div
                            className={cn(
                                'text-2xl font-semibold tracking-tight',
                                SENTIMENT_TEXT_COLOR[label]
                            )}
                        >
                            {sentimentText}
                        </div>
                        {badgeConfig && (
                            <div className="mt-1 flex items-center justify-center">
                                <span className={badgeConfig.className}>
                                    {tGauge(badgeConfig.labelKey)}
                                </span>
                                <InfoTooltip>
                                    <div className="text-secondary-300">
                                        {badgeConfig.tooltipKeys.map(key => (
                                            <p key={key}>{tGauge(key)}</p>
                                        ))}
                                    </div>
                                </InfoTooltip>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="text-xl font-semibold text-secondary-100 tabular-nums">
                            {score}
                        </div>
                        {periodLabel ? (
                            <div className="text-[10px] text-secondary-400">
                                {periodLabel}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
