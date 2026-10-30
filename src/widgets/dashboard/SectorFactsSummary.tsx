/**
 * 전 섹터 신호 개수와 대표 종목을 크롤 가능한 SSR 텍스트로 보여 주는 요약.
 */
import { useTranslations } from 'next-intl';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SectorFactItem } from './ui/sector-facts/SectorFactItem';
import { buildDisplayedSectorFacts } from './utils/displayedSectorFacts';

interface SectorFactsSummaryProps {
    data: SectorSignalsResult;
    /** 섹터명 폴백(`koreanName`)을 찾는 데 쓴다. */
    scope: ClientDashboardScope;
}

/**
 * `SectorSignalPanel`은 **활성** 섹터만 보여 주므로, 이 컴포넌트가 모든 섹터의 신호
 * 개수와 대표 종목을 간결한 정적 목록으로 내놓아 SSR HTML이 스냅샷 전체를 담게 한다.
 * 패널과 같은 파이프라인(`buildDisplayedSectorFacts`)을 거쳐, 패널이 보여 주지 않는
 * 종목을 세거나 링크하지 않는다.
 *
 * ## 영구 서버 sibling이다 — Suspense fallback에 넣지 않는다
 *
 * fallback에 넣으면 경계가 resolve되는 순간 React가 이 서브트리를 클라에서 파괴해, JS를
 * 실행하는 크롤러에게는 링크가 사라지고 raw HTML에서는 `<template>` 숨김 청크 뒤로 밀린다.
 * 패널(스켈레톤만 fallback) **아래**의 상시 sibling이라 SSR HTML·하이드레이션 후 모두
 * 그대로 남는다. 패널과 같은 데이터를 간결하게 한 번 더 보이는 것이라 cloaking이 아니다.
 *
 * 신호가 없는 스냅샷에서는 `null` 대신 한 문장을 그려, 프리렌더 HTML이 데이터에 따라
 * 텍스트 없이 나가지 않게 한다.
 */
export function SectorFactsSummary({ data, scope }: SectorFactsSummaryProps) {
    const t = useTranslations('widgets.dashboard');
    const facts = buildDisplayedSectorFacts(data);
    const nameBySector = new Map(
        scope.signalSectors.map(sector => [sector.symbol, sector.koreanName])
    );

    return (
        <section
            aria-label={t('SectorFactsSummary.a39a24')}
            className="page-container sector-panel-bg py-6"
        >
            <h2 className={cn('mb-4', HEADING_SECTION)}>
                {t('SectorFactsSummary.581217')}
            </h2>
            {facts.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('SectorFactsSummary.9550ad')}
                </p>
            ) : (
                <dl className="flex flex-col gap-4 text-sm text-secondary-300">
                    {facts.map(fact => (
                        <SectorFactItem
                            key={fact.sectorSymbol}
                            fact={fact}
                            fallbackName={
                                nameBySector.get(fact.sectorSymbol) ??
                                fact.sectorSymbol
                            }
                        />
                    ))}
                </dl>
            )}
        </section>
    );
}
