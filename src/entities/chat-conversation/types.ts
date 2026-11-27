import type {
    AgentBarsTimeframe,
    AgentChartPeriod,
    Bar,
    ChartOverlay,
} from '@y0ngha/siglens-core';
import type { PriceAlertProposal } from '@/entities/mail-alert/model';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

/** 차트 블록의 봉 주기 — 공급자 주기(`1Day`, `1Hour` …) 또는 일봉을 접은 `1Week`·`1Month`. */
export type ChatChartTimeframe = AgentBarsTimeframe;

/** 차트 블록의 봉 — 차트가 그리는 필드만(공급자 봉의 부가 필드는 싣지 않는다). */
export type ChatChartBars = Pick<
    Bar,
    'time' | 'open' | 'high' | 'low' | 'close' | 'volume'
>[];

/**
 * 답변에 붙는 차트 한 장 — 도구(기술 분석·봉 지표)가 끝날 때 서버가 만든 **표시 전용** 데이터다. 모델 컨텍스트에는
 * 들어가지 않고(도구 결과와 별개로 SSE `chart` 프레임과 그 도구 행의 `chart` 컬럼으로만 간다), 저장된 대화를 다시 열면
 * 답변 시점의 그림이 그대로 보인다(그 뒤 분석이 새로 생성돼도 바뀌지 않는다).
 */
export interface ChatChartBlock {
    /** 블록 모양 버전 — 저장된 행을 읽는 쪽이 모르는 버전은 그리지 않는다. */
    version: 1;
    symbol: string;
    timeframe: ChatChartTimeframe;
    marketProfile: MarketProfileId;
    /** 오래된 순. 작도가 있으면 작도의 모든 시각을 덮는다. */
    bars: ChatChartBars;
    /** 이 봉에 정렬된 작도만(`isOverlayAlignedToBars`). 봉 지표 도구는 비어 있다. */
    overlays: ChartOverlay[];
    /** 패턴 작도의 스킬 색 — `sourceRef → renderConfig.color`. */
    overlayColors: Record<string, string>;
    /** 작도 켜고 끄기 항목 이름 — `sourceRef → 스킬 이름`(표시 직전에 로케일 라벨로 바꾼다). */
    overlayLabels: Record<string, string>;
    /** 작도를 만든 분석의 생성 시각(ISO). 봉 지표 도구는 `null`. */
    analyzedAt: string | null;
    /**
     * 목표선을 "참고 거리"로 흐리게 그릴 패턴 카드의 `sourceRef` — 위약 대비 우위가 확인되지 않은 카드. 분석 카드가
     * 쓰는 판정(`isTargetReferenceOnly`)을 서버가 블록을 만들 때 내려 담는다(차트는 분석 카드를 볼 수 없어서).
     * 이 필드가 생기기 전에 저장된 블록과 봉 지표 블록은 없고(`undefined`), 그때는 흐리게 하지 않고 그대로 그린다.
     */
    referenceOnlyOverlayKeys?: string[];
}

/** 비교 차트의 기간 — core `AGENT_CHART_PERIODS`와 같은 목록(테스트가 맞는지 확인한다). */
export type ChatCompareChartPeriod = AgentChartPeriod;

/**
 * 시각화 블록 공통 머리 — `show_chart`가 서버에서 읽은 **실데이터**로 만든 표시 전용 그림이다. 캔들 차트 블록
 * ({@link ChatChartBlock})과 같은 경로(SSE `chart` 프레임, tool 행의 `chart` jsonb)로 저장·전송된다.
 */
interface ChatVisualBlockBase {
    /** 블록 모양 버전 — 저장된 행을 읽는 쪽이 모르는 버전은 그리지 않는다. */
    version: 1;
    /** 데이터를 읽은 시각(ISO). */
    asOf: string;
    /**
     * 한 종목 블록(실적·옵션·수급·배당)의 제목용 회사 이름 — 답변 언어 기준(한국어면 한글명). 이름을 못 찾았거나
     * 이 필드가 생기기 전에 저장된 블록은 없고(`undefined`/`null`), 그때 제목은 심볼이다.
     */
    name?: string | null;
}

/** 종목 비교: 기간 시작 이후 첫 봉 종가 대비 수익률(%) 선. 점은 `[봉 시각(초), 수익률 %]`. */
export interface ChatCompareBlock extends ChatVisualBlockBase {
    kind: 'compare';
    period: ChatCompareChartPeriod;
    series: { symbol: string; points: [number, number][] }[];
}

/** 분기 실적 한 칸 — 금액은 `currency` 단위, 모르는 값은 `null`. */
export interface ChatFinancialsQuarter {
    /** 분기 라벨(예: `2026 Q3`). */
    period: string;
    revenue: number | null;
    netIncome: number | null;
    eps: number | null;
    epsActual: number | null;
    epsEstimated: number | null;
}

/** 실적: 최근 8분기 매출·순이익·EPS(예상 대비 실제가 있으면 함께). */
export interface ChatFinancialsBlock extends ChatVisualBlockBase {
    kind: 'financials';
    symbol: string;
    /** 보고 통화(ISO). */
    currency: string;
    quarters: ChatFinancialsQuarter[];
}

/** 옵션 분포: 만기 하나의 행사가별 콜·풋 미결제약정. */
export interface ChatOptionsBlock extends ChatVisualBlockBase {
    kind: 'options';
    symbol: string;
    expiry: string;
    underlyingPrice: number;
    maxPain: number | null;
    putCallRatio: number | null;
    strikes: { strike: number; callOI: number; putOI: number }[];
}

