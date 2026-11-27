import type { CycleReading, CycleStage, Trend } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';

/** Trend → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const TREND_LABEL_KEY: Record<Trend, string> = {
    bullish: 'trend.bullish',
    bearish: 'trend.bearish',
    neutral: 'trend.neutral',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
const isTrend = createEnumGuard(TREND_LABEL_KEY);

interface NarrowedSkillDetection {
    /** 스킬 식별자 — 패턴이면 `patternName`, 전략이면 `strategyName`. */
    name: string;
    trend: Trend | null;
    summary: string;
    /**
     * core가 코드로 만든 대순환 카드의 구조화된 읽기. 있으면 `summary`는 영어 정본이라 렌더러가
     * 이 값을 독자 언어로 풀어 쓴다. 패턴·모델이 쓴 전략·옛 행은 `null`.
     */
    cycle: CycleReading | null;
}

const CYCLE_KINDS: ReadonlySet<unknown> = new Set(['ma_cycle', 'macd_cycle']);
const CYCLE_ROLES: ReadonlySet<unknown> = new Set(['short', 'medium', 'long']);
const CYCLE_SLOPES: ReadonlySet<unknown> = new Set([
    'rising',
    'falling',
    'flat',
]);

const isCycleStage = (value: unknown): value is CycleStage =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6;

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

/** 숫자만 담긴 레코드면 그대로, 하나라도 숫자가 아니면 `null`. */
function narrowNumberRecord(value: unknown): Record<string, number> | null {
    const record = asRecord(value);
    if (record === null) return null;
    const entries = Object.entries(record);
    return entries.every(([, v]) => isFiniteNumber(v))
        ? Object.fromEntries(entries.map(([k, v]) => [k, Number(v)]))
        : null;
}

/**
 * 저장된 JSONB의 `cycle`을 `CycleReading`으로 좁힌다. 한 필드라도 모양이 어긋나면 `null` —
 * 손상된 읽기를 추측해 고치지 않고 영어 정본(`summary`)이 아니라 일반 전략 줄로 물러난다.
 */
export function narrowCycleReading(value: unknown): CycleReading | null {
    const record = asRecord(value);
    if (record === null) return null;
    const { kind, stage, previousStage, barsInStage, progression } = record;
    const values = narrowNumberRecord(record.values);
    const slopesRecord = asRecord(record.slopes);
    if (
        !CYCLE_KINDS.has(kind) ||
        !isCycleStage(stage) ||
        !(previousStage === null || isCycleStage(previousStage)) ||
        !(
            barsInStage === null ||
            (isFiniteNumber(barsInStage) && barsInStage >= 0)
        ) ||
        !(
            progression === null ||
            progression === 'forward' ||
            progression === 'reverse'
        ) ||
        !isFiniteNumber(record.stageChanges) ||
        values === null ||
        slopesRecord === null
    ) {
        return null;
    }
    const slopeEntries = Object.entries(slopesRecord);
    if (
        !slopeEntries.every(([, v]) => v === null || CYCLE_SLOPES.has(v)) ||
        !(
            record.order === undefined ||
            (Array.isArray(record.order) &&
                record.order.every(role => CYCLE_ROLES.has(role)))
        )
    ) {
        return null;
    }
    // safe: 위에서 종류·단계·이력 필드·값·기울기·순서를 모두 `CycleReading`의 모양으로 검증했다.
    return record as unknown as CycleReading;
}

function narrowSkillDetection(
    value: unknown,
    nameField: 'patternName' | 'strategyName'
): NarrowedSkillDetection | null {
    const record = asRecord(value);
    if (record === null) return null;
    const summary = narrowCleanString(record.summary);
    if (summary.length === 0) return null;

    return {
        name: typeof record[nameField] === 'string' ? record[nameField] : '',
        trend: isTrend(record.trend) ? record.trend : null,
        summary,
        cycle:
            nameField === 'strategyName'
                ? narrowCycleReading(record.cycle)
                : null,
    };
}

