import { cache } from 'react';
import { getSharedAnalysisAction } from './getSharedAnalysisAction';

/**
 * `getSharedAnalysisAction`의 요청 범위 메모이제이션. `/share/[id]`의
 * `generateMetadata`와 페이지 본문이 같은 id로 각각 호출해도 한 RSC 렌더 안에서
 * DB 왕복을 한 번으로 합친다.
 *
 * 범위는 해당 HTTP 요청의 렌더 패스뿐이다. `/share/[id]/opengraph-image`는 별도
 * 요청이라 이 캐시가 닿지 않는다.
 *
 * 조회 의미(not_found / expired / found)는 `getSharedAnalysisAction`이 단일 출처로
 * 갖도록 로직을 더하지 않는다. 서버 액션을 감싸 요청 수명주기에 참여하므로 순수
 * 함수만 두는 `lib/`가 아니라 `actions/`에 둔다.
 */
export const getCachedSharedAnalysis = cache(getSharedAnalysisAction);
