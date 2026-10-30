/**
 * 시장 공포·탐욕 요인별 기여도의 한 행(이름·원시값·백분위 막대·설명).
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FearGreedScoreBar } from '@/shared/ui/FearGreedScoreBar';
import {
    useMarketFactorRow,
    type MarketFearGreedViewFactor,
} from '../../hooks/useMarketFactorRow';

interface MarketFearGreedFactorBarProps {
    /** 미국·한국 또는 암호화폐 요인. */
    factor: MarketFearGreedViewFactor;
    /**
     * 어느 시장의 지수인가. 요인 라벨·설명이 시장마다 다르다 — 같은 `junk_bond`
     * 키라도 미국은 하이일드 회사채, 한국은 회사채−국고채 스프레드로 채워져 있다.
     */
    market: FearGreedMarketId;
}

/** 요인 한 행. 클라이언트 상태가 없어 서버 컴포넌트로 렌더된다. */
export function MarketFearGreedFactorBar({
    factor,
    market,
}: MarketFearGreedFactorBarProps) {
    const t = useTranslations('widgets.market-fear-greed');
    const { label, description, percentile, rawValueText } = useMarketFactorRow(
        factor,
        market
    );

    /*
     * 이 행들은 카드 안에 중첩된 블록이 아니라 페이지 위에 바로 놓인다 —
     * `SURFACE_NESTED`를 쓰면 라이트에서 행은 파이고 형제인 가이드 카드는 떠
     * 보여, 같은 페이지의 두 패널이 반대 방향으로 읽힌다.
     */
    return (
        <section className={cn('flex flex-col gap-2 p-3', SURFACE_CARD)}>
            <header className="flex items-center justify-between">
                {/* 섹션 h2(`HEADING_SECTION`) 바로 아래 단계라 종목 탭의 그룹 행과 같은 소제목 토큰을 쓴다. */}
                <h3 className={HEADING_SUBSECTION}>{label}</h3>
                <span className="font-mono text-sm text-secondary-200">
                    {rawValueText}
                </span>
            </header>
            <FearGreedScoreBar
                value={percentile}
                label={t('MarketFearGreedFactorBar.percentileLabel', {
                    v0: label,
                    v1: percentile,
                })}
            />
            <div className="flex items-center justify-between gap-2">
                {/* 툴팁이 아니라 보이는 문장으로 둔다 — 서버 컴포넌트라 클라이언트
                    공개 위젯을 쓸 수 없고, 평문은 스크린 리더가 그대로 읽는다. */}
                <p className="text-xs text-secondary-500">{description}</p>
                {/* `백분위`가 섞여 있어 모노를 쓸 수 없다 — Geist Mono에 한글
                    글리프가 없어 OS 폰트로 조용히 폴백한다. 숫자 정렬만 필요하므로
                    본문 서체의 tabular 숫자를 쓴다. */}
                <span className="shrink-0 text-xs text-secondary-400 tabular-nums">
                    {t('MarketFearGreedFactorBar.330be1')} {percentile}
                </span>
            </div>
        </section>
    );
}
