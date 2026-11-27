/** 폼 필드를 문자열로 읽는다. 없거나 파일 같은 문자열이 아닌 값이면 빈 문자열이라 호출자가 검증으로 걸러낸다. */
export function readFormText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}
