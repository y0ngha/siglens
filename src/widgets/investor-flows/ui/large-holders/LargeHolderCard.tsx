/**
 * 대량보유(13D·13G) 공시 카드 한 장 — 신고인·종류 배지·신고일·양식·지분율·주식 수·원문 링크.
 */
import { useTranslations } from 'next-intl';
import type { LargeHolderFiling } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { formatCompact, formatPercent } from '../../utils/flowFormat';
import {
    KIND_CLASS,
    largeHolderKind,
    type LargeHolderKind,
} from '../../utils/largeHolders';
import { FilingLink } from '../filings/FilingLink';

/** 지분율(%)의 소수 자리. */
const PERCENT_DIGITS = 2;
/** 값을 모르는 칸의 대시. */
const UNKNOWN = '–';

function Field({
    label,
    mono = true,
    children,
}: {
    readonly label: string;
    readonly mono?: boolean;
    readonly children: string;
}) {
    return (
        <div>
            <dt className="text-secondary-400">{label}</dt>
            <dd
                className={cn(
                    'text-secondary-200 tabular-nums',
                    mono && 'font-mono'
                )}
            >
                {children}
            </dd>
        </div>
    );
}

/** 대량보유 공시 카드. */
export function LargeHolderCard({
    filing,
}: {
    readonly filing: LargeHolderFiling;
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const kind = largeHolderKind(filing.form);
    const kindLabels: Record<LargeHolderKind, string> = {
        '13d': t('largeHolders.kind13d'),
        '13g': t('largeHolders.kind13g'),
        other: t('largeHolders.kindOther'),
    };
    const filer =
        filing.filer === '' ? t('largeHolders.unknownFiler') : filing.filer;
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                    {filer}
                </p>
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        KIND_CLASS[kind]
                    )}
                >
                    {kindLabels[kind]}
                </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                <Field label={t('largeHolders.colDate')}>
                    {filing.filingDate}
                </Field>
                <Field label={t('largeHolders.colForm')}>{filing.form}</Field>
                <Field label={t('largeHolders.colPercent')}>
                    {filing.percentOfClass === null
                        ? UNKNOWN
                        : formatPercent(
                              filing.percentOfClass,
                              locale,
                              PERCENT_DIGITS
                          )}
                </Field>
                <Field label={t('largeHolders.colShares')} mono={false}>
                    {filing.shares === null
                        ? UNKNOWN
                        : formatCompact(filing.shares, locale)}
                </Field>
            </dl>
            <div className="mt-2 text-right">
                <FilingLink
                    url={filing.url}
                    label={t('largeHolders.filing')}
                    accessibleName={t('largeHolders.filingLabel', {
                        form: filing.form,
                        filer,
                    })}
                />
            </div>
        </li>
    );
}
