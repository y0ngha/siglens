'use client';

import type { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import { AnalysisSettingsMenu } from '@/widgets/analysis/AnalysisSettingsMenu';
import { ShareButton } from '@/widgets/share/ui/ShareButton';
import { WatchlistToggleButton } from '@/features/watchlist/ui/WatchlistToggleButton';
import { RecordRecentSymbol } from '@/features/watchlist/ui/RecordRecentSymbol';
import { PortfolioChipMounted } from '@/features/portfolio-holding/ui/PortfolioChipMounted';

/** "분석 설정" 메뉴가 쓰는 모델·reasoning 상태 — 헤더가 `useSymbolModel()`에서 한 번 읽어 넘긴다. */
type AnalysisSettings = Pick<
    ReturnType<typeof useSymbolModel>,
    | 'modelId'
    | 'allowedModels'
    | 'unavailableModels'
    | 'handleModelChange'
    | 'reasoning'
    | 'setReasoning'
    | 'canUseReasoning'
    | 'isReasoningSupported'
    | 'openSignupNudge'
>;

interface SymbolHeaderControlsProps {
    /** 대문자 티커. */
    ticker: string;
    /** 관심종목·최근 본 종목에 저장되는 표시명(`resolveHeaderDisplayName`). */
    watchlistLabel: string;
    /** "분석 설정" 메뉴 상태. */
    settings: AnalysisSettings;
}

/**
 * `[☆][평단 칩(회원)][공유][설정 기어]`의 size-11 아이콘형 컨트롤 한 줄. 모델 셀렉터·상세분석
 * 토글은 "분석 설정" 팝오버 뒤에 있어 모바일도 한 줄에 들어간다 — 헤더 높이가 늘면 탭 레일이
 * 밀리므로 이 행은 한 줄을 넘지 않아야 한다. 폴백 셸(`SymbolHeaderShellFallback`)도 같은 폭의
 * 자리를 둔다.
 */
export function SymbolHeaderControls({
    ticker,
    watchlistLabel,
    settings,
}: SymbolHeaderControlsProps) {
    return (
        <div className="flex items-center gap-2">
            <WatchlistToggleButton
                symbol={ticker}
                label={watchlistLabel}
                source="symbol_header"
                successToast
                showCoachMark
            />
            {/* 헤더 ★·홈 카드·`/watchlist`의 "최근 본" 탭 기록. 그리는 것은 없다. */}
            <RecordRecentSymbol symbol={ticker} label={watchlistLabel} />
            <PortfolioChipMounted symbol={ticker} />
            <ShareButton />
            <AnalysisSettingsMenu
                modelId={settings.modelId}
                allowedModels={settings.allowedModels}
                unavailableModels={settings.unavailableModels}
                handleModelChange={settings.handleModelChange}
                reasoning={settings.reasoning}
                setReasoning={settings.setReasoning}
                canUseReasoning={settings.canUseReasoning}
                isReasoningSupported={settings.isReasoningSupported}
                openSignupNudge={settings.openSignupNudge}
            />
        </div>
    );
}
