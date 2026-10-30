'use client';

/**
 * AI 기술적 분석 패널 — 분석 응답을 받아 머리(추세·리스크·복사), 요약, 상세 섹션,
 * 재분석 버튼, 광고를 조립하는 오케스트레이터다. 판정은 `utils/`·`hooks/`가, 각 섹션의
 * 렌더는 `sections/`·`ui/`가 맡고 이 파일은 상태 연결과 배치만 한다.
 */
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
    KrxTickTable,
    TierInfoDepth,
    Timeframe,
} from '@y0ngha/siglens-core';
import { useFunnelMeterShown } from './hooks/useFunnelMeterShown';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import { AdBanner } from './AdBanner';
import { AnalysisProgress } from './AnalysisProgress';
import { AnalysisToast } from './AnalysisToast';
import { GuideEntryLink } from './GuideEntryLink';
import { StaleAnalysisBanner } from './StaleAnalysisBanner';
import { useAnalysisStaleness } from './hooks/useAnalysisStaleness';
import { useCopyAnalysisReport } from './hooks/useCopyAnalysisReport';
import { useIsFallbackAnalysis } from './hooks/useIsFallbackAnalysis';
import type { CooldownNotice } from './model/types';
import { AnalysisDetailSections } from './sections/AnalysisDetailSections';
import { AnalysisPanelHeader } from './sections/AnalysisPanelHeader';
import { AnalysisStatsLine } from './sections/AnalysisStatsLine';
import { ReanalyzeButton } from './ui/ReanalyzeButton';
import { resolveLockedSections } from './utils/lockedSections';
import { toOverlayCardControls } from './utils/overlayCardControls';
import { selectPanelSkillResults } from './utils/panelSkillResults';

/** overlaySourceRefs 미전달 시 기본값 — 매 렌더 새 Set을 만들지 않도록 모듈 상수로 고정. */
const EMPTY_OVERLAY_SOURCE_REFS: ReadonlySet<string> = new Set();

