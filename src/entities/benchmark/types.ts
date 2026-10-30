/**
 * 벤치마크 공개 데이터의 형태. 측정·채점 결과를 `benchmark/publish/export.py`가 이 타입으로
 * 내보내고(`data/release-<round>.json`), 화면은 이 타입만 본다.
 *
 * 문항·답변 원문은 한국어다(측정을 한국어로 했다). 숫자 점수는 모두 객관 점수(λ=1)이거나
 * 중립 심사위원의 0~1 점수다 — 어느 쪽인지는 필드 JSDoc이 말한다.
 */

/** 문항 난이도 구간. L1~L3은 객관 채점, L4·L5는 중립 심사위원이 채점한다. */
export type BenchmarkLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** 객관 채점 레벨. 점수표 열과 데이터 검증이 같은 목록을 쓴다. */
export const BENCHMARK_OBJECTIVE_LEVELS = ['L1', 'L2', 'L3'] as const;
export type BenchmarkObjectiveLevel =
    (typeof BENCHMARK_OBJECTIVE_LEVELS)[number];

/** 중립 심사위원이 채점하는 레벨. */
export const BENCHMARK_JUDGED_LEVELS = ['L4', 'L5'] as const;
export type BenchmarkJudgedLevel = (typeof BENCHMARK_JUDGED_LEVELS)[number];

/** 모든 레벨, 쉬운 구간부터. 문항 level 검증과 필터 순서에 쓴다. */
export const BENCHMARK_LEVELS: readonly BenchmarkLevel[] = [
    ...BENCHMARK_OBJECTIVE_LEVELS,
    ...BENCHMARK_JUDGED_LEVELS,
];

/** 문항 시장 구분(미국·한국). */
export const BENCHMARK_MARKETS = ['us', 'kr'] as const;
export type BenchmarkMarket = (typeof BENCHMARK_MARKETS)[number];

/** 점수표가 따로 집계하는 부분집합 키. */
export const BENCHMARK_SUBSETS = ['noTool', 'heldOut'] as const;
/** noTool = 전용 도구가 없는 문항(×), heldOut = 설계 때 보지 않은 문항(H). */
export type BenchmarkSubset = (typeof BENCHMARK_SUBSETS)[number];

/**
 * 문항 하나에 대한 대상 하나의 판정. 객관 문항은 점수에서 정한다 — 모든 부분을 맞히면
 * `correct`, 모두 틀리면 `incorrect`, 모두 답하지 않으면 `not_attempted`, 그 밖(일부만
 * 맞힘·부분 점수)은 `partial`. L4·L5는 0~1 심사 점수 구간에서 정한다.
 */
export const BENCHMARK_LABELS = [
    'correct',
    'partial',
    'incorrect',
    'not_attempted',
    'excluded',
    'pending',
] as const;
export type BenchmarkLabel = (typeof BENCHMARK_LABELS)[number];

/** 비교의 주체(SiglensAI)가 데이터 안에서 쓰는 대상 id. 헤드라인은 이 대상 대 나머지다. */
export const BENCHMARK_SUBJECT_ID = 'siglens';

/**
 * 화면 필터가 "필터 없음"으로 쓰는 예약어(URL에는 싣지 않는다). 풀·템플릿 id가 이 값이면
 * 그 항목을 고르는 것과 필터를 푸는 것을 구분할 수 없으므로 데이터 검증이 거부한다.
 */
export const BENCHMARK_FILTER_ALL = 'all';

export interface BenchmarkTarget {
    /** 데이터 안의 키. 점수표·문항 결과가 이 id로 대상을 가리킨다. */
    readonly id: string;
    /** 화면에 쓰는 이름. */
    readonly label: string;
    /** 실제로 호출한 모델 식별자. */
    readonly model: string;
    /** 같은 내부 모델에 도구 없이 물은 기준선인가(헤드라인 비교 대상이 아니다). */
    readonly isBaseline: boolean;
}

/** SiglensAI와 대상 하나의 점수 차. */
export interface BenchmarkContrast {
    /** 비교 상대 대상 id. */
    readonly target: string;
    /** SiglensAI 점수 − 상대 점수(객관 점수, λ=1). */
    readonly diff: number;
    /** 95% 신뢰구간(2단계 클러스터 부트스트랩). */
    readonly ci95: readonly [number, number];
    /** Holm 보정 p값. 기준선처럼 검정하지 않은 비교는 null. */
    readonly pHolm: number | null;
    /** 비교에 쓴 문항 수. */
    readonly n: number;
}

/** 대상 id → 평균 점수. 해당 칸에 문항이 없으면 null. */
export type BenchmarkScoreByTarget = Readonly<Record<string, number | null>>;

