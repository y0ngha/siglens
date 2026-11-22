import {
    getAnalystEstimates,
    getCashFlowStatement,
    getFinancialScores,
    getIncomeStatementGrowth,
    getKeyMetricsTtm,
    getPriceTargetConsensus,
    getPriceTargetSummary,
    getProfile,
    getRatiosTtm,
    getStockPeers,
} from '@/app/[locale]/[symbol]/fundamental/fundamentalData';
import {
    targetGapPct,
    targetsDisagree,
} from '@/entities/analyst-views/lib/targetGap';
import { loadPageKrValuation } from '@/entities/kr-valuation/server/loadPageKrValuation';
import { loadAnalystEstimateTrend } from '@/entities/analyst-views/server/loadAnalystEstimateTrend';
import { loadAnalystTargetsSummary } from '@/entities/analyst-views/server/loadAnalystTargetsSummary';
import { readGradesSource } from '@/shared/api/fmp/gradesConsensusSource';
import {
    loadPageGradesConsensus,
    type PageGradesConsensus,
} from '@/shared/api/fmp/loadPageGradesConsensus';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { loadProfileDescription } from '@/app/[locale]/[symbol]/fundamental/profileDescription';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';
import { FinancialHealthCard } from '@/widgets/fundamental/sections/FinancialHealthCard';
import { FutureDirectionCard } from '@/widgets/fundamental/sections/FutureDirectionCard';
import { GrowthChart } from '@/widgets/fundamental/sections/GrowthChart';
import { PeersTable } from '@/widgets/fundamental/sections/PeersTable';
import { ProfileCard } from '@/widgets/fundamental/sections/ProfileCard';
import { ProfitabilityCard } from '@/widgets/fundamental/sections/ProfitabilityCard';
import { ValuationCard } from '@/widgets/fundamental/sections/ValuationCard';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 펀더멘털 섹션 정적 캐시(`fundamental:profile`·`fundamental:metrics-v3` 등)의 revalidate. `[symbol]` 탭 revalidate clamp 가드가 이 값을 직접 읽는다.
 */
export const FUNDAMENTAL_SECTION_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** TTM 재무비율 캐시 키 — 수익성 카드와 재무 건전성 카드가 같은 캐시 엔트리를 공유한다. */
const RATIOS_CACHE_KEY = 'fundamental:ratios-v2';

interface SymbolSectionProps {
    /** 대문자 티커. */
    symbol: string;
}

interface LocalizedSectionProps extends SymbolSectionProps {
    locale: Locale;
}

/**
 * FMP 섹션 데이터를 `staticSymbolCache`(키 `[key, symbol]`, 24h)로 읽고, 실패하면 섹션 하나만 빈
 * 상태로 떨어뜨린다 — 로그를 남기고 **이 렌더의 revalidate를 짧게 낮춘 뒤** `fallback`을 돌려준다.
 *
 * 왜 낮추나: 렌더 경로의 FMP 호출은 짧은 예산(시도당 3초·재시도 1회·429 대기 없음 —
 * `renderBudget.ts`)으로 돈다. 일시적인 지연·레이트 리밋만으로도 섹션이 빈 카드로 렌더될 수 있는데,
 * 그 HTML이 라우트 revalidate(24h) 동안 굳으면 안 된다. ISR은 요청이 와야 재생성하므로 비용은
 * "장애가 이어지는 동안 방문당 최대 5분에 한 번 재렌더"뿐이라, 큐레이션 종목으로 한정하지 않는다.
 *
 * 키는 페이지 게이트(`getProfileResilient`의 `fundamental:profile`)·다른 섹션과 공유되는 리터럴이라
 * 호출부가 그대로 적는다(revalidate clamp 가드가 `FUNDAMENTAL_SECTION_REVALIDATE_SECONDS`를 읽는다).
 */
function loadSection<T, F>(
    key: string,
    symbol: string,
    load: () => Promise<T>,
    failureLog: string,
    fallback: F
): Promise<T | F> {
    return staticSymbolCache(
        [key, symbol],
        symbol,
        load,
        [],
        FUNDAMENTAL_SECTION_REVALIDATE_SECONDS
    ).catch(async (error: unknown): Promise<F> => {
        console.error(failureLog, redactDbErrorForLog(error));
        await shortenRevalidateForRuntimeDegrade();
        return fallback;
    });
}

/**
 * `loadSection`의 짝: 페이지 **핵심 내용이 아닌 보강**(있으면 좋은 한 줄)용이다. 같은 `staticSymbolCache`
 * 래핑이지만 실패했을 때 로그를 `console.warn`으로만 남기고 **revalidate를 낮추지 않는다** — 보강 하나가
 * 장애 동안 페이지 전체를 5분마다 재렌더하게 만들면 안 된다. 로더가 던졌으므로 데이터 캐시에는 남지 않고,
 * 다음 ISR 재생성이 다시 시도한다. 그때까지 페이지는 그 줄 없이 렌더된다. 핵심 섹션(`loadSection`)은 빈 카드가
 * 굳지 않게 revalidate를 낮추지만, 보강은 없어도 페이지가 온전하므로 낮추지 않는다.
 */
