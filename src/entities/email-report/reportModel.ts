import type {
    NewsSentiment,
    PullbackReading,
    Trend,
    TrendState,
} from '@y0ngha/siglens-core';

/**
 * 메일 한 통에 들어가는 종목 한 칸의 데이터. 회원과 무관하게 `(symbol, locale)`마다
 * 한 번 만들어 같은 종목을 가진 회원들이 나눠 쓴다.
 *
 * **매매 지시성 수치(진입가·손절가·목표가)는 담지 않는다.** 분석 소스가 무료 등급으로
 * 걸러진 스냅샷이라 애초에 없지만, 메일은 정보 제공에 그쳐야 하므로 이 타입에도 자리를
 * 만들지 않는다.
 */
export interface SymbolReport {
    symbol: string;
    /** 기술적 분석 요약(전문가 문체). 스냅샷이 없거나 오래됐으면 `null`. */
    technical: {
        summary: string;
        trend: Trend | null;
        /** 감지된 차트 패턴 설명(최대 {@link REPORT_MAX_PATTERNS}개). */
        patterns: string[];
    } | null;
    /** 쉽게보기 산문. 없으면 `null`. */
    plain: string | null;
    news: SymbolReportNews[];
    options: SymbolReportOptions | null;
    /**
     * 분석이 만들어진 시각(ISO) — 분석 내용 안의 `analyzedAt`이다. 스냅샷 행의 `generatedAt`(하베스트가 행을 다시
     * 쓴 시각일 수 있다)이 아니다. 분석이 없거나 내용에 시각이 없으면 `null`.
     */
    analyzedAt: string | null;
}

/** 종목 카드에 싣는 뉴스 한 건 — 표시 언어로 이미 골라낸 제목·요약. */
export interface SymbolReportNews {
    title: string;
    /** AI 카드 요약. 분석 전 기사면 `null`. */
    summary: string | null;
    sentiment: NewsSentiment | null;
    url: string;
    source: string;
    publishedAt: string;
}

/** 종목 카드의 옵션 섹션 데이터. 지표는 값이 없으면 각각 `null`이고 템플릿이 그 줄만 뺀다. */
export interface SymbolReportOptions {
    expirationDate: string;
    /** 미결제약정 기준 풋/콜 비율. */
    putCallRatio: number | null;
    /** ATM 내재변동성(분수, 0.28 = 28%). */
    atmImpliedVolatility: number | null;
    /** 만기까지 시장이 내포한 변동폭(±%). */
    impliedMovePercent: number | null;
    /** 옵션 AI 분석 요약. 스냅샷이 없으면 `null`. */
    summary: string | null;
}

/** 카드 한 장에 싣는 차트 패턴 설명의 최대 개수. */
export const REPORT_MAX_PATTERNS = 2;
/** 카드 한 장에 싣는 뉴스의 최대 개수. */
export const REPORT_MAX_NEWS = 3;

/**
 * core 판정기의 신호 요약 — `evaluateConfluence`·`scoreConfluence`·`evaluatePullback`
 * 결과를 메일 문구에 필요한 만큼만 옮긴 것. **규칙 상태(`entryTrigger`/`exitTrigger`)는
 * 담지 않는다** — 매수·매도 지시로 읽힐 수 있는 필드는 SIGLENS AI 도구(`getBarsIndicators`)와
 * 같은 이유로 처음부터 자리를 두지 않는다.
 *
 * `bullish`·`bearish`·`fresh`는 core의 `ConfluenceSnapshot`이 주는 `string[]`을 그대로 둔다 —
 * `SignalType`으로 캐스팅하면 "사전에 없는 새 타입"이라는 바로 그 경우를 타입이 가려 버린다.
 * 라벨 사전 조회(`SignalLabelResolver`)가 미등록 타입을 걸러 낸다.
 */
export interface SignalBrief {
    /** `scoreConfluence(snapshot)`. core가 판정을 보류(`null`)했으면 `null` — 중립 50과 섞지 않는다. */
    score: number | null;
    bullish: string[];
    bearish: string[];
    /** `freshBullish ∪ freshBearish` — "새로 켜짐" 표기 대상. 중복 없이 정렬. */
    fresh: string[];
    pullback: Exclude<PullbackReading, 'none'> | null;
}

/** 메일에 이름으로 적는 종목 이름 원본. 사이트의 `AssetInfo`에서 이름 두 필드만 옮긴 것. */
export interface ReportSymbolNames {
    /** 영문 법인명. */
    name: string;
    /** 한글명. 번역이 아직 없으면 없다. */
    koreanName?: string;
}

/** 요약 표 한 행 / 카드의 신호 줄에 필요한 종목 한 칸의 경량 데이터. */
export interface SymbolBrief {
    symbol: string;
    /**
     * 표시 이름 원본(로케일 무관 — 어느 이름을 쓸지는 템플릿이 정한다). 이름 조회에 실패했거나
     * 없는 종목은 `null`이고 메일은 접미사를 뗀 티커로 떨어진다.
     */
    names: ReportSymbolNames | null;
    /** 마지막 일봉 종가. 봉이 없으면 `null`. */
    close: number | null;
    /** 직전 종가 대비 등락률(%). 직전 봉이 없거나 0 이하면 `null`. */
    changePercent: number | null;
    trend: TrendState | null;
    /** 일봉 조회에 실패했으면 `null`("데이터 없음"). 보류는 `signals.score === null`. */
    signals: SignalBrief | null;
}

/** 신호 요약 한 줄에 라벨로 적는 최대 타입 수. 넘치는 만큼은 "+N". */
export const SIGNAL_BRIEF_MAX_LABELS = 3;

/**
 * 차트 아래 범례의 한 칸. 이름은 언어마다 달라 템플릿이 정한다 — 카드(패턴·전략)는 스킬 원래 이름을 싣고
 * 템플릿이 `shared.skillName` 사전으로 바꾼다. 나머지는 종류 이름이다.
 */
export type ReportLegendEntry =
    | { kind: 'card'; name: string; color: string }
    | {
          kind:
              | 'trendUp'
              | 'trendDown'
              | 'fibonacci'
              | 'divergence'
              | 'elliott';
          color: string;
      };

/** 차트 이미지에 실제로 그려지는 분석 작도 — 어느 분석인지(시각)와 범례. */
export interface ReportChartDrawings {
    /** 작도를 가져온 분석이 만들어진 시각(ISO). */
    analyzedAt: string;
    legend: ReportLegendEntry[];
}
