import type { OptionsSignalKind, OptionsTone } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';

/** OptionsTone → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
export const TONE_LABEL_KEY: Record<OptionsTone, string> = {
    bullish: 'optionsTone.bullish',
    bearish: 'optionsTone.bearish',
    cautious: 'optionsTone.cautious',
    neutral: 'optionsTone.neutral',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
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
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const commentary =
        typeof record.commentary === 'string'
            ? stripSnapshotMarkdown(record.commentary).trim()
            : '';
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
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const message =
        typeof record.message === 'string'
            ? stripSnapshotMarkdown(record.message).trim()
            : '';
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
 * `content`를 options 결과 모양으로 좁힌다.
 *
 * `summary`(심볼 요약), `perExpiration`(만기별 해설, 각 `commentary`를
 * 동반), `signals`(구조화 시그널, 각 `message`를 동반)가 프로즈 소스다. 이
 * 응답은 tier 마스킹을 거치지 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
export function narrowOptionsContent(
    content: unknown
): NarrowedOptionsContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const summary =
        typeof record.summary === 'string'
            ? stripSnapshotMarkdown(record.summary).trim()
            : '';

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
 * `options/page.tsx`(→ `OptionsPageClient`)가 `<OptionsSnapshotProse>`를
 * 렌더할지 아니면 클라이언트 AI 위젯(`OptionsAiAnalysis`)을 렌더할지 판단하는
 * 예측기(audit fix FIX 2 — `OverallSnapshotProse.hasOverallProse` 패턴). 두
 * 소스가 같은 필드(summary/perExpiration/signals)를 같은 순서로 중복 렌더하던
 * 문제를 XOR 게이팅으로 해소한다.
 *
 * `narrowOptionsContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로 다른
 * 판단을 내릴 수 없게 한다(단일 진실 소스). `OptionsEmptyState`의
 * `snapshotSlot` 게이트(audit fix FIX 9)에서도 재사용된다.
 */
export function hasOptionsProse(content: unknown): boolean {
    return narrowOptionsContent(content) !== null;
}
