import 'server-only';
import type { SignalLabelResolver } from '@/entities/email-report/templates/reportEmail';

/** `shared.enumLabel` 네임스페이스 번역자에서 필요한 두 동작 — next-intl `t`와 `t.has`. */
export interface SignalLabelDictionary {
    has: (key: string) => boolean;
    label: (key: string) => string;
}

/** 이미 로그한 미등록 타입 — 배치 한 번에 같은 타입이 종목·회원 수만큼 로그되지 않게 한다. */
const warnedTypes = new Set<string>();

/**
 * 대시보드 `SignalBadge`와 같은 `shared.enumLabel.signalType.<type>` 키를 읽는 리졸버.
 * 사전에 없는 타입(core가 새로 추가한 `SignalType`)은 `null` — 템플릿이 생략한다 — 이고,
 * 프로세스당 한 번 `warn`에 남겨 사전을 채우라는 신호를 준다(SA-4).
 */
export function createSignalLabelResolver(
    dictionary: SignalLabelDictionary,
    warn: (message: string) => void = console.warn
): SignalLabelResolver {
    return type => {
        const key = `signalType.${type}`;
        if (!dictionary.has(key)) {
            if (!warnedTypes.has(type)) {
                warnedTypes.add(type);
                warn(
                    `[email-report] no label for signal type "${type}" in shared.enumLabel.signalType — omitted from the report`
                );
            }
            return null;
        }
        return dictionary.label(key);
    };
}

/** 테스트 전용 — 모듈 레벨 dedup 상태를 비운다. */
export function __resetSignalLabelWarningsForTests(): void {
    warnedTypes.clear();
}
