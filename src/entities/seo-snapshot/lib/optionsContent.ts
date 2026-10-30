import type { OptionsSignalKind, OptionsTone } from '@y0ngha/siglens-core';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';

/** OptionsTone → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const TONE_LABEL_KEY: Record<OptionsTone, string> = {
    bullish: 'optionsTone.bullish',
    bearish: 'optionsTone.bearish',
    cautious: 'optionsTone.cautious',
    neutral: 'optionsTone.neutral',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
const isTone = createEnumGuard(TONE_LABEL_KEY);

/** OptionsSignalKind → `shared.enumLabel` 카탈로그 키. */
export const SIGNAL_KIND_LABEL_KEY: Record<OptionsSignalKind, string> = {
    bullish: 'optionsSignalKind.bullish',
    bearish: 'optionsSignalKind.bearish',
    volatility: 'optionsSignalKind.volatility',
    neutral: 'optionsSignalKind.neutral',
};

const isSignalKind = createEnumGuard(SIGNAL_KIND_LABEL_KEY);

interface NarrowedPerExpiration {
    expirationDate: string;
    commentary: string;
    tone: OptionsTone | null;
}

function narrowPerExpiration(value: unknown): NarrowedPerExpiration | null {
    const record = asRecord(value);
    if (record === null) return null;
    const commentary = narrowCleanString(record.commentary);
    if (commentary.length === 0) return null;

    return {
        expirationDate:
            typeof record.expirationDate === 'string'
                ? record.expirationDate
                : '',
        commentary,
        tone: isTone(record.tone) ? record.tone : null,
    };
}

interface NarrowedSignal {
    kind: OptionsSignalKind | null;
    message: string;
}

function narrowSignal(value: unknown): NarrowedSignal | null {
    const record = asRecord(value);
    if (record === null) return null;
    const message = narrowCleanString(record.message);
    if (message.length === 0) return null;

    return {
        kind: isSignalKind(record.kind) ? record.kind : null,
        message,
    };
}

interface NarrowedOptionsContent {
    summary: string;
    perExpiration: NarrowedPerExpiration[];
    signals: NarrowedSignal[];
}

/**
 * `content`를 options 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * `summary`(심볼 요약), `perExpiration`(만기별 해설, 각 `commentary`를 동반), `signals`(구조화
 * 시그널, 각 `message`를 동반)가 산문 소스다. 이 응답은 tier 마스킹을 거치지 않으므로 세 필드
 * 전부 값이 채워질 수 있다.
 */
export function narrowOptionsContent(
    content: unknown
): NarrowedOptionsContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const summary = narrowCleanString(record.summary);

    const perExpiration = Array.isArray(record.perExpiration)
        ? record.perExpiration.map(narrowPerExpiration).filter(e => e !== null)
        : [];

    const signals = Array.isArray(record.signals)
        ? record.signals.map(narrowSignal).filter(s => s !== null)
        : [];

    if (
        summary.length === 0 &&
        perExpiration.length === 0 &&
        signals.length === 0
    ) {
        return null;
    }

    return { summary, perExpiration, signals };
}

/**
 * `options/page.tsx`(→ `OptionsPageClient`)가 `<OptionsSnapshotProse>`를 렌더할지 아니면
 * 클라이언트 AI 위젯(`OptionsAiAnalysis`)을 렌더할지 판단하는 예측기. 두 소스가 같은 필드
 * (summary/perExpiration/signals)를 중복 렌더하지 않도록 XOR로 게이팅하며,
 * `OptionsEmptyState`의 `snapshotSlot` 게이트도 이것을 쓴다. 렌더러와 같은
 * `narrowOptionsContent`를 쓰므로 둘이 서로 다른 판단을 내릴 수 없다.
 */
export function hasOptionsProse(content: unknown): boolean {
    return narrowOptionsContent(content) !== null;
}
