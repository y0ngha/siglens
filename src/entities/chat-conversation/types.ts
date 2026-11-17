import type {
    AgentBarsTimeframe,
    Bar,
    ChartOverlay,
} from '@y0ngha/siglens-core';
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
}
