/**
 * 색인 허용 페이지의 `metadata.robots` 계약 — 색인 지시와 구글 미리보기 지시가
 * 함께 있어야 한다(`localePageRobots`). 페이지 테스트는 `toMatchObject`로 이 모양을
 * 단언한다. `{ index, follow }`만 단언하면 미리보기 지시가 사라지는 회귀를 놓친다
 * — 실제로 허브 7곳이 그 상태로 배포돼 있었다(2026-10-04).
 */
export const INDEXABLE_PAGE_ROBOTS = {
    index: true,
    follow: true,
    googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
    },
} as const;
