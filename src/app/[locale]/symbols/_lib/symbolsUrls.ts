import { SYMBOLS_PATH } from '@/shared/lib/seo';
import { SITE_URL } from '@/shared/lib/seo';

/** 로케일 접두사 없는 `/symbols` 절대 URL — 메타데이터(symbolsMetadata)와 JSON-LD(symbolsSeo)가 같은 값을 쓰도록 한 곳에 둔다. */
export const SYMBOLS_PAGE_URL = `${SITE_URL}${SYMBOLS_PATH}`;
