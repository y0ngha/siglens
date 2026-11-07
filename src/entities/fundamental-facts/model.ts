import type {
    DilutionMetrics,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
    InsiderMetrics,
    InvestorFlowsFreshness,
    KrInsiderMetrics,
    ShortMetrics,
} from '@y0ngha/siglens-core';

/**
 * 펀더멘털 탭 "재무·수급 한눈에" 블록의 입력과 출력.
 *
 * 블록은 **기준을 넘는 사실만** 문장으로 그린다 — 전 종목이 같은 문장 틀에 숫자만 바꿔 채우면
 * 2026-07 절벽 때 문제가 된 "숫자 교체 템플릿"이 되므로, 종목마다 그려지는 사실의 종류와 수가
 * 달라지게 한다. 그려진 사실 수가 이 탭의 색인 게이트다(`FUNDAMENTAL_INDEX_MIN_FACTS`).
 * 모든 값은 이미 받아 오는 데이터(FMP·SEC·FINRA·DART·DB)에서 결정적으로 계산한다 — LLM 없음.
 */

/** 실적 행 하나 — `earnings_reports` 테이블에서 숫자로 변환한 값. */
export interface FundamentalFactsEarningsRow {
    readonly earningsDate: string;
    readonly epsActual: number | null;
    readonly epsEstimated: number | null;
}

/**
 * core `InvestorFlowsScorecard`에서 이 블록이 읽는 부분만 — 전체 스코어카드는 구조적으로 이 타입을
 * 만족하므로 그대로 넘기면 되고, 테스트는 필요한 필드만 채운다.
 */
export interface FundamentalFactsScorecard {
    readonly dilution: {
        readonly metrics: Pick<
            DilutionMetrics,
            | 'filingsInWindow'
            | 'atmFilings'
            | 'shelfFilings'
            | 'latestFilingDate'
        > | null;
    };
    readonly insider: {
        readonly metrics: Pick<
            InsiderMetrics,
            'buyCount' | 'sellCount' | 'buyValueUsd' | 'sellValueUsd'
        > | null;
        readonly krMetrics?: Pick<
            KrInsiderMetrics,
            'reports' | 'reporters' | 'netSharesChange' | 'latestReceiptDate'
        >;
    };
    readonly short: {
        readonly metrics: Pick<
            ShortMetrics,
            'shortInterestPctFloat' | 'daysToCover'
        >;
    };
    readonly freshness: Pick<
        InvestorFlowsFreshness,
        'dilutionWindow' | 'insiderWindow' | 'shortInterestSettlementDate'
    >;
}

export interface FundamentalFactsInput {
    /**
     * 그 종목 시장의 오늘 날짜 키(`YYYY-MM-DD`) — 미국은 ET, 한국은 KST. 실적일이 그 시장의 달력
     * 날짜라 KST로 비교하면 미국 종목의 "오늘 발표"가 반나절 동안 지난 일정이 된다. lib는 시계를 읽지 않는다.
     */
    readonly today: string;
    /** 가장 최근 연간 재무 — 현금·영업현금흐름과 그 기준일. 없으면 `null`. */
    readonly annual: {
        readonly date: string;
        readonly cashAndShortTermInvestments: number | null;
        readonly operatingCashFlow: number | null;
        /**
         * 같은 연도 순이익. 현금 소진 문장은 순이익도 적자일 때만 낸다 — 은행·증권사는 예금·
         * 트레이딩 자산 변동으로 흑자인데도 영업현금흐름이 음수로 잡힌다(JPM·SOFI 실측).
         */
        readonly netIncome: number | null;
        readonly reportedCurrency: string | null;
    } | null;
    /** core가 평가한 수급 스코어카드. 수급 데이터가 없으면 `null`. */
    readonly scorecard: FundamentalFactsScorecard | null;
    readonly priceTargetConsensus: FundamentalPriceTargetConsensusInput | null;
    readonly priceTargetSummary: FundamentalPriceTargetSummaryInput | null;
    readonly grades: FundamentalGradesConsensusInput | null;
    /** 발표된 실적 행(실제 EPS 있음). 날짜 순서는 무관하다 — 빌더가 정렬한다. */
    readonly earnings: readonly FundamentalFactsEarningsRow[] | null;
    /**
     * 다음 실적 예정일(`getNextEarningsSchedule` — 옛 예정일 행을 거르는 선택 규칙을 그대로 쓴다).
     * 없으면 `null`.
     */
    readonly nextEarningsDate: string | null;
}

