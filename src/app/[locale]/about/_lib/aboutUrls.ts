import { ABOUT_PATH } from '@/shared/lib/legal';
import { SITE_URL } from '@/shared/lib/seo';

/** 로케일 접두사 없는 `/about` 절대 URL — 메타데이터(aboutMetadata)와 JSON-LD(aboutJsonLd)가 같은 값을 쓰도록 한 곳에 둔다. */
export const ABOUT_PAGE_URL = `${SITE_URL}${ABOUT_PATH}`;
