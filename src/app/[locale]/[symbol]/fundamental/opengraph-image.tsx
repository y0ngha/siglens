import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { buildSymbolOgImage } from '@/entities/og-image';

// 동적 세그먼트([symbol]) 하위라 revalidate만으로는 캐시되지 않는다. 이미지가
// (ticker, label) 순수 함수(동적 요청 API 미사용)이므로 force-static으로 정적 생성·캐시.
export const dynamic = 'force-static';
// OG 이미지는 (ticker, label) 순수 함수라 fresh 데이터가 없음 → 길게 캐시.
// 템플릿 변경은 배포 시 캐시가 무효화된다.
export const revalidate = 2592000; // 30d

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// alt는 module-scope const라 ticker 동적 주입 불가 — 페이지 카테고리까지만 명시한다.
export const alt = 'Siglens 미국 주식 펀더멘털 분석';

interface Props {
    params: Promise<{ locale: string; symbol: string }>;
}

export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아
    // 기본 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어
    // 이미지로 통일된다(실측: /AAPL·/en/AAPL·/ja/AAPL이 바이트 동일).
    const { locale, symbol } = await params;
    const t = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'app.symbol',
    });
    return buildSymbolOgImage({
        ticker: symbol.toUpperCase(),
        label: t('opengraph-image.854e15'),
    });
}
