const DASHED = /^\d{10}-\d{2}-\d{6}$/;
const DASHLESS = /^(\d{10})(\d{2})(\d{6})$/;

/**
 * 접수번호를 대시 형식(`0001193125-26-461016`)으로 맞춘다. 모델이 대시를 빼고 넘겨도 받는다(도구 설명이 "대시는
 * 선택"이라 약속했다). 18자리 숫자도, 대시 형식도 아니면 `null`.
 */
export function normalizeAccession(raw: string): string | null {
    const trimmed = raw.trim();
    if (DASHED.test(trimmed)) return trimmed;
    const match = DASHLESS.exec(trimmed);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
