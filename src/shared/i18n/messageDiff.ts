import type { AbstractIntlMessages } from 'next-intl';

type MessageTree = Record<string, unknown>;

function isTree(value: unknown): value is MessageTree {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `messages`에서 `present`(상위 프로바이더가 이미 클라이언트에 실은 메시지)에 있는 잎을
 * 뺀다. 비게 된 서브트리도 지운다.
 *
 * 중첩 `NextIntlClientProvider`는 부모 메시지를 **상속하지 않고 교체**하므로 예전에는
 * 라우트 프로바이더마다 크롬 키(약 12.8KB)를 다시 실었다 — 탭 페이지는 루트·`[symbol]`·탭
 * 프로바이더로 같은 키가 RSC 페이로드에 2~3번 들어갔다. 이제 라우트 프로바이더는 차이만
 * 보내고 클라이언트에서 부모와 합친다(`MergedIntlProvider`, `mergeMessages`).
 *
 * 12.8KB 재는 법: `messages/_meta/clientKeys.json`의 `chrome`(`wideNamespaces` + `keys`)
 * 경로를 `messages/ko.json`에서 뽑아 만든 객체의 `JSON.stringify` 바이트 수다(2026-10-06
 * 기준 12,806바이트). 크롬 키가 늘거나 줄면 이 값도 바뀐다.
 */
export function omitMessages(
    messages: AbstractIntlMessages,
    present: AbstractIntlMessages
): AbstractIntlMessages {
    return Object.fromEntries(
        Object.entries(messages).flatMap(([key, value]) => {
            if (!(key in present)) return [[key, value]];
            const base = present[key];
            if (!isTree(value) || !isTree(base)) return [];
            const rest = omitMessages(
                value as AbstractIntlMessages,
                base as AbstractIntlMessages
            );
            return Object.keys(rest).length === 0 ? [] : [[key, rest]];
        })
    ) as AbstractIntlMessages;
}

/**
 * 부모 프로바이더의 메시지에 이 라우트의 차이(`omitMessages` 결과)를 깊게 합친다.
 * 같은 잎이 양쪽에 있으면 `overlay`가 이긴다.
 */
export function mergeMessages(
    base: AbstractIntlMessages,
    overlay: AbstractIntlMessages
): AbstractIntlMessages {
    return Object.entries(overlay).reduce<MessageTree>(
        (acc, [key, value]) => {
            const current = acc[key];
            return {
                ...acc,
                [key]:
                    isTree(current) && isTree(value)
                        ? mergeMessages(
                              current as AbstractIntlMessages,
                              value as AbstractIntlMessages
                          )
                        : value,
            };
        },
        { ...base }
    ) as AbstractIntlMessages;
}
