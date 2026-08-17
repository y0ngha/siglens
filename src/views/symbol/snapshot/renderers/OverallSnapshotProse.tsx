import type { OverallScenarioName } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';
import { LIVE_ANALYSIS_CROSS_REF } from '../lib/liveAnalysisCrossRef';

interface OverallSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmOverall`(→`submitOverallAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: OverallAnalysisResponse`를
     * 그대로 저장, `src/app/api/cron/seo-prewarm/harvest.ts:91`). 여기서 다시
     * 방어적으로 좁힌다.
     *
     * `TechnicalSnapshotProse`와 달리 이 값은 core `filterAnalysisResult`의
     * 대상이 아니다 — core `pollOverallAnalysis`/`peekOverallAnalysisCache`
     * JSDoc이 명시하듯 `OverallAnalysisResponse`는 필드별 게이팅 detail이
     * 없는 synthesized headline/bullet narrative라 free tier로 pre-warm해도
     * 전 필드가 그대로 채워진다(타임프레임 게이트만 적용, 필드 마스킹 없음).
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
}

// Guard-only label map — the scenario section headings below are hardcoded
// Korean strings ("강세 시나리오" / ...), not derived from this map, but its
// keys must cover exactly `OverallScenarioName`'s members (PR #698 round-2
// review FIX 3: converted from an `Array.includes` membership check to the
// shared `createEnumGuard` factory — semantics are equivalent, both reject
// any string outside {bullish, neutral, bearish}). See createEnumGuard's
// JSDoc for the Object.hasOwn / prototype-chain rationale.
const SCENARIO_NAME_LABEL: Record<OverallScenarioName, string> = {
    bullish: '강세',
    neutral: '중립',
    bearish: '약세',
};

const isScenarioName = createEnumGuard(SCENARIO_NAME_LABEL);

interface NarrowedScenario {
    name: OverallScenarioName;
    triggerConditionKo: string;
    priceRangeKo: string;
}

function narrowScenario(value: unknown): NarrowedScenario | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!isScenarioName(record.name)) return null;

    const triggerConditionKo =
        typeof record.triggerConditionKo === 'string'
            ? stripSnapshotMarkdown(record.triggerConditionKo)
            : '';
    const priceRangeKo =
        typeof record.priceRangeKo === 'string'
            ? stripSnapshotMarkdown(record.priceRangeKo)
            : '';

    return { name: record.name, triggerConditionKo, priceRangeKo };
}

/**
 * 시나리오 하나를 bullet 텍스트로 합성한다. trigger/priceRange가 둘 다
 * 비어있으면(정규화 실패·LLM 누락) `null`을 돌려줘 호출부가 그 항목을
 * 건너뛰게 한다.
 */
function formatScenarioBullet(scenario: NarrowedScenario): string | null {
    const trigger = scenario.triggerConditionKo.trim();
    const priceRange = scenario.priceRangeKo.trim();

    if (trigger.length === 0 && priceRange.length === 0) return null;
    if (trigger.length > 0 && priceRange.length > 0) {
        return `${trigger} (예상 가격대: ${priceRange})`;
    }
    return trigger.length > 0 ? trigger : `예상 가격대: ${priceRange}`;
}

interface NarrowedOverallContent {
    headlineKo: string;
    integratedConclusionKo: string;
    bullishBullets: string[];
    neutralBullets: string[];
    bearishBullets: string[];
    riskFactorsKo: string[];
    technicalBulletsKo: string[];
    fundamentalBulletsKo: string[];
    newsBulletsKo: string[];
    optionsBulletsKo: string[];
    financialsBulletsKo: string[];
}

/**
 * `content`를 overall 결과 모양으로 좁힌다.
 *
 * core `OverallAnalysisResponse`(`node_modules/@y0ngha/siglens-core/dist/domain/types.d.ts`)는
 * `bullishBulletsKo`/`bearishBulletsKo` 같은 전용 배열 필드가 없다 — 대신
 * `scenarios: OverallScenario[]`(각 `{ name: 'bullish'|'neutral'|'bearish',
 * triggerConditionKo, priceRangeKo }`)로 강세/중립/약세 세 시나리오를 표현한다.
 * 이 렌더러는 세 시나리오 전부를 trigger+priceRange를 합성한 bullet 문자열로
 * 변환한다(audit fix — 이전에는 `neutral`을 드롭했다. 대체 대상인
 * `OverallFactsSummary`가 세 시나리오 전부를 렌더하므로, neutral을 빼면
 * 대체 전보다 텍스트가 줄어드는 회귀였다). `riskFactorsKo`도
 * `OverallFactsSummary`와 동일하게 위험 요인 목록으로 노출한다.
 *
 * `technicalBulletsKo`/`fundamentalBulletsKo`/`newsBulletsKo`/
 * `optionsBulletsKo`/`financialsBulletsKo`도 좁힌다(audit fix FIX 2) — core
 * `OverallAnalysisResponse`는 이 다섯 필드를 REQUIRED 배열로 선언하고
 * (`responseSchemas.js`), overall도 다른 필드들과 동일하게 tier 마스킹
 * 대상이 아니므로(위 JSDoc) free tier pre-warm에도 전부 채워진다. 이전
 * 렌더러는 이 다섯 배열을 전혀 읽지 않아 심볼당 400~900자 규모의 크롤
 * 가능 텍스트가 저장은 되고도 버려지고 있었다.
 */
function narrowOverallContent(content: unknown): NarrowedOverallContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const headlineKo =
        typeof record.headlineKo === 'string'
            ? stripSnapshotMarkdown(record.headlineKo).trim()
            : '';
    const integratedConclusionKo =
        typeof record.integratedConclusionKo === 'string'
            ? stripSnapshotMarkdown(record.integratedConclusionKo).trim()
            : '';

    const scenarios = Array.isArray(record.scenarios)
        ? record.scenarios.flatMap(raw => {
              const scenario = narrowScenario(raw);
              return scenario === null ? [] : [scenario];
          })
        : [];

    // 이름별 불릿 추출 — 시나리오 배열을 이름당 한 번씩만 순회한다.
    const bulletsOf = (name: string): string[] =>
        scenarios.flatMap(scenario => {
            if (scenario.name !== name) return [];
            const bullet = formatScenarioBullet(scenario);
            return bullet === null ? [] : [bullet];
        });

    const bullishBullets = bulletsOf('bullish');
    const neutralBullets = bulletsOf('neutral');
    const bearishBullets = bulletsOf('bearish');

    const riskFactorsKo = narrowStringArray(record.riskFactorsKo);
    const technicalBulletsKo = narrowStringArray(record.technicalBulletsKo);
    const fundamentalBulletsKo = narrowStringArray(record.fundamentalBulletsKo);
    const newsBulletsKo = narrowStringArray(record.newsBulletsKo);
    const optionsBulletsKo = narrowStringArray(record.optionsBulletsKo);
    const financialsBulletsKo = narrowStringArray(record.financialsBulletsKo);

    if (
        headlineKo.length === 0 &&
        integratedConclusionKo.length === 0 &&
        bullishBullets.length === 0 &&
        neutralBullets.length === 0 &&
        bearishBullets.length === 0 &&
        riskFactorsKo.length === 0 &&
        technicalBulletsKo.length === 0 &&
        fundamentalBulletsKo.length === 0 &&
        newsBulletsKo.length === 0 &&
        optionsBulletsKo.length === 0 &&
        financialsBulletsKo.length === 0
    ) {
        return null;
    }

    return {
        headlineKo,
        integratedConclusionKo,
        technicalBulletsKo,
        fundamentalBulletsKo,
        newsBulletsKo,
        optionsBulletsKo,
        financialsBulletsKo,
        bullishBullets,
        neutralBullets,
        bearishBullets,
        riskFactorsKo,
    };
}

/**
 * `overall/page.tsx`가 `<OverallSnapshotProse>`를 렌더할지(스냅샷 프로즈)
 * 아니면 기존 peek/placeholder 체인(`OverallFactsSummary`/
 * `OverallFactualFallback`)으로 폴백할지 판단하는 예측기(audit fix FIX 1b).
 *
 * 페이지는 이전에 "행 존재 여부"(`overallSnapshot !== undefined`)로
 * 분기했다 — 그러나 행은 있지만 `content`가 `narrowOverallContent`를
 * 통과하지 못하면(malformed JSONB) `OverallSnapshotProse`가 `null`을
 * 반환하는데, 페이지는 이미 peek 분기를 건너뛴 상태라 섹션 전체가
 * 아무것도 렌더하지 않는 회귀가 생긴다 — 오늘의 baseline(스냅샷 없을 때
 * peek/placeholder를 보여주던 것)보다 더 나쁜 결과다.
 *
 * `narrowOverallContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로
 * 다른 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasOverallProse(content: unknown): boolean {
    return narrowOverallContent(content) !== null;
}

