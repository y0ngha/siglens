/**
 * 증자·희석 공시 섹션.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsWindow, OfferingFiling } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { DILUTION_HEADING_ID } from '../utils/sectionAnchors';
import { buildOfferingRows, offeringKey } from '../utils/secFilings';
import { OfferingRow } from '../ui/dilution/OfferingRow';
import { OmittedNote } from '../ui/notes/OmittedNote';
import { CollectingNotice } from './CollectingNotice';

interface DilutionSectionProps {
    /** `undefined` = 이 원천이 스냅샷에 없다(조회 실패). */
    readonly filings: readonly OfferingFiling[] | undefined;
    /** 점수(희석 축)를 매긴 창 — core `freshness.dilutionWindow`. */
    readonly scoringWindow: InvestorFlowsWindow;
    /** 공시 수집이 최근까지 따라잡지 못했다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
}

/** 수집 중 → 조회 불가 → 공시 없음 → 목록 순으로 첫 해당 분기만 그린다. */
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
                <OmittedNote>
                    {t('dilution.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </OmittedNote>
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
            aria-labelledby={DILUTION_HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <div>
                {/* 차트 화면 희석 배지가 이 제목으로 점프한다(`#flows-dilution-heading`). sticky 사이트 헤더
                    (`--header-h` 3.5rem)와 카드 윗여백(p-6 = 1.5rem)을 넘겨 카드 위 테두리까지 보이게 띄운다
                    — 앵커 제목의 사이트 관례(`scroll-mt-24`, 가이드·방법론 페이지)와 같은 값이다. */}
                <h2
                    id={DILUTION_HEADING_ID}
                    className={cn(HEADING_SECTION, 'scroll-mt-24')}
                >
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
