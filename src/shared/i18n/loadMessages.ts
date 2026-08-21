import type { AbstractIntlMessages } from 'next-intl';
import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * 로케일 메시지 카탈로그를 읽는다.
 *
 * **카탈로그는 로케일당 파일 하나**(`messages/{locale}.json`)이고, 최상위 키가
 * 네임스페이스(FSD 슬라이스)다. 파일을 슬라이스별로 쪼개지 않는 이유는 이 파일이
 * `scripts/i18n/extract.mjs`가 통째로 생성하는 산출물이라서다 — 손으로 편집하지
 * 않으므로 병합 충돌 논거가 성립하지 않고, 파일이 하나면 번들러의 동적 import
 * 글로빙이 단순해진다.
 *
 * 클라이언트로 나가는 양은 파일 구조가 아니라 `NextIntlClientProvider`에 넘기는
 * 네임스페이스로 통제한다(`pickMessages`).
 *
 * 누락 로케일은 기본 로케일로 폴백한다 — 배포 중 카탈로그가 아직 없는 로케일이
 * 있어도 페이지가 죽지 않아야 한다. 폴백이 실제로 일어나면 그 로케일은
 * `i18n:verify`에서 실패하므로 조용히 방치되지는 않는다.
 */
export async function loadMessages(
    locale: Locale
): Promise<AbstractIntlMessages> {
    try {
        return (await import(`../../../messages/${locale}.json`)).default;
    } catch {
        if (locale === DEFAULT_LOCALE) return {};
        return (await import(`../../../messages/${DEFAULT_LOCALE}.json`))
            .default;
    }
}

/**
 * 클라이언트 프로바이더에 넘길 네임스페이스만 골라낸다.
 *
 * 전체 카탈로그(2천여 키)를 주입하면 first-load JS가 회귀한다 — 2026-08에
 * 서버 SDK 누출을 잡아 first-load를 38% 줄인 작업의 성과를 그대로 되돌린다.
 * 라우트가 실제로 쓰는 네임스페이스만 명시적으로 넘긴다.
 *
 * 네임스페이스는 `widgets.layout`처럼 **점으로 구분된 경로**이고 카탈로그는
 * 그에 맞게 중첩돼 있다 — next-intl은 네임스페이스와 키를 항상 `.`로 쪼개
 * 객체를 타고 내려가므로, 점이 든 평면 키는 절대 매칭되지 않는다(빌드에서
 * `MISSING_MESSAGE`로 드러났다). 그래서 뽑아낸 서브트리도 같은 모양으로 되쌓는다.
 */
export function pickMessages(
    messages: AbstractIntlMessages,
    namespaces: readonly string[]
): AbstractIntlMessages {
    const picked: Record<string, unknown> = {};
    for (const namespace of namespaces) {
        const segments = namespace.split('.');
        let source: unknown = messages;
        for (const segment of segments) {
            source =
                typeof source === 'object' && source !== null
                    ? (source as Record<string, unknown>)[segment]
                    : undefined;
        }
        if (source === undefined) continue;

        let target = picked;
        for (const segment of segments.slice(0, -1)) {
            target[segment] ??= {};
            target = target[segment] as Record<string, unknown>;
        }
        target[segments[segments.length - 1]!] = source;
    }
    return picked as AbstractIntlMessages;
}