interface AnalysisPanelProps {
    symbol: string;
    /**
     * 이 종목의 KRX 호가 단위 표(`resolveKrxTickTable`을 서버에서 한 번 해석해 내려받는다).
     * ETF는 'etp' — 'share'로 반올림하면 `40,125`가 `40,150`으로 깎인다. 생략하면 'share'.
     */
    krxTickTable?: KrxTickTable;
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    /** 분석 대상 타임프레임. stale 판정 임계값 산정에 사용된다. */
    timeframe: Timeframe;
    isAnalyzing?: boolean;
    /** 마무리 애니메이션을 포함해 "사용자에게 분석이 진행 중인 것처럼 보이는" 상태.
     *  AnalysisProgress 표시·본문 섹션 숨김에 사용된다. ChartContent가 소유한다. */
    showProgress?: boolean;
    /** useAnalysisProgress 훅에서 관리되는 현재 단계 인덱스. */
    progressPhaseIndex?: number;
    /** useAnalysisProgress 훅에서 관리되는 현재 팁 인덱스. */
    progressTipIndex?: number;
    onReanalyze?: () => void;
    /**
     * 재분석 버튼에 포인터가 올라가거나 포커스가 갈 때 부른다. 호출부는 이때 서버
     * 쿨다운을 읽어 버튼에 카운트다운을 띄운다(`useAnalysis.syncReanalyzeCooldown`) —
     * 마운트마다 읽지 않기 위해서다.
     */
    onReanalyzeIntent?: () => void;
    /** 재분석 쿨다운이 끝나는 시각(epoch ms). 0이면 즉시 가능. */
    reanalyzeCooldownUntil?: number;
    /** 쿨다운 중 재분석 시도를 토스트로 알리기 위한 알림. */
    cooldownNotice?: CooldownNotice | null;
    actionPricesVisible?: boolean;
    onActionPricesVisibilityChange?: (isVisible: boolean) => void;
    /** false이면 광고를 표시하지 않는다. Pro 사용자에게는 false를 전달한다.
     *  인증 시스템 도입 전까지 기본값은 true (모든 사용자를 Free로 처리). */
    isFreeUser?: boolean;
    /**
     * 잠긴 상세 조각. 원본 값은 이 컴포넌트에 전달되지 않는다.
     * SSR·hydration 이전에도(initialLockedInfoDepth 경유) 채워질 수 있고,
     * 이 배열이 비어있지 않은 것만으로 게이트된 필드(리스크 배지·매매 전략·
     * 신뢰도 배지·복사 버튼)를 숨긴다(`resolveLockedSections`). 주요 레벨은 core
     * `filterAnalysisResult`가 `partial_detail` 깊이에서 이미 비워 보내므로 별도
     * 게이트가 없다. tier hydration 완료 여부에는 의존하지 않으므로,
     * 크롤러를 포함한 첫 SSR 페인트부터 fabricated 값이 노출되지 않는다.
     */
    lockedInfoDepth?: readonly TierInfoDepth[];
    /**
     * 평이화("쉽게보기") 산문. SSE 라우트가 분석 결과와 함께 내려준다.
     *
     * `null`/`undefined`면 재작성이 실패했거나 아직 도착하지 않은 것이다. 그때는
     * 토글을 렌더하지 않고 원본만 보여준다 — 아무 일도 하지 않는 토글을 노출하면
     * 사용자가 고장으로 읽는다.
     */
    plain?: string | null;
    /**
     * 이번 분석에 적용된 인디케이터 종류 수.
     * analysis → symbol-page 역방향 의존을 제거하기 위해 prop으로 전달한다.
     */
    indicatorCount?: number;
    /**
     * 차트 분석에 쓰이는 전체 스킬 수(`chartSkillTotal`: 지표·캔들·패턴·전략·지지/저항).
     * free 안내 카드의 "회원가입 후 N개 스킬"과 분석 진행 문구가 같은 값을 쓴다.
     */
    skillCount?: number;
    /**
     * 서버(SSE 분석 라우트)가 THIS 제출에서 실제로 개인화(포지션 버킷)
     * 캐시 키를 사용했는지 여부 — "내 평단 기준으로 분석했어요" 투명성 배지의
     * 유일한 게이트. `useAnalysis`가 라우트의 `personalized`
     * 응답 필드를 그대로 threading한다. 미전달 시 `false`로 취급해 배지를 숨긴다
     * (하위 호환 — 이 prop을 모르는 기존 호출부/테스트는 안전하게 배지 없음).
     */
    isPersonalized?: boolean;
    /**
     * 서버가 이번 응답에 실은 비회원 하루 무료 공개 미터 판정. `revealed`면 오늘의 공개
     * 종목이라 진입·손절·목표가 위에 안내 띠를 보이고, `exhausted`면 잠금 카드 문구를
     * 소진 안내로 바꾼다. `null`/미전달이면 미터와 무관한 기존 화면이다.
     */
    meter?: MeterState | null;
    /**
     * `chartOverlays[].sourceRef` 집합 — 패턴/전략 카드 중 이 집합에 속한
     * `id`만 '차트에서 보기' 토글을 렌더한다('원본' 보기 전용 — 쉽게보기 산문에는
     * 카드가 없다).
     */
    overlaySourceRefs?: ReadonlySet<string>;
    /** 꺼진 차트 작도 항목 key — 차트 헤더 메뉴와 같은 상태. */
    hiddenOverlayKeys?: ReadonlySet<string>;
    onToggleOverlay?: (key: string) => void;
    /** 카드 hover·버튼 focus 동안 강조할 key. `null`이면 해제. */
    onHighlightOverlay?: (key: string | null) => void;
    /** 해당 key가 강조 중일 때만 해제(멱등). */
    onClearOverlayHighlight?: (key: string) => void;
}

