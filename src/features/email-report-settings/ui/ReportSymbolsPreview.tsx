import { useTranslations } from 'next-intl';
import type { ReportSymbolToggleMode } from '../hooks/useReportSymbolToggle';
import { ReportSymbolChip } from './ReportSymbolChip';

export interface ReportPreviewChip {
    symbol: string;
    /** 보유·관심종목 행의 표시명. 없으면 심볼만 보인다. */
    name: string | null;
}

export interface ReportSymbolsPreviewData {
    full: ReportPreviewChip[];
    brief: ReportPreviewChip[];
    /** 회원이 리포트에서 뺀 종목(보유·관심종목에 있는 것만). */
    excluded: ReportPreviewChip[];
}

interface ReportSymbolsPreviewProps {
    /** `null`이면 조회 실패 — 안내만 그린다. */
    preview: ReportSymbolsPreviewData | null;
}

function ChipGroup({
    label,
    chips,
    mode,
}: {
    label: string;
    chips: ReportPreviewChip[];
    mode: ReportSymbolToggleMode;
}) {
    if (chips.length === 0) return null;
    return (
        <div role="group" aria-label={label} className="space-y-2">
            <p className="text-xs font-medium text-secondary-400">{label}</p>
            <ul className="flex flex-wrap gap-2">
                {chips.map(chip => (
                    <ReportSymbolChip
                        key={chip.symbol}
                        symbol={chip.symbol}
                        name={chip.name}
                        mode={mode}
                    />
                ))}
            </ul>
        </div>
    );
}

/**
 * 설정 페이지의 "이번 리포트에 담기는 종목" 미리보기 — 배치가 쓰는 `selectReportSymbols`와 같은
 * 선택을 서버에서 한 번 계산해 받는다. 상세(전체 카드)·요약(표)·뺀 종목 세 그룹.
 * 이 컴포넌트는 서버 컴포넌트로 렌더되고, 칩의 빼기·다시 넣기 버튼만 클라이언트 컴포넌트
 * (`ReportSymbolChip`)다.
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
    if (total === 0 && preview.excluded.length === 0) {
        return (
            <p className="text-sm text-secondary-400">
                {t('ReportSymbolsPreview.d406d7')}
            </p>
        );
    }
    return (
        <div className="space-y-4">
            {total === 0 ? (
                <p className="text-sm leading-relaxed text-secondary-300">
                    {t('ReportSymbolsPreview.allExcluded')}
                </p>
            ) : (
                <>
                    <p className="text-sm leading-relaxed text-secondary-300">
                        {t('ReportSymbolsPreview.715443', {
                            v0: total,
                            v1: preview.full.length,
                            v2: preview.brief.length,
                        })}
                    </p>
                    <p className="text-xs leading-relaxed text-secondary-400">
                        {t('ReportSymbolsPreview.removeHint')}
                    </p>
                </>
            )}
            <ChipGroup
                label={t('ReportSymbolsPreview.bb4464')}
                chips={preview.full}
                mode="exclude"
            />
            <ChipGroup
                label={t('ReportSymbolsPreview.3ea27a')}
                chips={preview.brief}
                mode="exclude"
            />
            <ChipGroup
                label={t('ReportSymbolsPreview.excludedGroup')}
                chips={preview.excluded}
                mode="include"
            />
        </div>
    );
}
