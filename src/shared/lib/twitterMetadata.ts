import type { Metadata } from 'next';

/**
 * 서비스 공식 X 계정의 핸들. `twitter:site`로 나간다 — 카드가 공유될 때 X가
 * 어느 계정의 콘텐츠인지 알 수 있는 유일한 신호다. `seo.ts`의 `X_URL`과 같은 계정이어야 한다. `seo.ts`를 import해 파생하면 `seo`를 부분 목킹하는
 * 테스트가 깨지므로 상수를 따로 두고, 동기화는 `__tests__/twitterMetadata.test.ts`의
 * `핸들이 X_URL 계정과 같다` 테스트가 강제한다 — 한쪽만 바꾸면 그 테스트가 실패한다.
 */
export const X_HANDLE = '@siglens_io';

interface TwitterMetadataInput {
    readonly title: string;
    readonly description: string;
    /** 생략하면 `images` 키 자체를 내지 않는다 — 레이아웃·파일 규약 이미지가 대신한다. */
    readonly images?: readonly string[];
    /** 기본은 `summary_large_image`. */
    readonly card?: 'summary' | 'summary_large_image';
}

/**
 * `twitter` 메타데이터 객체를 만드는 **유일한 지점**.
 *
 * Next는 `twitter`를 부모와 병합하지 않고 통째로 교체한다. 페이지마다 손으로 객체를
 * 쓰다 보니 `site`를 어느 페이지도 싣지 않았고, 하나를 고쳐도 나머지가 조용히 빠졌다.
 * 모든 `twitter:` 선언이 이 함수를 거치게 해(`src/shared/lib/__tests__/twitterMetadata.guard.test.ts`가
 * 소스를 훑어 강제한다) `twitter:site`가 한 곳에서만 정해진다.
 */
export function buildTwitterMetadata({
    title,
    description,
    images,
    card = 'summary_large_image',
}: TwitterMetadataInput): NonNullable<Metadata['twitter']> {
    return {
        card,
        site: X_HANDLE,
        title,
        description,
        ...(images !== undefined && { images: [...images] }),
    };
}
