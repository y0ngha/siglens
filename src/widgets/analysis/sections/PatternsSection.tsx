'use client';

/**
 * 패턴 섹션 — 감지된 패턴 카드 목록. 없으면 "감지된 패턴 없음" 문구를 보인다.
 */
import { useTranslations } from 'next-intl';
import type { KrxTickTable, PatternResult } from '@y0ngha/siglens-core';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import type { OverlayCardControls } from '../model/types';
import { PatternAccordionItem } from '../ui/PatternAccordionItem';

interface PatternsSectionProps {
    detectedPatterns: PatternResult[];
    showConfidence: boolean;
    /** 차트 작도가 있는 결과 id 집합 — 여기 속한 카드만 작도 토글을 받는다. */
    overlaySourceRefs: ReadonlySet<string>;
    overlayControls: OverlayCardControls | undefined;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function PatternsSection({
    detectedPatterns,
    showConfidence,
    overlaySourceRefs,
    overlayControls,
    symbol,
    krxTickTable,
}: PatternsSectionProps) {
    const t = useTranslations('widgets.analysis');
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
                            showConfidence={showConfidence}
                            overlay={
                                overlaySourceRefs.has(pattern.id)
                                    ? overlayControls
                                    : undefined
                            }
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-secondary-500">
                    {t('AnalysisPanel.8d481f')}
                </p>
            )}
        </div>
    );
}
