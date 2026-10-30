import { SIGNAL_BRIEF_MAX_LABELS, type SignalBrief } from '../reportModel';
import type {
    ReportEmailTranslator,
    SignalLabelResolver,
} from './reportEmailTypes';

function signalLabelsOf(
    types: readonly string[],
    signalLabel: SignalLabelResolver
): string[] {
    return types.map(signalLabel).filter((l): l is string => l !== null);
}

function cappedSignalList(
    labels: readonly string[],
    t: ReportEmailTranslator
): string {
    const shown = labels.slice(0, SIGNAL_BRIEF_MAX_LABELS);
    const more = labels.length - shown.length;
    return (
        more > 0 ? [...shown, t('signalMore', { v0: String(more) })] : shown
    ).join(', ');
}

function signalScorePart(
    signals: SignalBrief,
    t: ReportEmailTranslator
): string {
    return signals.score === null
        ? t('signalAbstain')
        : t('signalScore', { v0: String(signals.score) });
}

function signalDirectionPart(
    key: 'signalBullish' | 'signalBearish',
    types: readonly string[],
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string | null {
    const labels = signalLabelsOf(types, signalLabel);
    if (labels.length === 0) return null;
    return `${t(key, { v0: String(labels.length) })} (${cappedSignalList(labels, t)})`;
}

function signalFreshPart(
    signals: SignalBrief,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string | null {
    const labels = signalLabelsOf(signals.fresh, signalLabel);
    return labels.length === 0
        ? null
        : t('signalFresh', { v0: cappedSignalList(labels, t) });
}

function signalPullbackPart(
    signals: SignalBrief,
    t: ReportEmailTranslator
): string | null {
    return signals.pullback === null
        ? null
        : t('signalPullback', { v0: t(`pullback.${signals.pullback}`) });
}

/**
 * 신호 요약 한 줄(평문). 점수(보류면 "—") · 상승 N (라벨 최대 {@link SIGNAL_BRIEF_MAX_LABELS}개, +N)
 * · 하락 N (…) · 새로 켜짐: … · 눌림목: …. 라벨 사전에 없는 타입은 개수에서도 뺀다.
 * 행동 권고로 읽히는 어휘는 번역 키에도 없다. 카드의 신호 줄과 요약 표 셀이 함께 쓴다.
 */
export function signalBriefText(
    signals: SignalBrief,
    t: ReportEmailTranslator,
    signalLabel: SignalLabelResolver
): string {
    const parts = [
        signalScorePart(signals, t),
        signalDirectionPart('signalBullish', signals.bullish, t, signalLabel),
        signalDirectionPart('signalBearish', signals.bearish, t, signalLabel),
        signalFreshPart(signals, t, signalLabel),
        signalPullbackPart(signals, t),
    ];
    return parts.filter((p): p is string => p !== null).join(' | ');
}
