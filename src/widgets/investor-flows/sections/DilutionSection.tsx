import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsWindow,
    OfferingFiling,
    OfferingKind,
} from '@y0ngha/siglens-core';
import { FLOWS_DILUTION_SECTION_ID } from '@/entities/investor-flows/lib/flowsAnchors';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import {
    buildOfferingRows,
    OFFERING_TONE,
    offeringKey,
    type OfferingTone,
} from '../utils/secFilings';
import { CollectingNotice } from './CollectingNotice';

const HEADING_ID = FLOWS_DILUTION_SECTION_ID;

const TONE_CLASS: Record<OfferingTone, string> = {
    issuance: 'bg-ui-warning/10 text-ui-warning-text',
    neutral: 'bg-secondary-700 text-secondary-300',
};

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

function OfferingRow({ filing }: { readonly filing: OfferingFiling }) {
    const t = useTranslations('widgets.investor-flows');
    // 리터럴 `t()` 호출로 만들어 두고 종류로 고른다(추출기가 키를 볼 수 있게).
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
    const href = toSafeHttpUrl(filing.url);
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
            {href !== null && (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                >
                    {t('dilution.filing')}
                </a>
            )}
        </li>
    );
}

interface DilutionSectionProps {
    /** `undefined` = 이 원천이 스냅샷에 없다(조회 실패). */
    readonly filings: readonly OfferingFiling[] | undefined;
    /** 점수(희석 축)를 매긴 창 — core `freshness.dilutionWindow`. */
    readonly scoringWindow: InvestorFlowsWindow;
    /** 공시 수집이 최근까지 따라잡지 못했다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
}

function DilutionBody({ filings, collecting }: DilutionSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="filings" />;
    if (filings === undefined) {
        return (
            <p className="text-sm text-secondary-300">
                {t('dilution.unavailable')}
            </p>
        );
    }
    const { rows, omittedCount } = buildOfferingRows(filings);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">{t('dilution.none')}</p>
        );
    }
    return (
        <>
            <ul className="grid gap-2 md:grid-cols-2">
                {rows.map(filing => (
                    <OfferingRow key={offeringKey(filing)} filing={filing} />
                ))}
            </ul>
            {omittedCount > 0 && (
                <p className="text-xs text-secondary-400">
                    {t('dilution.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </p>
            )}
        </>
    );
}

/**
 * 증자·희석 공시 섹션 — 회사가 새 주식을 팔 수 있게 낸 SEC 공시(선반 등록·증권 등록·ATM·인수 공모·사모 Form D 등). 종류 배지,
 * 양식, 신고일, SEC 원문 링크. 실제로 주식을 파는 공시(ATM·인수·모집 주선)는 경고 톤, 나머지는 중립 톤이고 종류는 글자로도
 * 적는다. 점수(희석 축)는 최근 창(`freshness.dilutionWindow`)의 공시로 매긴다는 점을 밝힌다. 출처는 SEC EDGAR.
 */
export function DilutionSection(props: DilutionSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { scoringWindow } = props;
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('dilution.title')}
                    <FlowTooltip term="dilution" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('dilution.subtitle')}
                </p>
                {scoringWindow.from !== null && scoringWindow.to !== null && (
                    <p className="mt-1 text-xs text-secondary-400">
                        {t('dilution.window', {
                            days: formatInteger(scoringWindow.days, locale),
                            from: scoringWindow.from,
                            to: scoringWindow.to,
                        })}
                    </p>
                )}
            </div>
            <DilutionBody {...props} />
            <p className="text-xs text-secondary-400">{t('dilution.source')}</p>
        </section>
    );
}
