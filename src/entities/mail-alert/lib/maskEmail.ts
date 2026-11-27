/**
 * 화면에 보이는 주소 가리기: `alice@gmail.com` → `a***@gmail.com`.
 * 로컬 파트가 짧아도 첫 글자만 남겨, 두 글자 이하 주소가 거의 그대로 드러나지 않게 한다.
 * `@`가 없는 값은 주소가 아니므로 첫 글자만 남긴다.
 */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    const local = at < 0 ? email : email.slice(0, at);
    const domain = at < 0 ? '' : email.slice(at);
    return `${local.slice(0, 1)}***${domain}`;
}
