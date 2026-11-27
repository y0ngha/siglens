'use client';

import type {
    KrxTickTable,
    PatternResult,
    Timeframe,
} from '@y0ngha/siglens-core';
/**
 * 패턴 섹션 — 감지된 패턴 카드 목록. 없으면 "감지된 패턴 없음" 문구를 보인다.
 */
import { useTranslations } from 'next-intl';
import {
    isTargetReferenceOnly,
    resolvePatternBaseRate,
} from '@/shared/lib/patternBaseRate';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import type { OverlayCardControls } from '../model/types';
import { PatternAccordionItem } from '../ui/PatternAccordionItem';

interface PatternsSectionProps {
    detectedPatterns: PatternResult[];
    timeframe: Timeframe;
    /** 차트 작도가 있는 결과 id 집합 — 여기 속한 카드만 작도 토글을 받는다. */
    overlaySourceRefs: ReadonlySet<string>;
    overlayControls: OverlayCardControls | undefined;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function PatternsSection({
    detectedPatterns,
    timeframe,
    overlaySourceRefs,
    overlayControls,
    symbol,
    krxTickTable,
}: PatternsSectionProps) {
    const t = useTranslations('widgets.analysis');
    const tBaseRate = useTranslations('widgets.analysis.baseRate');
    // 차트에 "참고 거리"로 흐리게 그려진 목표선이 있을 때만 그 뜻을 한 번 풀어 준다.
    const hasReferenceLine = detectedPatterns.some(
        pattern =>
            overlaySourceRefs.has(pattern.id) &&
            isTargetReferenceOnly(resolvePatternBaseRate(pattern, timeframe))
    );
    return (
        <div className="flex flex-col gap-2">
            <span className={LABEL_KO}>{t('AnalysisPanel.bdeea2')}</span>
            {detectedPatterns.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    {detectedPatterns.map(pattern => (
                        <PatternAccordionItem
                            key={pattern.id}
                            pattern={pattern}
                            symbol={symbol}
                            krxTickTable={krxTickTable}
                            timeframe={timeframe}
                            overlay={
                                overlaySourceRefs.has(pattern.id)
                                    ? overlayControls
                                    : undefined
                            }
                        />
                    ))}
                    {hasReferenceLine && (
                        <p className="text-xs text-secondary-500">
                            {tBaseRate('targetLegend')}
                        </p>
                    )}
                </div>
            ) : (
                <p className="text-xs text-secondary-500">
                    {t('AnalysisPanel.8d481f')}
                </p>
            )}
        </div>
    );
}
