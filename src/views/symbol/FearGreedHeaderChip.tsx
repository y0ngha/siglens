/**
 * 모든 `/[symbol]/*` 헤더에 붙는 종목 공포·탐욕 칩(서버가 계산한 스냅샷을 그대로 렌더).
 */
import { useTranslations } from 'next-intl';
import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    CONFIDENCE_LIMITED_KEY,
    SENTIMENT_LABEL_KEY,
} from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';

// alpha /40 vs /20 = EXTREME vs base intensity (no separate extreme tokens in design system).
// 텍스트는 반드시 `-text` 변형을 쓴다 — 기본 `ui-*`는 그래픽(3:1) 기준이라
// 자기 틴트 위 소형 텍스트로 쓰면 라이트에서 2.5~3.5:1로 미달한다.
const LABEL_BG: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'bg-ui-danger/40 text-ui-danger-text',
    FEAR: 'bg-ui-danger/20 text-ui-danger-text',
    NEUTRAL: 'bg-secondary-700/40 text-secondary-200',
    GREED: 'bg-ui-success/20 text-ui-success-text',
    EXTREME_GREED: 'bg-ui-success/40 text-ui-success-text',
};

interface FearGreedHeaderChipProps {
    snapshot: FearGreedSnapshot | null;
}

/**
 * Ticker-level sentiment chip on every /[symbol]/* route header.
 *
 * 칩은 `role="img"`다 — 일반 `<span>`(generic)에는 `aria-label`이 금지라 보조기술이 이름을
 * 무시할 수 있다. 이름은 라벨·점수·신뢰도 고지를 한 문장으로 담고, 보이는 조각은 그 요약이다.
 * 라벨과 점수 사이 공백은 실제 텍스트(`{' '}`)로 둔다 — `gap-1`만으로는 textContent가
 * `탐욕61`로 붙는다(inline-flex라 공백 노드는 화면 간격을 바꾸지 않는다).
 */
export function FearGreedHeaderChip({ snapshot }: FearGreedHeaderChipProps) {
    const t = useTranslations('views.symbol');
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `SENTIMENT_LABEL_KEY[...]`를 그대로 `tLabel(...)`에
    // 넣어야 `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다
    // (fearGreedLabels.ts의 SENTIMENT_LABEL_KEY export 주석 참고).
    const tLabel = useTranslations('shared.enumLabel');
    const tFearGreed = useTranslations('shared.lib.fearGreed');
    if (!snapshot) {
        return (
            <span className="inline-flex items-center rounded bg-secondary-700/40 px-2 py-0.5 text-xs text-secondary-400">
                {t('FearGreedHeaderChip.afe032')}
            </span>
        );
    }
    const score = Math.round(snapshot.score);
    const confidenceNote =
        snapshot.confidence === 'limited'
            ? ` (${tFearGreed(CONFIDENCE_LIMITED_KEY)})`
            : '';
    return (
        <span
            role="img"
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_BG[snapshot.label]
            )}
            aria-label={t('FearGreedHeaderChip.ariaLabel', {
                v0: tLabel(SENTIMENT_LABEL_KEY[snapshot.label]),
                v1: score,
                v2: confidenceNote,
            })}
        >
            <span>{tLabel(SENTIMENT_LABEL_KEY[snapshot.label])}</span>{' '}
            <span className="font-mono">{score}</span>
            {snapshot.confidence === 'limited' && (
                <span className="text-secondary-300" aria-hidden="true">
                    ⓘ
                </span>
            )}
        </span>
    );
}
