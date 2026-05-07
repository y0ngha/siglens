import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';
// labels.ts is the canonical home for fearGreed UI helpers — symbol-page imports it as a consumer.
import {
    FACTOR_LABEL,
    formatFactorRaw,
} from '@/components/fear-greed/utils/labels';

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

const CONFIDENCE_NORMAL_LABEL = '정상 산출';
const CONFIDENCE_LIMITED_LABEL = '신뢰도 제한';
const SCORE_LABEL_SEPARATOR = ' — ';

interface FearGreedCardProps {
    snapshot: FearGreedSnapshot | null;
}

/** 분석 탭 사이드패널의 fearGreed 카드 — Hero score + Flow/Trend 그룹 + factor breakdown + warning + confidence. */
export function FearGreedCard({ snapshot }: FearGreedCardProps) {
    if (!snapshot) {
        return (
            <section className="bg-secondary-800/40 rounded p-3">
                <div className="text-secondary-500 text-sm">
                    공포·탐욕 지수 데이터 부족
                </div>
            </section>
        );
    }

    return (
        <section
            aria-labelledby="fg-card-heading"
            className="bg-secondary-800/40 flex flex-col gap-3 rounded p-3"
        >
            <header className="flex items-center justify-between">
                <h3
                    id="fg-card-heading"
                    className="text-secondary-200 text-sm font-medium"
                >
                    공포·탐욕 지수
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-secondary-100 text-xl font-bold tabular-nums">
                        {Math.round(snapshot.score)}
                    </span>
                    <span className="text-secondary-400 text-xs">
                        {`/ 100${SCORE_LABEL_SEPARATOR}${LABEL_TEXT[snapshot.label]}`}
                    </span>
                </div>
            </header>

            <SelfNormWarningBadge warning={snapshot.warning} />

            {snapshot.groups.map(group => (
                <div key={group.name} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-secondary-300">{group.name}</span>
                        <span className="text-secondary-200 font-medium">
                            {Math.round(group.score)}
                        </span>
                    </div>
                    <ul className="text-secondary-400 flex flex-col gap-0.5 pl-2 text-[11px]">
                        {group.factors.map(f => (
                            <li
                                key={f.key}
                                className="flex items-center justify-between"
                            >
                                <span className="truncate">
                                    · {FACTOR_LABEL[f.key]}
                                </span>
                                <span className="font-mono">
                                    {formatFactorRaw(f.key, f.rawValue)}
                                    <span className="text-secondary-500 ml-1">
                                        ({Math.round(f.percentile)}th)
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            <footer className="text-secondary-500 text-[10px]">
                {`표본 ${snapshot.sampleSize} — ${
                    snapshot.confidence === 'normal'
                        ? CONFIDENCE_NORMAL_LABEL
                        : CONFIDENCE_LIMITED_LABEL
                }`}
            </footer>
        </section>
    );
}