/**
 * SEO pre-warm 스냅샷의 overall 탭 프로즈 렌더러 — `TechnicalSnapshotProse`가
 * 세운 패턴(spec 2026-07-24 Task 4)을 그대로 따르는 두 번째 탭 렌더러(Task 5).
 * `headlineKo`를 리드 문구로, `integratedConclusionKo`를 문단으로(`\n` 기준
 * 분리 — technical `summary`의 토픽 구분 관례와 동일하게 방어적으로 처리),
 * 강세/중립/약세 시나리오와 위험 요인을 각각 라벨 붙은 목록으로 렌더한다
 * (audit fix — 이전에는 neutral 시나리오와 riskFactorsKo를 드롭해 이 렌더러가
 * 대체하는 `OverallFactsSummary`보다 텍스트가 적었다).
 *
 * `technicalBulletsKo`/`fundamentalBulletsKo`/`newsBulletsKo`/
 * `optionsBulletsKo`/`financialsBulletsKo`도 각각 라벨 붙은 목록(기술적
 * 분석/펀더멘털/뉴스/옵션/재무제표)으로 렌더한다(audit fix FIX 2) — 배열이
 * 비어있으면 해당 섹션 헤딩 자체를 렌더하지 않는다(다른 목록 섹션들과
 * 동일한 "값 있을 때만" 계약).
 *
 * 모든 프로즈 소스(headline/conclusion/네 시나리오/위험 요인/4축 bullet
 * 다섯 배열)가 값이 없으면 아무것도 렌더하지 않아 — 빈 셸 없이 — 호출부가
 * 기존 placeholder로 폴백하도록 한다(위 `hasOverallProse`가 그 분기를
 * 담당). UA 분기 없음 — 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function OverallSnapshotProse({
    content,
    symbol,
    displayName,
    generatedAt,
}: OverallSnapshotProseProps) {
    const narrowed = narrowOverallContent(content);
    if (narrowed === null) return null;

    const conclusionParagraphs = narrowed.integratedConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title="종합 분석 결론"
            displayName={displayName}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {/* 근거는 LIVE_ANALYSIS_CROSS_REF JSDoc 참고 — 두 탭이 동일 문구를 쓴다. */}
                <p className="text-xs text-secondary-400">
                    {LIVE_ANALYSIS_CROSS_REF}
                </p>
                {narrowed.headlineKo.length > 0 && (
                    <p className="font-medium text-secondary-200">
                        {narrowed.headlineKo}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                <SnapshotBulletList
                    title="기술적 분석"
                    symbol={symbol}
                    ariaSuffix="기술적 분석"
                    items={narrowed.technicalBulletsKo}
                    keyPrefix="technical-bullet"
                />
                <SnapshotBulletList
                    title="펀더멘털"
                    symbol={symbol}
                    ariaSuffix="펀더멘털"
                    items={narrowed.fundamentalBulletsKo}
                    keyPrefix="fundamental-bullet"
                />
                <SnapshotBulletList
                    title="뉴스"
                    symbol={symbol}
                    ariaSuffix="뉴스"
                    items={narrowed.newsBulletsKo}
                    keyPrefix="news-bullet"
                />
                <SnapshotBulletList
                    title="옵션"
                    symbol={symbol}
                    ariaSuffix="옵션"
                    items={narrowed.optionsBulletsKo}
                    keyPrefix="options-bullet"
                />
                <SnapshotBulletList
                    title="재무제표"
                    symbol={symbol}
                    ariaSuffix="재무제표"
                    items={narrowed.financialsBulletsKo}
                    keyPrefix="financials-bullet"
                />

                <SnapshotBulletList
                    title="강세 시나리오"
                    symbol={symbol}
                    ariaSuffix="강세 시나리오"
                    items={narrowed.bullishBullets}
                    keyPrefix="bullish"
                />
                <SnapshotBulletList
                    title="중립 시나리오"
                    symbol={symbol}
                    ariaSuffix="중립 시나리오"
                    items={narrowed.neutralBullets}
                    keyPrefix="neutral"
                />
                <SnapshotBulletList
                    title="약세 시나리오"
                    symbol={symbol}
                    ariaSuffix="약세 시나리오"
                    items={narrowed.bearishBullets}
                    keyPrefix="bearish"
                />
                <SnapshotBulletList
                    title="위험 요인"
                    symbol={symbol}
                    ariaSuffix="위험 요인"
                    items={narrowed.riskFactorsKo}
                    keyPrefix="risk"
                />
            </div>
        </SnapshotSummarySection>
    );
}
