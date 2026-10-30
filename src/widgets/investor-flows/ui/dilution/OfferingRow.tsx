/**
 * 증자·희석 공시 한 줄 — 종류 배지·양식·신고일·SEC 원문 링크.
 */
import { useTranslations } from 'next-intl';
import type { OfferingFiling, OfferingKind } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { OFFERING_TONE, type OfferingTone } from '../../utils/secFilings';
import { FilingLink } from '../filings/FilingLink';

/** 실제로 주식을 파는 공시는 경고 톤, 등록·사모·설명서는 중립 톤이다. 종류는 글자로도 적는다. */
const TONE_CLASS: Record<OfferingTone, string> = {
    issuance: 'bg-ui-warning/10 text-ui-warning-text',
    neutral: 'bg-secondary-700 text-secondary-300',
};

/** 증자·희석 공시 한 줄. */
export function OfferingRow({ filing }: { readonly filing: OfferingFiling }) {
    const t = useTranslations('widgets.investor-flows');
    // 리터럴 번역 호출로 만들어 두고 종류로 고른다(추출기가 키를 볼 수 있게).
    const kindLabels: Record<OfferingKind, string> = {
        atm: t('dilution.kind.atm'),
        underwritten: t('dilution.kind.underwritten'),
        best_efforts: t('dilution.kind.bestEfforts'),
        shelf: t('dilution.kind.shelf'),
        registration: t('dilution.kind.registration'),
        private_placement: t('dilution.kind.privatePlacement'),
        prospectus: t('dilution.kind.prospectus'),
        other: t('dilution.kind.other'),
    };
    return (
        <li
            className={cn(
                SURFACE_NESTED,
                'flex flex-wrap items-center justify-between gap-2 p-3'
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        TONE_CLASS[OFFERING_TONE[filing.kind]]
                    )}
                >
                    {kindLabels[filing.kind]}
                </span>
                <span className="font-mono text-xs text-secondary-200">
                    {filing.form}
                </span>
                <span className="font-mono text-xs text-secondary-300 tabular-nums">
                    {filing.filingDate}
                </span>
            </div>
            <FilingLink
                url={filing.url}
                label={t('dilution.filing')}
                accessibleName={t('dilution.filingLabel', {
                    form: filing.form,
                    date: filing.filingDate,
                })}
            />
        </li>
    );
}