/** 미국 수급: 기관 분기별 보유 변화 + 내부자 월별 순매수 금액(USD). */
export interface ChatFlowsUsBlock extends ChatVisualBlockBase {
    kind: 'flows';
    market: 'us';
    symbol: string;
    institutional: {
        period: string;
        /**
         * 13F 제출이 다 모인 분기인지. 진행 중 분기(`false`)는 부분 집계라 수급 탭처럼 윤곽선으로 그린다. 이 필드가 생기기
         * 전에 저장된 블록에는 없다 — 읽는 쪽은 없으면 `true`로 본다(`chartBlock`의 검증기가 그렇게 받아들인다).
         */
        complete: boolean;
        holders: number;
        netShareChange: number;
    }[];
    insiderNetValue: { month: string; value: number }[];
}

/** 한국 수급: 일별 외국인·기관·개인 순매수량(주). 개인은 없으면 `null`. */
export interface ChatFlowsKrBlock extends ChatVisualBlockBase {
    kind: 'flows';
    market: 'kr';
    symbol: string;
    days: {
        date: string;
        foreign: number;
        institution: number;
        individual: number | null;
    }[];
}

export type ChatFlowsBlock = ChatFlowsUsBlock | ChatFlowsKrBlock;

/** 보유종목: 통화 그룹별 비중·손익. 비중은 그 통화 합계 대비다(통화를 섞지 않는다). */
export interface ChatPortfolioBlock extends ChatVisualBlockBase {
    kind: 'portfolio';
    groups: {
        currency: string;
        holdings: {
            symbol: string;
            name: string | null;
            weightPct: number | null;
            pnlPct: number | null;
        }[];
    }[];
}

/** 히트맵 섹터 한 칸. */
export interface ChatHeatmapSector {
    label: string;
    changePct: number;
}

/** 히트맵 테마 구성 종목 한 칸 — 완결 일봉 기준 1·5·20거래일 등락률. */
export interface ChatHeatmapMember {
    symbol: string;
    name: string | null;
    changePct1d: number | null;
    changePct5d: number | null;
    changePct20d: number | null;
}

/** 시장 히트맵: 섹터 등락률 또는 테마 구성 종목 등락률. */
export type ChatHeatmapBlock = ChatVisualBlockBase & { kind: 'heatmap' } & (
        | {
              scope: 'sectors';
              market: 'us' | 'kr';
              sectors: ChatHeatmapSector[];
          }
        | {
              scope: 'theme';
              theme: string;
              label: string;
              members: ChatHeatmapMember[];
          }
    );

/** 배당: 연도별 주당 배당 합계. 올해는 아직 끝나지 않아 `partial`. */
export interface ChatDividendsBlock extends ChatVisualBlockBase {
    kind: 'dividends';
    symbol: string;
    currency: string;
    years: { year: number; amount: number; partial: boolean }[];
}

/** `show_chart`가 만드는 시각화 블록 — `kind`로 가른다. */
export type ChatVisualBlock =
    | ChatCompareBlock
    | ChatFinancialsBlock
    | ChatOptionsBlock
    | ChatFlowsBlock
    | ChatPortfolioBlock
    | ChatHeatmapBlock
    | ChatDividendsBlock;

/** 시각화 블록 종류 — core `AGENT_CHART_KINDS`와 같은 목록. */
export type ChatVisualBlockKind = ChatVisualBlock['kind'];

/**
 * 답변 아래 카드로 그리는 가격대 알림 제안(`propose_price_alert`). 차트가 아니라 **행동 카드**다 — 사용자가 카드의
 * 버튼을 눌러야만 알림이 만들어지고, 도구는 아무것도 쓰지 않는다. 같은 경로(SSE `chart` 프레임, tool 행의 `chart`
 * jsonb)로 저장·전송되어 대화를 다시 열어도 카드가 남는다(상태는 열 때 서버에서 다시 읽는다).
 */
export interface ChatPriceAlertProposalBlock {
    /** 블록 모양 버전 — 저장된 행을 읽는 쪽이 모르는 버전은 그리지 않는다. */
    version: 1;
    kind: 'price_alert_proposal';
    /** 카드가 그리는 값. 서명된 `token`의 본문과 같다(서버가 같은 값을 두 번 만든다). */
    proposal: PriceAlertProposal;
    /** 만들기 버튼이 서버 액션에 넘기는 서명된 제안. */
    token: string;
    /** 카드 제목용 회사 이름 — 답변 언어 기준. 못 찾았으면 `null`이고 제목은 심볼이다. */
    name: string | null;
}

/** 차트가 아닌 행동 블록. 그림 슬롯으로 가지 않고 답변 아래 카드로만 그린다. */
export type ChatActionBlock = ChatPriceAlertProposalBlock;

/** 차트 슬롯이 그리는 블록(캔들 차트 또는 시각화). 행동 블록은 여기에 들지 않는다. */
export type ChatDrawableBlock = ChatChartBlock | ChatVisualBlock;

/**
 * 저장·SSE·화면이 다루는 블록 단위. 캔들 차트 블록은 `kind`가 없고(옛 행 포함) 시각화 블록과 행동 블록만 `kind`가
 * 있다 — `kind`가 있다고 시각화는 아니다(`isVisualBlock`은 `kind` 목록으로 가른다).
 */
export type ChatBlock = ChatDrawableBlock | ChatActionBlock;

/** 시각화 블록 하나를 직렬화했을 때의 상한(바이트) — 행 크기가 커지지 않게 빌더가 지킨다. */
export const CHAT_VISUAL_BLOCK_MAX_BYTES = 50_000;