function loadOptionalSection<T, F>(
    key: string,
    symbol: string,
    load: () => Promise<T>,
    failureLog: string,
    fallback: F
): Promise<T | F> {
    return staticSymbolCache(
        [key, symbol],
        symbol,
        load,
        [],
        FUNDAMENTAL_SECTION_REVALIDATE_SECONDS
    ).catch((error: unknown): F => {
        console.warn(failureLog, redactDbErrorForLog(error));
        return fallback;
    });
}

/**
 * 투자의견 분포 로더. 캐시 엔트리(`fundamental:grades-consensus-v2`)는 `getFundamentalFacts`와
 * `loadPageGradesConsensus`로 공유한다.
 *
 * - Yahoo 실패로 FMP 누적 분포가 내려온 경우(`yahooFailed`): 값은 그려 주되 인원 수 줄은 숨기고(출처 `fmp`),
 *   이 렌더의 revalidate를 낮춘다 — 틀린 누적값이 하루 굳지 않고 몇 분 뒤 재생성된다(프로바이더의 10분 Redis
 *   엔트리가 재생성마다 Yahoo를 다시 치는 것을 막는다).
 * - 진짜 실패(FMP 오류): `loadSection`과 같다 — `null` + revalidate 하향.
 */
async function loadGradesSection(symbol: string): Promise<PageGradesConsensus> {
    try {
        const result = await loadPageGradesConsensus(symbol);
        if (result.yahooFailed) await shortenRevalidateForRuntimeDegrade();
        return result;
    } catch (error) {
        console.error(
            '[FutureDirectionSection] getGradesConsensus failed, degrading to null:',
            redactDbErrorForLog(error)
        );
        await shortenRevalidateForRuntimeDegrade();
        return { grades: null, yahooFailed: false };
    }
}

/**
 * 회사 프로필 카드. 프로필과 번역 설명을 **함께 시작**한다 — 설명은 프로필 결과에 의존하지 않고
 * (원문 폴백만 프로필에서 온다), 상한(`PROFILE_DESCRIPTION_TIMEOUT_MS`)을 넘기면 원문으로 렌더한다.
 * 프로필 실패는 `ProfileCard(null)`의 빈 상태로 떨어지고 페이지 크롬은 유지된다.
 */
export async function ProfileSection({
    symbol,
    locale,
}: LocalizedSectionProps) {
    const [profile, description] = await Promise.all([
        loadSection(
            'fundamental:profile',
            symbol,
            () => getProfile(symbol),
            '[ProfileSection] getProfile failed, degrading to null:',
            null
        ),
        loadProfileDescription(symbol, locale),
    ]);

    const descriptionSlot = (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-secondary-400">
            {description ?? profile?.description ?? ''}
        </p>
    );

    return <ProfileCard profile={profile} descriptionSlot={descriptionSlot} />;
}

/**
 * 한국 종목 밸류에이션 카드의 지표와 계산 기준을 한 캐시 엔트리에서 읽는다. DART 오류·시한으로 제공처 값이 나온 일시적 결과는 페이지
 * 캐시에 들어가지 않으므로(`loadPageKrValuation`) 이 렌더의 revalidate를 낮춰 곧 다시 만든다. 로더 자체가 던지면 빈 카드다.
 */
async function loadKrValuationSection(symbol: string) {
    try {
        const page = await loadPageKrValuation(symbol);
        if (page.transient) await shortenRevalidateForRuntimeDegrade();
        return page;
    } catch (error) {
        console.error(
            '[ValuationSection] loadPageKrValuation failed, degrading to null:',
            redactDbErrorForLog(error)
        );
        await shortenRevalidateForRuntimeDegrade();
        return { metrics: null, basis: null, transient: false };
    }
}

/**
 * 밸류에이션 카드. 실패하면 `ValuationCard(null)`의 빈 상태. 한국 종목은 PER·PBR이 DART 기준이고 계산 기준 한 줄을 함께 싣는다.
 */
export async function ValuationSection({ symbol }: SymbolSectionProps) {
    if (isKrEquitySymbol(symbol)) {
        const { metrics, basis } = await loadKrValuationSection(symbol);
        return <ValuationCard metrics={metrics} basis={basis} />;
    }
    const metrics = await loadSection(
        // `-v3`: 한국 종목 PER·EPS의 산출 기준이 바뀌었다(`-v2`는 yahoo 파생 값). 한국 종목은 `fundamental:kr-valuation-v1`을 쓴다.
        'fundamental:metrics-v3',
        symbol,
        () => getKeyMetricsTtm(symbol),
        '[ValuationSection] getKeyMetricsTtm failed, degrading to null:',
        null
    );
    return <ValuationCard metrics={metrics} />;
}

/** 동종 기업 표. 실패하면 `PeersTable([])`의 빈 상태. */
export async function PeersSection({ symbol }: SymbolSectionProps) {
    const peers = await loadSection(
        // `-v2`: peer PER이 key-metrics와 같은 기준 변경을 따른다.
        'fundamental:peers-v2',
        symbol,
        () => getStockPeers(symbol),
        '[PeersSection] getStockPeers failed, degrading to []:',
        []
    );
    return <PeersTable peers={peers} />;
}

