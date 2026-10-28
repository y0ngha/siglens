/**
 * 영업현금흐름 표기 — 공시 보고 통화를 우선하고 없거나 잘못되면 상장 통화로 돌아간다.
 */
import type { FundamentalCashFlowInput } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatCompactCurrency,
    formatCompactInCurrency,
} from '@/shared/lib/priceFormat';
import { normalizeReportedCurrency } from '@/shared/lib/reportedCurrency';
import { MISSING_VALUE } from './displayConstants';

/**
 * 영업현금흐름을 축약 표기한다.
 *
 * ADR(TSM 등)은 상장 통화(USD)가 아니라 본국 통화(TWD)로 공시하므로, 상장 통화로 찍으면
 * 금액이 수십 배 틀린다. 보고 통화가 있고 유효한 ISO 코드면 그 통화로, 아니면 상장 통화로 표기한다.
 */
export function formatOperatingCashFlow(
    cashFlow: FundamentalCashFlowInput | null,
    symbol: string,
    locale: Locale
): string {
    const ocf = cashFlow?.operatingCashFlow ?? null;
    if (ocf === null) return MISSING_VALUE;

    const reported = normalizeReportedCurrency(cashFlow?.reportedCurrency);
    const inReported =
        reported === null
            ? null
            : formatCompactInCurrency(ocf, reported, locale);
    return inReported ?? formatCompactCurrency(ocf, symbol, locale);
}
