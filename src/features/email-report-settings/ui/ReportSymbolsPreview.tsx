import { useTranslations } from 'next-intl';

export interface ReportPreviewChip {
    symbol: string;
    /** 보유·관심종목 행의 표시명. 없으면 심볼만 보인다. */
    name: string | null;
}

export interface ReportSymbolsPreviewData {
    full: ReportPreviewChip[];
    brief: ReportPreviewChip[];
}

interface ReportSymbolsPreviewProps {
    /** `null`이면 조회 실패 — 안내만 그린다. */
    preview: ReportSymbolsPreviewData | null;
}

const CHIP =
    'inline-flex max-w-full items-baseline gap-1.5 rounded-full border border-border-control bg-secondary-900/60 px-3 py-1 text-sm text-secondary-100';

function ChipGroup({
    label,
    chips,
}: {
    label: string;
    chips: ReportPreviewChip[];
}) {
    if (chips.length === 0) return null;
    return (
        <div role="group" aria-label={label} className="space-y-2">
            <p className="text-xs font-medium text-secondary-400">{label}</p>
            <ul className="flex flex-wrap gap-2">
                {chips.map(chip => (
                    <li key={chip.symbol} className={CHIP}>
                        {chip.name !== null ? (
                            <>
                                <span className="truncate">{chip.name}</span>
                                <span className="text-xs text-secondary-400 tabular-nums">
                                    {chip.symbol}
                                </span>
                            </>
                        ) : (
                            <span>{chip.symbol}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * 설정 페이지의 "이번 리포트에 담기는 종목" 미리보기 — 배치가 쓰는 `selectReportSymbols`와 같은
 * 선택을 서버에서 한 번 계산해 받는다. 상세(전체 카드)와 요약(표) 두 그룹.
 * 서버 컴포넌트에서 렌더되므로 `'use client'`가 없다.
 */
export function ReportSymbolsPreview({ preview }: ReportSymbolsPreviewProps) {
    const t = useTranslations('features.email-report-settings');
    if (preview === null) {
        return (
            <p className="text-sm text-secondary-400">
                {t('ReportSymbolsPreview.2f3e5b')}
            </p>
        );
    }
    const total = preview.full.length + preview.brief.length;
    if (total === 0) {
        return (
            <p className="text-sm text-secondary-400">
                {t('ReportSymbolsPreview.d406d7')}
            </p>
        );
    }
    return (
        <div className="space-y-4">
            <p className="text-sm leading-relaxed text-secondary-300">
                {t('ReportSymbolsPreview.715443', {
                    v0: total,
                    v1: preview.full.length,
                    v2: preview.brief.length,
                })}
            </p>
            <ChipGroup
                label={t('ReportSymbolsPreview.bb4464')}
                chips={preview.full}
            />
            <ChipGroup
                label={t('ReportSymbolsPreview.3ea27a')}
                chips={preview.brief}
            />
        </div>
    );
}
