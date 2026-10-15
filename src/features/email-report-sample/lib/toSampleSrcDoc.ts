const BASE_TARGET_TAG = '<base target="_blank">';

/**
 * 샘플 메일 HTML을 샌드박스 iframe의 `srcDoc`으로 쓰기 좋게 다듬는다.
 *
 * 메일 안의 링크(종목 페이지·설정)는 iframe 안에서 열리면 샘플이 사라지므로 `<base target>`으로
 * 새 탭으로 보낸다. 템플릿은 메일 전용이라 `target`을 달지 않고, 메일 클라이언트에서는 무의미하니
 * 템플릿을 고치지 않고 표시하는 쪽에서 덧붙인다.
 */
export function toSampleSrcDoc(emailHtml: string): string {
    return emailHtml.replace('<head>', `<head>${BASE_TARGET_TAG}`);
}
