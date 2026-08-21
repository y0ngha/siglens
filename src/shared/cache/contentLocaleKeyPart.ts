import type { Locale } from '@/shared/i18n/locales';
import { isContentLocaleEnabled } from '@/shared/db/contentTranslationClient';

/**
 * ISR 데이터 캐시 키에 붙일 로케일 조각.
 *
 * DB 콘텐츠가 로케일별로 갈리면 `unstable_cache` 블롭도 로케일별이어야 한다 —
 * 아니면 먼저 생성한 로케일의 뉴스 제목이 전 로케일에 굳는다.
 *
 * **꺼져 있으면 빈 배열을 돌려준다.** 사이드카가 없을 때는 결과가 로케일과
 * 무관하므로 키를 나눌 이유가 없고, 나누면 ISR write가 로케일 수만큼
 * 늘어난다(이 레포는 ISR write가 실제 비용 항목이다 —
 * `docs/architecture/ISR_REVALIDATE.md`). 스위치를 켜는 순간 의식적으로
 * 그 비용을 지불하게 된다.
 */
export function contentLocaleKeyPart(locale: Locale): readonly string[] {
    return isContentLocaleEnabled() ? [locale] : [];
}
