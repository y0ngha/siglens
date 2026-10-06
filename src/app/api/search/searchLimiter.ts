import { MS_PER_MINUTE } from '@/shared/config/time';
import { createFixedWindowLimiter } from '@/shared/lib/fixedWindowLimiter';

/**
 * IP당 분당 검색 상한(인스턴스별). `GET /api/search`는 인증 없는 공개 GET이고, 캐시 미스는
 * FMP 호출 2건(심볼·이름 검색)과 KRX 조회로 이어진다(`searchTicker`). 검색창은 키 입력마다
 * 요청하되 지난 요청을 끊으므로 사람이 빠르게 쳐도 이 상한 근처에 오지 않는다 — 넘는 건
 * 스크립트다.
 *
 * Cloudflare 캐시 규칙이 `/api`를 제외하므로 엣지가 대신 막아 주지 않는다. 메모리 카운터인
 * 이유와 한계는 `createFixedWindowLimiter` JSDoc.
 *
 * 라우트 파일(`route.ts`)은 Next가 정한 이름만 export할 수 있어 테스트가 카운터를 비울 수
 * 있도록 이 파일로 뺐다.
 */
export const SEARCH_REQUESTS_PER_IP_PER_MINUTE = 60;

/** 추적할 IP 수 상한(`/api/client-error`와 같은 값). */
const MAX_TRACKED_IPS = 10_000;

export const searchLimiter = createFixedWindowLimiter({
    limit: SEARCH_REQUESTS_PER_IP_PER_MINUTE,
    windowMs: MS_PER_MINUTE,
    maxTrackedKeys: MAX_TRACKED_IPS,
});
