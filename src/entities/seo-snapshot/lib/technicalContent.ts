import type { Trend } from '@y0ngha/siglens-core';
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
    };
}

interface NarrowedTechnicalContent {
    summary: string;
    trend: Trend | null;
    patternSummaries: NarrowedSkillDetection[];
    strategyResults: NarrowedSkillDetection[];
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

    const patternSummaries = Array.isArray(record.patternSummaries)
        ? record.patternSummaries
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
    return { summary, trend, patternSummaries, strategyResults };
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
