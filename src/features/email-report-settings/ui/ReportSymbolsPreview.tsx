import { useTranslations } from 'next-intl';
import { EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS } from '@/entities/email-report/lib/emailReportConstants';
import type { ReportSymbolToggleMode } from '../hooks/useReportSymbolToggle';
import {
    REPORT_SYMBOLS_HEADING_ID,
    REPORT_SYMBOLS_PREVIEW_ID,
} from '../lib/reportSymbolsPreviewIds';
import { ReportSymbolChip } from './ReportSymbolChip';

export interface ReportPreviewChip {
    symbol: string;
    /** 보유·관심종목 행의 표시명. 없으면 심볼만 보인다. */
    name: string | null;
}

export interface ReportSymbolsPreviewData {
    full: ReportPreviewChip[];
    brief: ReportPreviewChip[];
    /** 회원이 리포트에서 뺀 종목 중 보유·관심종목에 아직 있는 것(다시 넣을 수 있다). */
    excluded: ReportPreviewChip[];
    /**
     * 뺀 종목 중 보유·관심종목에서 이미 사라진 것. 리포트엔 영향이 없지만 제외 상한을 차지하므로
     * 기록을 지울 수 있게 따로 보여 준다. 이름은 알 수 없어 `name`은 늘 `null`이다.
     */
    staleExcluded: ReportPreviewChip[];
}

interface ReportSymbolsPreviewProps {
    /** `null`이면 조회 실패 — 안내만 그린다. */
    preview: ReportSymbolsPreviewData | null;
}

interface ChipGroupProps {
    label: string;
    chips: ReportPreviewChip[];
    mode: ReportSymbolToggleMode;
    /** 묶음 아래 한 줄 설명(버튼을 누르면 어떻게 되는지). */
    hint?: string;
}

function ChipGroup({ label, chips, mode, hint }: ChipGroupProps) {
    if (chips.length === 0) return null;
    return (
        <div role="group" aria-label={label} className="space-y-2">
            <p className="text-xs font-medium text-secondary-400">{label}</p>
            {hint && (
                <p className="text-xs leading-relaxed text-secondary-400">
                    {hint}
                </p>
            )}
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
 * 포커스 복귀 지점. 칩을 눌러 목록이 바뀌면 눌렀던 버튼이 사라지므로, 훅이 성공 후 이 컨테이너로
 * 포커스를 옮긴다(`tabIndex={-1}`은 프로그램 포커스만 허용). 섹션 제목을 이름으로 쓴다.
 */
function PreviewContainer({ children }: { children: React.ReactNode }) {
    return (
        <div
            id={REPORT_SYMBOLS_PREVIEW_ID}
            role="group"
            aria-labelledby={REPORT_SYMBOLS_HEADING_ID}
            tabIndex={-1}
            className="space-y-4 rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {children}
        </div>
    );
}

/**
 * 설정 페이지의 "이번 리포트에 담기는 종목" 미리보기 — 배치가 쓰는 `selectReportSymbols`와 같은
 * 선택을 서버에서 한 번 계산해 받는다. 상세(전체 카드)·요약(표)·뺀 종목, 그리고 목록에서 지운 종목의 제외 기록 그룹.
 * 이 컴포넌트는 서버 컴포넌트로 렌더되고, 칩의 빼기·다시 넣기 버튼만 클라이언트 컴포넌트
 * (`ReportSymbolChip`)다.
 */
export function ReportSymbolsPreview({ preview }: ReportSymbolsPreviewProps) {
    const t = useTranslations('features.email-report-settings');
    if (preview === null) {
        return (
            <PreviewContainer>
                <p className="text-sm text-secondary-400">
                    {t('ReportSymbolsPreview.2f3e5b')}
                </p>
            </PreviewContainer>
        );
    }
    const total = preview.full.length + preview.brief.length;
    const hasCandidates = total > 0 || preview.excluded.length > 0;
    return (
        <PreviewContainer>
            {total > 0 ? (
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
            ) : hasCandidates ? (
                <p className="text-sm leading-relaxed text-secondary-300">
                    {t('ReportSymbolsPreview.allExcluded')}
                </p>
            ) : (
                <p className="text-sm text-secondary-400">
                    {t('ReportSymbolsPreview.d406d7')}
                </p>
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
            <ChipGroup
                label={t('ReportSymbolsPreview.staleExcludedGroup')}
                hint={t('ReportSymbolsPreview.staleExcludedHint', {
                    v0: EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS,
                })}
                chips={preview.staleExcluded}
                mode="clear"
            />
        </PreviewContainer>
    );
}
