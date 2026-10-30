import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { SITE_URL } from '@/shared/lib/seo';

/** 로케일 접두사 없는 `/developers` 절대 URL — 메타데이터(developersMetadata)와 JSON-LD(developersSeo)가 같은 값을 쓰도록 한 곳에 둔다. */
export const DEVELOPERS_PAGE_URL = `${SITE_URL}${DEVELOPERS_PATH}`;