export function AnalysisPanel({
    symbol,
    krxTickTable = 'share',
    analysis,
    keyLevels,
    timeframe,
    isAnalyzing = false,
    showProgress = false,
    progressPhaseIndex = 0,
    progressTipIndex = 0,
    onReanalyze,
    onReanalyzeIntent,
    reanalyzeCooldownUntil = 0,
    cooldownNotice = null,
    actionPricesVisible = true,
    onActionPricesVisibilityChange,
    isFreeUser = true,
    lockedInfoDepth = [],
    indicatorCount = 0,
    skillCount = 0,
    isPersonalized = false,
    meter = null,
    plain,
    overlaySourceRefs = EMPTY_OVERLAY_SOURCE_REFS,
    hiddenOverlayKeys = EMPTY_OVERLAY_SOURCE_REFS,
    onToggleOverlay,
    onHighlightOverlay,
    onClearOverlayHighlight,
}: AnalysisPanelProps) {
    // showProgress·progressPhaseIndex·progressTipIndex는 ChartContent가 관리한다.
    // useAnalysisProgress 훅이 타이머/상태를 소유하므로 데스크톱·모바일 두 인스턴스가
    // 동일한 진행 상태를 표시하고 모바일 시트의 remount에도 상태가 유지된다.
    const isBusy = showProgress || isAnalyzing;
    const locked = resolveLockedSections(lockedInfoDepth);
    const isFallback = useIsFallbackAnalysis(analysis);
    // 띠(revealed)와 소진 카드(exhausted)는 동시에 보이지 않으므로 한 ref 콜백을
    // 그중 보이는 요소에 붙인다.
    const setMeterNode = useFunnelMeterShown(meter, symbol);
    const { copyState, copyReport } = useCopyAnalysisReport({
        symbol,
        krxTickTable,
        analysis,
        keyLevels,
        disabled: isBusy || locked.hasLockedDetails,
    });
    // 로딩 중에는 곧 새 분석으로 교체되므로 stale 배너를 노출하지 않는다.
    const showStaleBanner = useAnalysisStaleness({
        analyzedAt: analysis.analyzedAt,
        timeframe,
        enabled: !isBusy && onReanalyze !== undefined,
    });
    const skillResults = selectPanelSkillResults(analysis);
    const overlayControls = toOverlayCardControls(
        hiddenOverlayKeys,
        onToggleOverlay,
        onHighlightOverlay,
        onClearOverlayHighlight
    );

    return (
        <div className="relative flex flex-col gap-4 rounded-lg bg-secondary-800 p-4">
            {showStaleBanner && onReanalyze !== undefined && (
                <StaleAnalysisBanner
                    onReanalyze={onReanalyze}
                    onReanalyzeIntent={onReanalyzeIntent}
                    reanalyzeCooldownUntil={reanalyzeCooldownUntil}
                />
            )}
            <AnalysisToast
                key={cooldownNotice?.nonce}
                notice={cooldownNotice}
            />
            <AnalysisPanelHeader
                trend={analysis.trend}
                riskLevel={analysis.riskLevel}
                analyzedAt={analysis.analyzedAt}
                isAnalyzing={isAnalyzing}
                hideTrend={isFallback}
                // 개인화 배지는 서버-authoritative `isPersonalized`가 유일한 진실값이다.
                // 폴백도 배제한다 — 서사 없는 placeholder에 "내 평단 기준으로 분석했어요"는
                // 오해를 준다.
                showPersonalizedBadge={isPersonalized && !isFallback}
                showCopyButton={!locked.hasLockedDetails}
                copyState={copyState}
                isBusy={isBusy}
                onCopyReport={copyReport}
                showRiskLevel={!locked.hasLockedPartialDetail}
            />
            <AnalysisStatsLine
                detectedSkillCount={
                    locked.hasLockedDetails
                        ? null
                        : skillResults.detectedPatterns.length +
                          skillResults.strategies.length
                }
                indicatorCount={indicatorCount}
            />

            {/* 쉽게보기: 카드·표를 접고 산문 한 덩어리로 교체한다. 분석 진행 중에는
                평이화 결과가 아직 없으므로 원본(진행 인디케이터) 경로를 그대로 탄다. */}
            <PlainAnalysisSwitch
                plain={showProgress ? null : plain}
                hasLockedDetails={locked.hasLockedDetails}
                renderToggle={toggle =>
                    toggle !== null && (
                        <div className="flex justify-end">{toggle}</div>
                    )
                }
            >
                {/* 마무리 애니메이션이 끝날 때까지(showProgress=true) 진행 인디케이터를
                    유지한다 — 캐시 히트로 결과가 즉시 와도 5단계를 모두 본 뒤에 결과가
                    한 번에 드러나게. 폴백 응답의 summary는 정규화가 채운 빈 값이라
                    그리지 않는다. */}
                {showProgress ? (
                    <AnalysisProgress
                        phaseIndex={progressPhaseIndex}
                        tipIndex={progressTipIndex}
                        isFreeUser={isFreeUser}
                        indicatorCount={indicatorCount}
                        skillCount={skillCount}
                    />
                ) : (
                    <>
                        {!isFallback && (
                            <MarkdownText className="text-sm text-secondary-300">
                                {analysis.summary}
                            </MarkdownText>
                        )}
                        <AnalysisDetailSections
                            analysis={analysis}
                            keyLevels={keyLevels}
                            symbol={symbol}
                            krxTickTable={krxTickTable}
                            locked={locked}
                            skillResults={skillResults}
                            meter={meter}
                            meterRef={setMeterNode}
                            skillCount={skillCount}
                            actionPricesVisible={actionPricesVisible}
                            onActionPricesVisibilityChange={
                                onActionPricesVisibilityChange
                            }
                            overlaySourceRefs={overlaySourceRefs}
                            overlayControls={overlayControls}
                        />
                    </>
                )}
            </PlainAnalysisSwitch>

            {/* 패널 전체에 한 줄만 두는 차트 가이드 진입점. 캔들 패턴은 차트 캔버스 마커로만
                그려져 항목별 "뜻 보기"를 달 수 없으므로, 여기서 가이드 전체로 보낸다. */}
            {!showProgress && <GuideEntryLink />}

            {onReanalyze !== undefined && (
                <div className="mt-1">
                    <ReanalyzeButton
                        isAnalyzing={isBusy}
                        reanalyzeCooldownUntil={reanalyzeCooldownUntil}
                        onReanalyze={onReanalyze}
                        onIntent={onReanalyzeIntent}
                    />
                </div>
            )}

            {!showProgress && (
                <AdBanner
                    isFreeUser={isFreeUser}
                    slot="analysis-panel-bottom"
                />
            )}
        </div>
    );
}
