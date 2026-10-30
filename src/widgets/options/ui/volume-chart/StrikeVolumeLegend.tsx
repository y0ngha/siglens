'use client';

import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    CallVolumeTooltip,
    PutVolumeTooltip,
} from '../../utils/optionsTooltips';
import { StrikeChartLegend } from '../strike-chart/StrikeChartLegend';
import { StrikeLegendItem } from '../strike-chart/StrikeLegendItem';

/** Legend for the strike volume chart (no Max Pain: that is an OI concept). */
export function StrikeVolumeLegend() {
    const t = useTranslations('widgets.options');
    return (
        <StrikeChartLegend>
            <StrikeLegendItem swatch="call">
                Call Vol
                <InfoTooltip>{CallVolumeTooltip}</InfoTooltip>
            </StrikeLegendItem>
            <StrikeLegendItem swatch="put">
                Put Vol
                <InfoTooltip>{PutVolumeTooltip}</InfoTooltip>
            </StrikeLegendItem>
            <StrikeLegendItem swatch="solidLine">
                {t('StrikeVolumeChart.497d1e')}
            </StrikeLegendItem>
        </StrikeChartLegend>
    );
}