/** 수익성 카드. 실패하면 `ProfitabilityCard(null)`의 빈 상태. */
export async function ProfitabilitySection({ symbol }: SymbolSectionProps) {
    const ratios = await loadSection(
        RATIOS_CACHE_KEY,
        symbol,
        () => getRatiosTtm(symbol),
        '[ProfitabilitySection] getRatiosTtm failed, degrading to null:',
        null
    );
    return <ProfitabilityCard ratios={ratios} />;
}

/** 성장 차트. 실패하면 `GrowthChart(null)`의 빈 상태. */
export async function GrowthSection({ symbol }: SymbolSectionProps) {
    const growth = await loadSection(
        'fundamental:growth',
        symbol,
        () => getIncomeStatementGrowth(symbol),
        '[GrowthSection] getIncomeStatementGrowth failed, degrading to null:',
        null
    );
    return <GrowthChart growth={growth} />;
}

/** 재무 건전성 카드 — 세 로더를 병렬로 읽고, 각각 실패하면 그 값만 `null`이다. */
export async function FinancialHealthSection({ symbol }: SymbolSectionProps) {
    const [ratios, scores, cashFlow] = await Promise.all([
        loadSection(
            RATIOS_CACHE_KEY,
            symbol,
            () => getRatiosTtm(symbol),
            '[FinancialHealthSection] getRatiosTtm failed, degrading to null:',
            null
        ),
        loadSection(
            'fundamental:scores',
            symbol,
            () => getFinancialScores(symbol),
            '[FinancialHealthSection] getFinancialScores failed, degrading to null:',
            null
        ),
        loadSection(
            'fundamental:cashflow',
            symbol,
            () => getCashFlowStatement(symbol),
            '[FinancialHealthSection] getCashFlowStatement failed, degrading to null:',
            null
        ),
    ]);
    return (
        <FinancialHealthCard
            symbol={symbol}
            ratios={ratios}
            scores={scores}
            cashFlow={cashFlow}
        />
    );
}

/**
 * 향후 방향 카드 — 여섯 로더를 병렬로 읽고, 각각 실패하면 그 값만 `null`이다.
 *
 * `analystTargets`(Yahoo 집계 목표가 줄)는 한국 종목에서 부르지 않는다 — 한국 프로바이더가 이미 Yahoo라
 * 나란히 보일 값이 없다. 로더는 Yahoo 실패 때 던지지만 보강이라 `loadOptionalSection`이 revalidate를 낮추지 않는다.
 */
export async function FutureDirectionSection({ symbol }: SymbolSectionProps) {
    const [
        estimates,
        gradesResult,
        ptConsensus,
        ptSummary,
        analystTargets,
        estimateTrend,
    ] = await Promise.all([
        loadSection(
            'fundamental:estimates',
            symbol,
            () => getAnalystEstimates(symbol),
            '[FutureDirectionSection] getAnalystEstimates failed, degrading to null:',
            null
        ),
        loadGradesSection(symbol),
        loadSection(
            'fundamental:pt-consensus',
            symbol,
            () => getPriceTargetConsensus(symbol),
            '[FutureDirectionSection] getPriceTargetConsensus failed, degrading to null:',
            null
        ),
        loadSection(
            'fundamental:pt-summary',
            symbol,
            () => getPriceTargetSummary(symbol),
            '[FutureDirectionSection] getPriceTargetSummary failed, degrading to null:',
            null
        ),
        isKrEquitySymbol(symbol)
            ? Promise.resolve(null)
            : loadOptionalSection(
                  'fundamental:analyst-views-lite',
                  symbol,
                  () => loadAnalystTargetsSummary(symbol),
                  '[FutureDirectionSection] loadAnalystTargetsSummary failed, degrading to null:',
                  null
              ),
        // 한국 종목도 Yahoo `earningsTrend`가 온다(미국·한국 공통). 보강이라 실패해도 revalidate를 낮추지 않는다.
        loadOptionalSection(
            'fundamental:estimate-trend',
            symbol,
            () => loadAnalystEstimateTrend(symbol),
            '[FutureDirectionSection] loadAnalystEstimateTrend failed, degrading to null:',
            null
        ),
    ]);
    // 불일치는 **화면에 실린 두 값**(FMP 컨센서스·Yahoo 평균)으로 렌더 때 계산한다. 따로 캐시된 엔트리의
    // 플래그를 쓰면 한쪽만 갱신됐을 때 낡은 안내가 남는다.
    const targetSourcesDisagree = targetsDisagree(
        targetGapPct(ptConsensus?.targetConsensus, analystTargets?.yahooMean)
    );
    return (
        <FutureDirectionCard
            symbol={symbol}
            estimates={estimates}
            estimateTrend={estimateTrend}
            grades={gradesResult.grades}
            gradesSource={readGradesSource(gradesResult.grades)}
            ptConsensus={ptConsensus}
            ptSummary={ptSummary}
            analystTargets={analystTargets}
            targetSourcesDisagree={targetSourcesDisagree}
        />
    );
}
