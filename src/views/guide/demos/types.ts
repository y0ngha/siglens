/**
 * 가이드 데모 차트의 입력 모델.
 *
 * 차트는 서버에서 SVG로 그려지므로 이 타입은 직렬화 가능한 순수 데이터만 담는다.
 * 라벨은 로케일에 묶이지 않도록 짧은 영문 약어·숫자(`BOS`, `P`, `R1`, `1`~`5`)를 쓴다.
 */

/** 데모 항목이 속하는 가이드 카테고리 (entities/guide의 GuideCategory와 같은 값). */
export type GuideDemoCategory =
    | 'candlesticks'
    | 'chart-patterns'
    | 'indicators'
    | 'strategies';

/** 봉 색을 방향이 아니라 의미로 덮어쓸 때 쓴다 (엘더 임펄스: 녹/청/적). */
export type DemoBarTone = 'bull' | 'bear' | 'neutral';

/** 데모 봉 하나. core 지표 계산(`toCoreBars`)에도 그대로 넘어간다. `time`은 단조 증가만 의미가 있다(장중 데모만 실제 시각을 쓴다 — core VWAP이 날짜가 바뀌면 누적을 끊는다). */
export interface DemoBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    tone?: DemoBarTone;
}

/** 선·밴드에 쓰는 색 슬롯. a/b/c는 구분용 3색, bull/bear는 방향색. */
export type DemoSeriesTone = 'a' | 'b' | 'c' | 'bull' | 'bear';

/** 추세선·수평선의 의미. 색(`ROLE_STROKE`)과 넥라인의 점선 여부가 여기서 정해져 데모 정의는 색을 직접 고르지 않는다. */
export type DemoLineRole =
    | 'support'
    | 'resistance'
    | 'neckline'
    | 'trend'
    | 'neutral';

/** 가격 영역에 얹는 도형 한 개. 배열 순서가 그리는 순서이자 라벨 자리 우선순위다(`layoutOverlayLabels`). */
export type DemoOverlay =
    | {
          kind: 'line';
          from: { i: number; price: number };
          to: { i: number; price: number };
          role: DemoLineRole;
          label?: string;
      }
    | {
          kind: 'level';
          price: number;
          fromIndex?: number;
          label: string;
          role?: 'support' | 'resistance' | 'neutral';
      }
    | {
          kind: 'marker';
          i: number;
          position: 'above' | 'below';
          label: string;
          tone: 'bull' | 'bear' | 'neutral';
      }
    | {
          kind: 'zone';
          fromIndex: number;
          toIndex: number;
          low: number;
          high: number;
          label?: string;
      }
    | {
          kind: 'series';
          values: readonly (number | null)[];
          label: string;
          tone?: DemoSeriesTone;
          /** `dots`는 파라볼릭 SAR처럼 점으로 찍는다. 기본은 선. */
          style?: 'line' | 'dots';
          /** 가격 범위에서 멀어도 보이는 가격 영역에 포함한다 (MA200처럼 기준이 되는 선). */
          includeInDomain?: boolean;
      }
    | {
          /** 두 선 사이를 칠한 띠 (볼린저·켈트너·돈치안·일목 구름). */
          kind: 'band';
          upper: readonly (number | null)[];
          lower: readonly (number | null)[];
          label: string;
          tone?: DemoSeriesTone;
          includeInDomain?: boolean;
      }
    | {
          /** 가격대별 거래량 막대를 차트 오른쪽 가장자리에서 왼쪽으로 세운다. */
          kind: 'profile';
          rows: readonly { price: number; volume: number }[];
          label?: string;
      };

/** 보조 패널 안의 선 하나. `label`이 빈 문자열이면 범례에서 빠진다. */
export interface DemoPaneLine {
    values: readonly (number | null)[];
    label: string;
    tone?: DemoSeriesTone;
}

/** 가격 차트 아래 보조 패널 하나. `range`는 RSI처럼 범위가 고정된 지표용이고, 없으면 값에서 범위를 잡는다(`paneDomain`). */
export interface DemoPane {
    label: string;
    height?: number;
    lines?: readonly DemoPaneLine[];
    histogram?: readonly (number | null)[];
    /** 막대 색을 부호가 아니라 직접 지정할 때 (거래량: 봉 방향, 임펄스: 녹/청/적). */
    histogramTones?: readonly DemoBarTone[];
    levels?: readonly { value: number; label?: string }[];
    range?: readonly [number, number];
}

/** 데모 차트 한 장의 입력. 데모 생성 함수가 만들고 `GuideDemoChart`가 계산 없이 받아 그린다. */
export interface GuideDemo {
    bars: readonly DemoBar[];
    overlays?: readonly DemoOverlay[];
    panes?: readonly DemoPane[];
    highlight?: { fromIndex: number; toIndex: number };
}
