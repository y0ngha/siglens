import type { Trend } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { LIVE_ANALYSIS_CROSS_REF } from '../lib/liveAnalysisCrossRef';

interface TechnicalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `runAnalysis`의 `status==='cached'` 분기에서 얻은
     * `result.result: AnalysisResponse | FilteredAnalysisResponse`를 그대로
     * 저장, `src/app/api/cron/seo-prewarm/harvest.ts:91`). 여기서 다시
     * 방어적으로 좁힌다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
}

const TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isTrend = createEnumGuard(TREND_LABEL);

interface NarrowedSkillDetection {
    /** `patternName` (pattern) or `strategyName` (strategy) — the skill identifier. */
    name: string;
    trend: Trend | null;
    summary: string;
}

function narrowSkillDetection(
    value: unknown,
    nameField: 'patternName' | 'strategyName'
): NarrowedSkillDetection | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const summary =
        typeof record.summary === 'string'
            ? stripSnapshotMarkdown(record.summary).trim()
            : '';
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
 * `content`를 technical 결과 모양으로 좁힌다.
 *
 * pre-warm은 free tier로 제출되므로(`prewarmSubmits.ts`의
 * `tierContext: { tier: 'free' }`) 저장되는 값은 사실상 core
 * `filterAnalysisResult`를 거친 `FilteredAnalysisResponse`다.
 *
 * free tier의 `infoDepth`(core `FREE_INFO_DEPTH`)는 `'direction'`·
 * `'summary'`·`'skill_detection'` 세 depth를 허용한다 — **이전 JSDoc이
 * "summary/trend 두 필드만 남는다"고 적었던 건 사실이 아니었다(audit fix
 * FIX 3)**. `skill_detection`이 게이팅하는 `patternSummaries`/
 * `strategyResults`는 `filterAnalysisResult.js`에서 free tier에도
 * 마스킹 없이 그대로 통과한다 — 각 항목의 `confidenceWeight`만 별도
 * depth(`'confidence'`, free tier 미포함)에 의해 0으로 치환될 뿐, 항목
 * 자체(`patternName`/`strategyName`, `trend`, Korean `summary`)는 전부
 * 값을 갖는다. `keyLevels`/`priceTargets`/`candlePatterns`/`trendlines`
 * 등 다른 depth가 게이팅하는 필드만 `null`이다. 이 렌더러는 `summary`/
 * `trend`에 더해 이 두 배열도 프로즈 소스로 사용한다.
 */
function narrowTechnicalContent(
    content: unknown
): NarrowedTechnicalContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
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
 * `technical/page.tsx`(차트 페이지, `src/app/[symbol]/page.tsx`)가 이 탭의
 * 스냅샷 행을 indexable 신호로 쓸지 판단하는 예측기(audit fix FIX 1 —
 * `OverallSnapshotProse.hasOverallProse` 패턴). 행이 존재해도 `content`가
 * `narrowTechnicalContent`를 통과 못 하면(malformed JSONB) 렌더러가 `null`을
 * 반환해 본문은 얇은 degraded shell인데 메타데이터만 indexable로 마킹되는
 * 회귀를 막는다 — `narrowTechnicalContent`를 그대로 재사용해 이 예측기와
 * 컴포넌트가 서로 다른 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasTechnicalProse(content: unknown): boolean {
    return narrowTechnicalContent(content) !== null;
}

/**
 * SEO pre-warm 스냅샷의 technical 탭 프로즈 렌더러 — 7개 탭 렌더러가 따를
 * 첫 패턴(spec 2026-07-24 Task 4). `summary`(Korean 멀티토픽 요약, `\n`으로
 * 토픽 구분)를 문단으로, `trend`가 있으면 방향성 리드 문구를 렌더한다.
 *
 * `patternSummaries`/`strategyResults`를 각각 "차트 패턴"/"전략 시그널"
 * 라벨 붙은 목록으로 렌더한다(audit fix FIX 3) — 항목마다 패턴/전략 이름과
 * 방향성(있으면), Korean `summary`를 보여준다.
 *
 * `summary`/`patternSummaries`/`strategyResults` 세 프로즈 소스 모두 값이
 * 없으면 아무것도 렌더하지 않아 — 빈 셸 없이 — 호출부가 기존
 * placeholder(예: TechnicalFactsSummary)로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function TechnicalSnapshotProse({
    content,
    symbol,
    displayName,
    generatedAt,
}: TechnicalSnapshotProseProps) {
    const narrowed = narrowTechnicalContent(content);
    if (narrowed === null) return null;

    const paragraphs = narrowed.summary
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title="기술적 분석 요약"
            displayName={displayName}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {/* 근거는 LIVE_ANALYSIS_CROSS_REF JSDoc 참고 — 두 탭이 동일 문구를 쓴다. */}
                <p className="text-xs text-secondary-400">
                    {LIVE_ANALYSIS_CROSS_REF}
                </p>
                <div className="space-y-2">
                    {narrowed.trend !== null && (
                        <p className="font-medium text-secondary-200">
                            {symbol} 기술적 방향성:{' '}
                            {TREND_LABEL[narrowed.trend]}
                        </p>
                    )}
                    {paragraphs.map((line, i) => (
                        <p key={`line-${i}-${line}`}>{line}</p>
                    ))}
                </div>

                {narrowed.patternSummaries.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            차트 패턴
                        </h3>
                        <ul
                            role="list"
                            aria-label={`${symbol} 차트 패턴 목록`}
                            className="space-y-2"
                        >
                            {narrowed.patternSummaries.map(p => (
                                <li key={`${p.name}-${p.summary.slice(0, 32)}`}>
                                    <span className="font-medium text-secondary-200">
                                        {p.name}
                                        {p.trend !== null &&
                                            ` (${TREND_LABEL[p.trend]})`}
                                    </span>
                                    <p>{p.summary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.strategyResults.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            전략 시그널
                        </h3>
                        <ul
                            role="list"
                            aria-label={`${symbol} 전략 시그널 목록`}
                            className="space-y-2"
                        >
                            {narrowed.strategyResults.map(s => (
                                <li key={`${s.name}-${s.summary.slice(0, 32)}`}>
                                    <span className="font-medium text-secondary-200">
                                        {s.name}
                                        {s.trend !== null &&
                                            ` (${TREND_LABEL[s.trend]})`}
                                    </span>
                                    <p>{s.summary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
