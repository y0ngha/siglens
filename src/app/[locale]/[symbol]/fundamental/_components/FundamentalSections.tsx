import {
    getAnalystEstimates,
    getCashFlowStatement,
    getFinancialScores,
    getGradesConsensus,
    getIncomeStatementGrowth,
    getKeyMetricsTtm,
    getPriceTargetConsensus,
    getPriceTargetSummary,
    getProfile,
    getRatiosTtm,
    getStockPeers,
} from '@/app/[locale]/[symbol]/fundamental/fundamentalData';
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
 * 호출부가 그대로 적는다(revalidate clamp 가드가 그 리터럴을 찾는다).
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
        SECONDS_PER_DAY
    ).catch(async (error: unknown): Promise<F> => {
        console.error(failureLog, error);
        await shortenRevalidateForRuntimeDegrade();
        return fallback;
    });
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

/** 밸류에이션 카드. 실패하면 `ValuationCard(null)`의 빈 상태. */
export async function ValuationSection({ symbol }: SymbolSectionProps) {
    const metrics = await loadSection(
        // `-v2`: 한국 종목 PER·EPS·요약 파생값의 산출 기준이 바뀌었다(`CachedFundamentalProvider` 키 주석).
        'fundamental:metrics-v2',
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
        'fundamental:ratios-v2',
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
            'fundamental:ratios-v2',
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

/** 향후 방향 카드 — 네 로더를 병렬로 읽고, 각각 실패하면 그 값만 `null`이다. */
export async function FutureDirectionSection({ symbol }: SymbolSectionProps) {
    const [estimates, grades, ptConsensus, ptSummary] = await Promise.all([
        loadSection(
            'fundamental:estimates',
            symbol,
            () => getAnalystEstimates(symbol),
            '[FutureDirectionSection] getAnalystEstimates failed, degrading to null:',
            null
        ),
        loadSection(
            'fundamental:grades-consensus',
            symbol,
            () => getGradesConsensus(symbol),
            '[FutureDirectionSection] getGradesConsensus failed, degrading to null:',
            null
        ),
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
    ]);
    return (
        <FutureDirectionCard
            symbol={symbol}
            estimates={estimates}
            grades={grades}
            ptConsensus={ptConsensus}
            ptSummary={ptSummary}
        />
    );
}