export interface BenchmarkBreakdown {
    /** 객관 점수(λ=1)의 레벨별 평균. */
    readonly byLevel: Readonly<
        Record<BenchmarkObjectiveLevel, BenchmarkScoreByTarget>
    >;
    readonly byMarket: Readonly<
        Record<BenchmarkMarket, BenchmarkScoreByTarget>
    >;
    readonly bySubset: Readonly<
        Record<BenchmarkSubset, BenchmarkScoreByTarget>
    >;
    /** L4·L5 중립 심사위원 평균(0~1). */
    readonly judged: Readonly<
        Record<BenchmarkJudgedLevel, BenchmarkScoreByTarget>
    >;
    /**
     * primary 객관 문항 전체의 평균 점수(λ=1). 대상마다 답이 기록된 문항만 평균하므로
     * 제외 문항이 있는 대상은 분모가 다르다. 헤드라인 점수 차는 두 대상이 모두 답한 문항으로
     * 따로 계산하므로, 이 값끼리의 차와 같지 않을 수 있다.
     */
    readonly overall: BenchmarkScoreByTarget;
    /** primary 객관 문항의 대상별 판정 개수(문항 단위). */
    readonly labelCounts: Readonly<
        Record<string, Readonly<Record<BenchmarkLabel, number>>>
    >;
}

export interface BenchmarkMethodology {
    /** 풀 id → 문항 수. */
    readonly poolSizes: Readonly<Record<string, number>>;
    /** 같은 문항을 반복해 물은 횟수. */
    readonly rounds: number;
    /** 오답 감점 λ. */
    readonly lambda: number;
    /** 정답 출처의 잠정값과 공식값이 달라 재계산한 문항 수. 모르면 null. */
    readonly vendorMismatchCount: number | null;
    /** 측정한 SiglensAI 릴리스(예: `v0.110.0`). */
    readonly subjectVersion: string;
    /** SiglensAI를 측정한 날(YYYY-MM-DD). 다른 대상은 `measuredAt`에 측정했다. */
    readonly subjectMeasuredAt: string;
}

export interface BenchmarkPrereg {
    /** 사전 등록 manifest 전체의 SHA-256(hex). */
    readonly combinedSha256: string;
    readonly gistUrl: string;
    /** OpenTimestamps 증명 파일의 사이트 경로. */
    readonly otsPath: string;
}

export interface BenchmarkDownloads {
    /** 전체 원자료 zip의 사이트 경로. */
    readonly zipPath: string;
}

export interface BenchmarkItemResult {
    readonly label: BenchmarkLabel;
    /** 문항 점수. 객관 문항은 +1/0/−λ, L4·L5는 0~1. 아직 없으면 null. */
    readonly score: number | null;
}

/** 문항 목록 한 줄. 화면의 목록·필터가 쓰고 서버에서 렌더된다. */
export interface BenchmarkItem {
    readonly qid: string;
    readonly pool: string;
    readonly level: BenchmarkLevel;
    readonly market: BenchmarkMarket;
    readonly template: string;
    /** 한국어 질문. */
    readonly question: string;
    /** 한국어 정답 요약(수치와 출처). */
    readonly truthSummary: string;
    /** 대상 id → 판정. */
    readonly results: Readonly<Record<string, BenchmarkItemResult>>;
}

export interface BenchmarkRelease {
    /** 측정 회차 id (예: `2026-10`). 정적 파일 경로의 디렉터리 이름이다. */
    readonly round: string;
    /** 측정일, ISO 8601 날짜. */
    readonly measuredAt: string;
    /** 채점 확정일, ISO 8601 날짜. JSON-LD `dateModified`가 된다. */
    readonly scoredAt: string;
    readonly targets: readonly BenchmarkTarget[];
    /** SiglensAI 대 각 경쟁 모델 헤드라인 비교. */
    readonly headline: readonly BenchmarkContrast[];
    readonly breakdown: BenchmarkBreakdown;
    readonly methodology: BenchmarkMethodology;
    readonly prereg: BenchmarkPrereg;
    readonly downloads: BenchmarkDownloads;
    readonly items: readonly BenchmarkItem[];
}

/** 대상 하나가 한 회차에서 낸 답변과 그 채점. */
export interface BenchmarkItemRoundDetail {
    /** 1부터 시작하는 반복 회차. */
    readonly round: number;
    readonly answerText: string;
    /** 답변에서 추출기가 뽑은 값. */
    readonly extracted: readonly BenchmarkExtractedValue[];
}

export interface BenchmarkExtractedValue {
    /** 정답이 여러 부분일 때 그 부분의 이름. */
    readonly part: string;
    readonly value: string | null;
    readonly verdict: BenchmarkLabel;
    /** 판정 근거. */
    readonly reason: string | null;
}

export interface BenchmarkJudgement {
    readonly target: string;
    readonly level: BenchmarkJudgedLevel;
    readonly judge: string;
    /** 이 심사가 채점한 답변의 반복 회차(1부터). 같은 심사위원이 회차마다 따로 채점한다. */
    readonly round: number;
    /** 0~1. */
    readonly score: number;
    readonly why: string;
}

/** `public/benchmark/<round>/items/<qid>.json`. 펼칠 때 지연 로드한다. */
export interface BenchmarkItemDetail {
    readonly qid: string;
    /** 대상 id → 회차별 답변. */
    readonly targets: Readonly<
        Record<string, readonly BenchmarkItemRoundDetail[]>
    >;
    /** L4·L5 문항에서만 있다. */
    readonly judgements: readonly BenchmarkJudgement[];
}
