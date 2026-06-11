import type { SMCResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

export interface SmcZoneLine {
    price: number;
    color: string;
    title: string;
}

/**
 * SMC premium/discount/equilibrium 존을 가격선 스펙으로 변환한다.
 * premium·discount는 high/low 밴드(2선, 대표 high선에만 title), equilibrium은 50% 공정가 1선.
 * null 존은 스킵 — 최대 5선.
 */
export function buildSmcZoneLines(smc: SMCResult | undefined): SmcZoneLine[] {
    if (!smc) return [];
    const lines: SmcZoneLine[] = [];
    const { premiumZone, discountZone, equilibriumZone } = smc;
    if (premiumZone) {
        lines.push({
            price: premiumZone.high,
            color: CHART_COLORS.smcPremium,
            title: 'Premium',
        });
        lines.push({
            price: premiumZone.low,
            color: CHART_COLORS.smcPremium,
            title: '',
        });
    }
    if (discountZone) {
        lines.push({
            price: discountZone.high,
            color: CHART_COLORS.smcDiscount,
            title: 'Discount',
        });
        lines.push({
            price: discountZone.low,
            color: CHART_COLORS.smcDiscount,
            title: '',
        });
    }
    if (equilibriumZone) {
        lines.push({
            price: (equilibriumZone.high + equilibriumZone.low) / 2,
            color: CHART_COLORS.smcEquilibrium,
            title: 'Equilibrium',
        });
    }
    return lines;
}
