import { METHODOLOGY_PATH } from '@/shared/lib/legal';
import { SITE_URL } from '@/shared/lib/seo';

/** 로케일 접두사 없는 `/methodology` 절대 URL — 메타데이터(methodologyMetadata)와 JSON-LD(methodologyJsonLd)가 같은 값을 쓰도록 한 곳에 둔다. */
export const METHODOLOGY_PAGE_URL = `${SITE_URL}${METHODOLOGY_PATH}`;
