import type { MailAlertLinkAuth } from '@/entities/mail-alert/model';

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | null {
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' && first !== '' ? first : null;
}

/**
 * 메일 속 설정 링크의 `?s=<구독자 id>&sig=<서명>`. 둘 다 있을 때만 값으로 돌려주고, 서명이 맞는지는 서버가
 * 소유자를 정할 때(`verifyLink`) 확인한다 — 여기서는 모양만 읽는다.
 */
export function readAlertLink(searchParams: {
    readonly s?: SearchParamValue;
    readonly sig?: SearchParamValue;
}): MailAlertLinkAuth | undefined {
    const s = firstValue(searchParams.s);
    const sig = firstValue(searchParams.sig);
    return s === null || sig === null ? undefined : { s, sig };
}
