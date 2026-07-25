import type { Trend } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

interface TechnicalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `submitAnalysis`의 `status==='cached'` 분기에서 얻은
     * `result.result: AnalysisResponse | FilteredAnalysisResponse`를 그대로
     * 저장, `src/app/api/cron/seo-prewarm/harvest.ts:91`). 여기서 다시
     * 방어적으로 좁힌다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
}

const TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

function isTrend(value: unknown): value is Trend {
    // Object.hasOwn (not `value in TREND_LABEL`) — `in` walks the prototype
    // chain, so `'__proto__' in TREND_LABEL` is true and `TREND_LABEL['__proto__']`
    // yields `Object.prototype`, which React throws on when rendered as a
    // child ("Objects are not valid as a React child") — a malformed JSONB
    // `trend` value could crash ISR generation (audit fix).
    return typeof value === 'string' && Object.hasOwn(TREND_LABEL, value);
}

interface NarrowedTechnicalContent {
    summary: string;
    trend: Trend | null;
}

/**
 * `content`를 technical 결과 모양으로 좁힌다.
 *
 * pre-warm은 free tier로 제출되므로(`prewarmSubmits.ts`의
 * `tierContext: { tier: 'free' }`) 저장되는 값은 사실상 core
 * `filterAnalysisResult`를 거친 `FilteredAnalysisResponse`다. free tier의
 * `infoDepth`는 `'summary'`·`'direction'` 두 depth를 허용하므로(core
 * `FREE_INFO_DEPTH`) 그 depth가 게이팅하는 필드 — `summary`(prose)와
 * `trend`(방향성, JS 필드명은 `trend`이지 `direction`이 아니다) — 만 값을
 * 갖고 나머지(`keyLevels`/`priceTargets`/...)는 `null`이다. 이 렌더러는
 * 그 두 필드만 사용한다.
 */
function narrowTechnicalContent(
    content: unknown
): NarrowedTechnicalContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const summary = record.summary;
    if (typeof summary !== 'string' || summary.trim().length === 0) {
        return null;
    }

    const trend = isTrend(record.trend) ? record.trend : null;
    return { summary, trend };
}

/**
 * SEO pre-warm 스냅샷의 technical 탭 프로즈 렌더러 — 7개 탭 렌더러가 따를
 * 첫 패턴(spec 2026-07-24 Task 4). `summary`(Korean 멀티토픽 요약, `\n`으로
 * 토픽 구분)를 문단으로, `trend`가 있으면 방향성 리드 문구를 렌더한다.
 *
 * `summary`가 없거나 비어 있으면(예: 스냅샷이 더 낮은 info-depth로만
 * 채워졌거나 아직 pre-warm되지 않은 경우) 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder(예: TechnicalFactsSummary)로 폴백하도록
 * 한다. UA 분기 없음 — 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function TechnicalSnapshotProse({
    content,
    symbol,
    displayName,
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
        >
            <div className="text-secondary-300 space-y-2 text-sm leading-6">
                {narrowed.trend !== null && (
                    <p className="text-secondary-200 font-medium">
                        {symbol} 기술적 방향성: {TREND_LABEL[narrowed.trend]}
                    </p>
                )}
                {paragraphs.map((line, i) => (
                    <p key={`line-${i}-${line}`}>{line}</p>
                ))}
            </div>
        </SnapshotSummarySection>
    );
}
