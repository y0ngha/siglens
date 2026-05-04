// next/og의 ImageResponse는 Latin 폴백만 내장 → Pretendard를 CDN에서 가져와 한글 라벨 렌더링에 사용한다. 네트워크 실패는 null 반환으로 graceful degrade.
const PRETENDARD_BOLD_URL =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-bold.otf';

export async function loadKoreanFont(): Promise<ArrayBuffer | null> {
    try {
        const res = await fetch(PRETENDARD_BOLD_URL, {
            next: { revalidate: 60 * 60 * 24 * 7 },
        });
        if (!res.ok) return null;
        return await res.arrayBuffer();
    } catch {
        return null;
    }
}
