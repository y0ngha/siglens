/** 서버 액션 테스트용 `FormData`. 문자열 필드만 받는다(파일 첨부는 다루지 않는다). */
export function makeFormData(values: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(values)) {
        fd.set(key, value);
    }
    return fd;
}
