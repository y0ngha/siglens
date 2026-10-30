/** Disclosure link cell of a trades-table row, with the senate PTR id hint. */
import { useTranslations } from 'next-intl';
import type { Chamber } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { SenateDisclosureTooltip } from '../../congressTooltips';
import {
    PTR_ID_PREFIX_LENGTH,
    extractSenatePtrId,
    getDisclosureHref,
} from '../../utils/disclosureLinks';
import { CHAMBER_LABEL } from '../../utils/tradeLabels';

interface DisclosureCellProps {
    chamber: Chamber;
    link: string;
    office: string;
    transactionDate: string;
}

/**
 * Senate rows link to the efdsearch landing page and show a short PTR id hint
 * that users copy into the search form after accepting the disclaimer. The
 * tooltip tells them to paste the PTR id, so the FULL id is also exposed — as
 * the hint's `title` and as visually-hidden text — while the visible label
 * stays short. House rows link straight to the PDF and need no hint.
 */
export function DisclosureCell({
    chamber,
    link,
    office,
    transactionDate,
}: DisclosureCellProps) {
    const t = useTranslations('widgets.congress');
    const tLabel = useTranslations('shared.enumLabel');
    const isSenate = chamber === 'senate';
    const ptrId = isSenate ? extractSenatePtrId(link) : null;

    return (
        <div>
            <a
                href={getDisclosureHref(chamber, link)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('disclosureLink', {
                    v0: tLabel(CHAMBER_LABEL[chamber]),
                    v1: office,
                    v2: transactionDate,
                    v3: isSenate
                        ? t('disclosureSearch')
                        : t('disclosureDocument'),
                })}
                className="tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {isSenate
                    ? t('CongressTradesTable.fdf8d2')
                    : t('CongressTradesTable.26d466')}
            </a>
            {isSenate && <InfoTooltip>{SenateDisclosureTooltip}</InfoTooltip>}
            {ptrId && (
                <span
                    className="block font-mono text-[10px] whitespace-nowrap text-secondary-400"
                    title={t('ptrIdFull', { v0: ptrId })}
                >
                    <span aria-hidden="true">
                        {t('ptrIdLabel', {
                            v0: ptrId.slice(0, PTR_ID_PREFIX_LENGTH),
                        })}
                    </span>
                    <span className="sr-only">
                        {t('ptrIdFull', { v0: ptrId })}
                    </span>
                </span>
            )}
        </div>
    );
}
