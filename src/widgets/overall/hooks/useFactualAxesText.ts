import { useTranslations } from 'next-intl';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { getFactualAxisKeys } from '../utils/factualAxisKeys';
import { formatConjunction } from '../utils/listFormat';

/**
 * 종합 분석이 보는 축 이름을 현재 로케일로 이은 문장 조각.
 *
 * 라벨은 탭바와 같은 `shared.symbolTab`을 쓴다 — 같은 것을 두 번 번역하지 않고,
 * 번역된 템플릿에 한국어 리터럴을 꽂지도 않는다. 이 문구는 JS 없는 크롤러가 읽는
 * SSR 본문이라 그대로 색인된다.
 */
export function useFactualAxesText(marketProfile: MarketProfileId): string {
    const tTab = useTranslations('shared.symbolTab');
    const locale = useResolvedLocale();
    return formatConjunction(
        INTL_LOCALE[locale],
        getFactualAxisKeys(marketProfile).map(key => tTab(key))
    );
}
