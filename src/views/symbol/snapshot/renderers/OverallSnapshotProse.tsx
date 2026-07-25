import type { OverallScenarioName } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

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
}

const VALID_SCENARIO_NAMES: readonly OverallScenarioName[] = [
    'bullish',
    'neutral',
    'bearish',
];

function isScenarioName(value: unknown): value is OverallScenarioName {
    return (
        typeof value === 'string' &&
        (VALID_SCENARIO_NAMES as readonly string[]).includes(value)
    );
}

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
            ? record.triggerConditionKo
            : '';
    const priceRangeKo =
        typeof record.priceRangeKo === 'string' ? record.priceRangeKo : '';

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
 */
function narrowOverallContent(content: unknown): NarrowedOverallContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const headlineKo =
        typeof record.headlineKo === 'string' ? record.headlineKo.trim() : '';
    const integratedConclusionKo =
        typeof record.integratedConclusionKo === 'string'
            ? record.integratedConclusionKo.trim()
            : '';

    const scenarios = Array.isArray(record.scenarios)
        ? record.scenarios.map(narrowScenario).filter(s => s !== null)
        : [];

    const bullishBullets = scenarios
        .filter(s => s.name === 'bullish')
        .map(formatScenarioBullet)
        .filter((bullet): bullet is string => bullet !== null);
    const neutralBullets = scenarios
        .filter(s => s.name === 'neutral')
        .map(formatScenarioBullet)
        .filter((bullet): bullet is string => bullet !== null);
    const bearishBullets = scenarios
        .filter(s => s.name === 'bearish')
        .map(formatScenarioBullet)
        .filter((bullet): bullet is string => bullet !== null);

    const riskFactorsKo = Array.isArray(record.riskFactorsKo)
        ? record.riskFactorsKo.filter(
              (item): item is string => typeof item === 'string'
          )
        : [];

    if (
        headlineKo.length === 0 &&
        integratedConclusionKo.length === 0 &&
        bullishBullets.length === 0 &&
        neutralBullets.length === 0 &&
        bearishBullets.length === 0 &&
        riskFactorsKo.length === 0
    ) {
        return null;
    }

    return {
        headlineKo,
        integratedConclusionKo,
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
 * 다섯 프로즈 소스(headline/conclusion/강세 목록/중립 목록/약세 목록) 모두와
 * riskFactorsKo가 값이 없으면 아무것도 렌더하지 않아 — 빈 셸 없이 — 호출부가
 * 기존 placeholder로 폴백하도록 한다(위 `hasOverallProse`가 그 분기를
 * 담당). UA 분기 없음 — 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function OverallSnapshotProse({
    content,
    symbol,
    displayName,
}: OverallSnapshotProseProps) {
    const narrowed = narrowOverallContent(content);
    if (narrowed === null) return null;

    const conclusionParagraphs = narrowed.integratedConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection displayName={displayName}>
            <div className="text-secondary-300 space-y-4 text-sm leading-6">
                {narrowed.headlineKo.length > 0 && (
                    <p className="text-secondary-200 font-medium">
                        {narrowed.headlineKo}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map(line => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                )}

                {narrowed.bullishBullets.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            강세 시나리오
                        </h3>
                        <ul
                            aria-label={`${symbol} 강세 시나리오 목록`}
                            className="space-y-1"
                        >
                            {narrowed.bullishBullets.map(bullet => (
                                <li key={bullet} className="flex gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.neutralBullets.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            중립 시나리오
                        </h3>
                        <ul
                            aria-label={`${symbol} 중립 시나리오 목록`}
                            className="space-y-1"
                        >
                            {narrowed.neutralBullets.map(bullet => (
                                <li key={bullet} className="flex gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.bearishBullets.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            약세 시나리오
                        </h3>
                        <ul
                            aria-label={`${symbol} 약세 시나리오 목록`}
                            className="space-y-1"
                        >
                            {narrowed.bearishBullets.map(bullet => (
                                <li key={bullet} className="flex gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {bullet}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.riskFactorsKo.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            위험 요인
                        </h3>
                        <ul
                            aria-label={`${symbol} 위험 요인 목록`}
                            className="space-y-1"
                        >
                            {narrowed.riskFactorsKo.map((risk, i) => (
                                <li
                                    key={`risk-${i}-${risk}`}
                                    className="flex gap-2"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {risk}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
