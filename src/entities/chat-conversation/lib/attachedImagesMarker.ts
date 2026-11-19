import { formatAttachedImagesMarker } from '@y0ngha/siglens-core';

/**
 * 이미지가 첨부됐던 사용자 메시지의 모델용 기록 — 본문 끝 줄에 core의 첨부 표식을 붙인다.
 * 과거 턴 이미지는 모델에 다시 보내지 않으므로, 표식이 "그때 이미지가 있었다"는 사실만 전한다.
 * 회원 기록(`toAgentHistory`)과 게스트 기록(`parseBody`)이 같은 모양이 되게 이 한 함수를 쓴다.
 */
export function withAttachedImagesMarker(
    content: string,
    imageCount: number
): string {
    if (imageCount <= 0) return content;
    const marker = formatAttachedImagesMarker(imageCount);
    return content === '' ? marker : `${content}\n${marker}`;
}