interface NarrowedTechnicalContent {
    summary: string;
    trend: Trend | null;
    patternSummaries: NarrowedSkillDetection[];
    strategyResults: NarrowedSkillDetection[];
    /**
     * 분석이 만들어진 시각(분석 내용 안의 `analyzedAt`). 행의 `generatedAt`은 하베스트가 행을 다시 쓴 시각일 수
     * 있어 분석 시각이 아니다. 내용에 없거나 읽을 수 없으면 `null`.
     */
    analyzedAt: Date | null;
}

function narrowAnalyzedAt(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `content`를 technical 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * pre-warm은 free tier로 제출되므로(`prewarmSubmits.ts`의 `tierContext: { tier: 'free' }`)
 * 저장되는 값은 사실상 core `filterAnalysisResult`를 거친 `FilteredAnalysisResponse`다.
 *
 * free tier의 `infoDepth`(core `FREE_INFO_DEPTH`)는 `'direction'`·`'summary'`·
 * `'skill_detection'` 세 depth를 허용한다. `skill_detection`이 게이팅하는
 * `patternSummaries`/`strategyResults`는 `filterAnalysisResult.js`에서 free tier에도 마스킹
 * 없이 그대로 통과한다 — 각 항목의 `confidenceWeight`만 별도 depth(`'confidence'`, free tier
 * 미포함)에 의해 0으로 치환될 뿐, 항목 자체(`patternName`/`strategyName`, `trend`, 한국어
 * `summary`)는 전부 값을 갖는다. `keyLevels`/`priceTargets`/`candlePatterns`/`trendlines`
 * 등 다른 depth가 게이팅하는 필드만 `null`이다. 그래서 `summary`/`trend`에 더해 이 두 배열도
 * 산문 소스로 쓴다.
 */
export function narrowTechnicalContent(
    content: unknown
): NarrowedTechnicalContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const summary =
        typeof record.summary === 'string'
            ? stripSnapshotMarkdown(record.summary)
            : '';

    // 감지되지 않은 패턴 줄("이 패턴은 보이지 않아요")은 크롤러·메일에 내보낼 산문이 아니다.
    // 엔진이 자격을 인정한 후보에 대한 판정만 `patternSummaries`에 남지만(core), 옛 행과
    // 후보가 반려된 판정은 `detected: false`로 남아 있어 여기서 거른다.
    const patternSummaries = Array.isArray(record.patternSummaries)
        ? record.patternSummaries
              .filter(item => asRecord(item)?.detected === true)
              .map(item => narrowSkillDetection(item, 'patternName'))
              .filter((p): p is NarrowedSkillDetection => p !== null)
        : [];
    const strategyResults = Array.isArray(record.strategyResults)
        ? record.strategyResults
              .map(item => narrowSkillDetection(item, 'strategyName'))
              .filter((s): s is NarrowedSkillDetection => s !== null)
        : [];

    if (
        summary.trim().length === 0 &&
        patternSummaries.length === 0 &&
        strategyResults.length === 0
    ) {
        return null;
    }

    const trend = isTrend(record.trend) ? record.trend : null;
    return {
        summary,
        trend,
        patternSummaries,
        strategyResults,
        analyzedAt: narrowAnalyzedAt(record.analyzedAt),
    };
}

/**
 * 차트 페이지(`src/app/[locale]/[symbol]/page.tsx`)가 이 탭의 스냅샷 행을 indexable 신호로
 * 쓸지 판단하는 예측기. 행이 존재해도 `content`가 `narrowTechnicalContent`를 통과 못 하면
 * (손상된 JSONB) 렌더러가 `null`을 반환해 본문은 얇은 degraded shell인데 메타데이터만
 * indexable로 마킹되는데, 이를 막는다. 렌더러와 같은 `narrowTechnicalContent`를 쓰므로 둘이
 * 서로 다른 판단을 내릴 수 없다.
 */
export function hasTechnicalProse(content: unknown): boolean {
    return narrowTechnicalContent(content) !== null;
}
