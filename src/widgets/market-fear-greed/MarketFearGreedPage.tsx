import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { FearGreedGauge } from '@/widgets/fear-greed';
import { formatConfidenceFooter } from '@/shared/lib/fearGreedLabels';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { MarketFearGreedComparison } from './MarketFearGreedComparison';
import { MarketFearGreedFactorBar } from './MarketFearGreedFactorBar';

interface MarketFearGreedPageProps {
    view: MarketFearGreedView;
    /** 어느 시장의 지수인가. 요인 라벨·설명과 면책 문구가 시장마다 다르다. */
    market: FearGreedMarketId;
}

/** `asOf` is an ISO `YYYY-MM-DD` calendar date → `YYYY년 M월 D일 종가 기준`. */
function formatAsOf(asOf: string): string {
    const [year, month, day] = asOf.split('-').map(Number);
    return `${year}년 ${month}월 ${day}일 종가 기준`;
}

// This index is intentionally narrower than CNN's: 5 daily-close-derivable
// factors instead of 7 (put/call ratio and NYSE 52-week high/low breadth have
// no data source available here), and it is computed independently from daily
// closing prices rather than replicating CNN's pipeline. The disclosure below
// exists so readers don't expect the number to match CNN's exactly.
const CNN_DIFFERENCE_NOTE: Record<FearGreedMarketId, string> = {
    us:
        '이 지수는 일별 종가만으로 독립적으로 산출됩니다. CNN Fear & Greed Index와는 ' +
        '구성이 달라서(7개가 아닌 5개 요인 사용 — 풋/콜 비율과 뉴욕증권거래소 52주 ' +
        '신고가·신저가 폭은 활용 가능한 데이터 소스가 없어 제외) 방향성은 대체로 ' +
        '일치하지만 수치 자체는 CNN과 다를 수 있습니다.',
    // 한국 지수는 CNN과 비교 대상이 아니므로 대신 **무엇으로 채웠는지**를 밝힌다.
    // 변동성 요인이 VKOSPI가 아니라 파생값이라는 사실을 감추면 화면이 거짓말을 한다.
    kr:
        '이 지수는 국내 상장 ETF·지수의 일별 종가만으로 독립적으로 산출됩니다. ' +
        '변동성 요인은 무료로 받을 수 있는 VKOSPI 시세가 없어 코스피 종가에서 ' +
        '산출한 20일 실현변동성을 사용하고, 신용 요인은 국내에 유동성 있는 하이일드 ' +
        '채권이 없어 회사채와 국고채 10년의 수익률 차이로 대신합니다. 미국 지수와 ' +
        '같은 계산식이지만 입력 자산이 달라 두 점수를 직접 비교하지는 마세요.',
};

/**
 * Market-wide Fear & Greed page. Server component — the snapshot is precomputed
 * server-side (no bars fetch, no client-side score recompute), so there is no
 * hydration-timing hazard here unlike the per-stock `FearGreedPage`.
 */
export function MarketFearGreedPage({
    view,
    market,
}: MarketFearGreedPageProps) {
    const { snapshot, comparisons } = view;

    if (!snapshot) {
        return (
            <div className="flex flex-col gap-2 py-6 text-sm text-secondary-400">
                <p>시장 공포·탐욕 지수를 계산할 데이터가 부족합니다.</p>
                <p className="text-xs text-secondary-500">
                    데이터가 아직 충분히 쌓이지 않았을 수 있습니다. 잠시 후 다시
                    확인해주세요.
                </p>
            </div>
        );
    }

    return (
        // 가로 여백은 라우트가 소유한다 — 이 위젯은 세로 리듬만 책임진다.
        // (여기서 좌우 padding을 또 주면 페이지 프로즈와 들여쓰기가 어긋난다.)
        <div className="flex flex-col gap-6 py-6">
            <section className="flex flex-col items-center gap-2">
                <FearGreedGauge
                    score={Math.round(snapshot.score)}
                    label={snapshot.label}
                    size="hero"
                    confidence={snapshot.confidence}
                />
                <p className="text-xs text-secondary-500">
                    {formatAsOf(snapshot.asOf)}
                </p>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-secondary-300">
                    기간별 비교
                </h2>
                <MarketFearGreedComparison comparisons={comparisons} />
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-secondary-300">
                    요인별 기여도
                </h2>
                {snapshot.factors.map(factor => (
                    <MarketFearGreedFactorBar
                        key={factor.key}
                        factor={factor}
                        market={market}
                    />
                ))}
            </section>

            <footer className="flex flex-col gap-1 text-xs text-secondary-500">
                <p>{CNN_DIFFERENCE_NOTE[market]}</p>
                <p>
                    {formatConfidenceFooter(
                        snapshot.sampleSize,
                        snapshot.confidence
                    )}
                </p>
            </footer>
        </div>
    );
}
