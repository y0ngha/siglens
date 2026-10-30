/**
 * 대화 화면 라우트 판정 — href에서 대화 id를 읽고, 다른 대화로 가는 이동인지 가린다.
 */

/** 대화 화면(`/c/<id>`, 로케일 접두사 포함 가능) href의 대화 id. 대화 화면이 아니면 null. */
export function conversationIdOf(href: string): string | null {
    return /\/c\/([^/?#]+)/.exec(href)?.[1] ?? null;
}

/** 지금 열린 대화가 아닌 다른 대화로 가는가. 새 대화(`null`)로 가는 이동은 아니다. */
export function isOtherConversation(
    target: string | null,
    current: string | null
): boolean {
    return target !== null && target !== current;
}

/** 지금 화면의 경로 — 이 셸에서 만든 대화가 있으면 그 대화 화면, 없으면 서버가 준 경로. */
export function livePath(
    localePrefix: string,
    serverPath: string,
    conversationId: string | null
): string {
    return conversationId === null
        ? serverPath
        : `${localePrefix}/c/${conversationId}`;
}
