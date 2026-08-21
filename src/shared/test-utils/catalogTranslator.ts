import koMessages from '../../../messages/ko.json';
import enMessages from '../../../messages/en.json';
import jaMessages from '../../../messages/ja.json';
import zhMessages from '../../../messages/zh.json';

const CATALOGS: Record<string, unknown> = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

/** 서버 액션·메일 템플릿이 받는 번역자와 같은 시그니처. */
export type CatalogTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

function resolve(node: unknown, path: string): unknown {
    return path
        .split('.')
        .reduce<unknown>(
            (current, segment) =>
                typeof current === 'object' && current !== null
                    ? (current as Record<string, unknown>)[segment]
                    : undefined,
            node
        );
}

/**
 * 실제 카탈로그를 읽는 번역자를 만든다 — 키 오타나 로케일 누락이 곧바로
 * 던지므로, 문구를 테스트에 복제했을 때처럼 카탈로그와 갈라진 채로 통과하지
 * 않는다(MISTAKES #13.5).
 *
 * 값 치환은 `{v0}` 형태만 다룬다. ICU 복수형·select는 재현하지 않는다 —
 * 그게 필요한 지점은 실제 `next-intl` 렌더를 거치는 컴포넌트 테스트다.
 */
export function catalogTranslator(
    namespace: string,
    locale: keyof typeof CATALOGS | string = 'ko'
): CatalogTranslator {
    const group = resolve(CATALOGS[locale] ?? koMessages, namespace);
    return (key, values) => {
        const template = resolve(group, key);
        if (typeof template !== 'string') {
            throw new Error(
                `[catalogTranslator] ${locale} 카탈로그에 없는 키: ${namespace}.${key}`
            );
        }
        return Object.entries(values ?? {}).reduce(
            (text, [name, value]) =>
                text.replaceAll(`{${name}}`, String(value)),
            template
        );
    };
}

/**
 * `vi.mock('next-intl/server', …)`에 그대로 넣는 스텁.
 *
 * `getTranslations`는 문자열 네임스페이스와 `{ locale, namespace }` 두 형태를
 * 모두 받는다 — 액션마다 호출 형태가 달라서 한쪽만 지원하면 조용히 undefined가
 * 된다.
 */
export function nextIntlServerStub(defaultLocale = 'ko') {
    return {
        getLocale: async () => defaultLocale,
        getTranslations: async (
            arg: string | { locale?: string; namespace?: string }
        ) =>
            typeof arg === 'string'
                ? catalogTranslator(arg, defaultLocale)
                : catalogTranslator(
                      arg.namespace ?? '',
                      arg.locale ?? defaultLocale
                  ),
    };
}