export type FundamentalFact =
    | {
          readonly kind: 'cashRunway';
          readonly cash: number;
          readonly annualBurn: number;
          readonly years: number;
          readonly reportedCurrency: string | null;
          readonly asOf: string;
      }
    | {
          readonly kind: 'dilutionFilings';
          readonly filings: number;
          readonly atmFilings: number;
          readonly shelfFilings: number;
          readonly windowDays: number;
          readonly latestFilingDate: string | null;
      }
    | {
          readonly kind: 'insiderTrades';
          readonly buyCount: number;
          readonly sellCount: number;
          readonly buyValueUsd: number;
          readonly sellValueUsd: number;
          readonly windowDays: number;
      }
    | {
          readonly kind: 'insiderReportsKr';
          readonly reports: number;
          readonly reporters: number;
          readonly netSharesChange: number;
          readonly latestReceiptDate: string | null;
      }
    | {
          readonly kind: 'shortInterest';
          readonly pctFloat: number | null;
          readonly daysToCover: number | null;
          readonly settlementDate: string | null;
      }
    | {
          readonly kind: 'priceTarget';
          readonly consensus: number;
          readonly low: number | null;
          readonly high: number | null;
          readonly buy: number;
          readonly hold: number;
          readonly sell: number;
          /** 최근 3개월 새 목표가가 없고 1년 안 목표가만 있으면 `true`. */
          readonly stale: boolean;
      }
    | {
          readonly kind: 'epsStreak';
          readonly direction: 'beat' | 'miss';
          readonly count: number;
          readonly latestDate: string;
      }
    | {
          readonly kind: 'nextEarnings';
          readonly date: string;
          readonly daysUntil: number;
          /** 직전 발표의 EPS 서프라이즈(%) — 예상치가 0이거나 없으면 `null`. */
          readonly lastSurprisePct: number | null;
          readonly lastDate: string | null;
      };

export type FundamentalFactKind = FundamentalFact['kind'];

/** 사실별 노출 기준 — 바꾸면 그려지는 사실 수, 곧 색인 게이트가 바뀐다. */
export const FUNDAMENTAL_FACT_THRESHOLDS = {
    /** 공매도 잔고가 유통주식의 이 %(core 단위, 10 = 10%) 이상이면 보인다. */
    shortPctFloatMin: 5,
    /** 상환일수(days to cover)가 이 값 이상이면 보인다. */
    daysToCoverMin: 5,
    /** 이 횟수 이상 연속으로 예상을 넘거나 밑돌면 보인다. */
    epsStreakMin: 2,
    /**
     * 다음 실적이 이 일수 안이면 보인다. 한 분기(약 91일)보다 길게 둔다 — 60일처럼 짧으면 실적
     * 직후마다 이 사실이 빠져, 사실이 딱 3개인 종목의 색인이 분기마다 켜졌다 꺼진다.
     */
    nextEarningsWithinDays: 100,
} as const;

/** 그려진 사실이 이 수 이상이어야 펀더멘털 탭을 색인한다(2026-11-07 결정, 2~4주 측정 후 조정). */
export const FUNDAMENTAL_INDEX_MIN_FACTS = 3;

export interface FundamentalFactsResult {
    readonly facts: readonly FundamentalFact[];
    /** 모든 입력원이 정상 응답했는가. `false`면 `indexable`도 `false`다(degraded = noindex 관례). */
    readonly complete: boolean;
    readonly indexable: boolean;
}
