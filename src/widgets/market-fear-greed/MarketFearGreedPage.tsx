import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { FearGreedGauge } from '@/widgets/fear-greed';
import { formatConfidenceFooter } from '@/shared/lib/fearGreedLabels';
import { MarketFearGreedComparison } from './MarketFearGreedComparison';
import { MarketFearGreedFactorBar } from './MarketFearGreedFactorBar';

interface MarketFearGreedPageProps {
    view: MarketFearGreedView;
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
const CNN_DIFFERENCE_NOTE =
    '이 지수는 일별 종가만으로 독립적으로 산출됩니다. CNN Fear & Greed Index와는 ' +
    '구성이 달라서(7개가 아닌 5개 요인 사용 — 풋/콜 비율과 뉴욕증권거래소 52주 ' +
    '신고가·신저가 폭은 활용 가능한 데이터 소스가 없어 제외) 방향성은 대체로 ' +
    '일치하지만 수치 자체는 CNN과 다를 수 있습니다.';

/**
 * Market-wide Fear & Greed page. Server component — the snapshot is precomputed
 * server-side (no bars fetch, no client-side score recompute), so there is no
 * hydration-timing hazard here unlike the per-stock `FearGreedPage`.
 */
export function MarketFearGreedPage({ view }: MarketFearGreedPageProps) {
    const { snapshot, comparisons } = view;

    if (!snapshot) {
        return (
            <div className="text-secondary-400 flex flex-col gap-2 py-6 text-sm">
                <p>시장 공포·탐욕 지수를 계산할 데이터가 부족합니다.</p>
                <p className="text-secondary-500 text-xs">
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
                <p className="text-secondary-500 text-xs">
                    {formatAsOf(snapshot.asOf)}
                </p>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-secondary-300 text-sm font-medium">
                    기간별 비교
                </h2>
                <MarketFearGreedComparison comparisons={comparisons} />
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-secondary-300 text-sm font-medium">
                    요인별 기여도
                </h2>
                {snapshot.factors.map(factor => (
                    <MarketFearGreedFactorBar
                        key={factor.key}
                        factor={factor}
                    />
                ))}
            </section>

            <footer className="text-secondary-500 flex flex-col gap-1 text-xs">
                <p>{CNN_DIFFERENCE_NOTE}</p>
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
