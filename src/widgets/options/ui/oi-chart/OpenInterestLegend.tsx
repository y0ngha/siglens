'use client';

import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    CallOpenInterestTooltip,
    PutOpenInterestTooltip,
} from '../../utils/optionsTooltips';
import { StrikeChartLegend } from '../strike-chart/StrikeChartLegend';
import { StrikeLegendItem } from '../strike-chart/StrikeLegendItem';

interface OpenInterestLegendProps {
    /** Whether the dashed Max Pain guide is drawn; its legend entry follows. */
    showMaxPain: boolean;
}

/** Legend for the open-interest chart. */
export function OpenInterestLegend({ showMaxPain }: OpenInterestLegendProps) {
    const t = useTranslations('widgets.options');
    return (
        <StrikeChartLegend>
            <StrikeLegendItem swatch="call">
                Call OI
                <InfoTooltip>{CallOpenInterestTooltip}</InfoTooltip>
            </StrikeLegendItem>
            <StrikeLegendItem swatch="put">
                Put OI
                <InfoTooltip>{PutOpenInterestTooltip}</InfoTooltip>
            </StrikeLegendItem>
            {showMaxPain && (
                <StrikeLegendItem swatch="dashedLine">
                    Max Pain
                </StrikeLegendItem>
            )}
            <StrikeLegendItem swatch="solidLine">
                {t('OpenInterestChart.497d1e')}
            </StrikeLegendItem>
        </StrikeChartLegend>
    );
}
