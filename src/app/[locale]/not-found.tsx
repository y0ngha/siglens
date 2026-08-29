import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { NotFoundContent } from './NotFoundContent';

/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `<title>`이 전 로케일에서 한국어였다. 본문이 SSR되지 않는(아래 참고) 이
 * 경계에서는 **제목이 크롤러와 JS 없는 사용자가 받는 전부**라 영향이 크다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'app.home',
    });
    return {
        title: t('not-found.6cbd6d'),
        robots: { index: false, follow: true },
    };
}

/**
 * 로케일 404 경계.
 *
 * ⚠️ **알려진 한계 — 이 본문은 SSR HTML에 나오지 않는다.** `notFound()`로 도달한
 * 404는 Next가 내장 셸(`<html id="__next_error__">`)로 문서를 만들고 앱 트리는
 * RSC flight로만 실어 보낸다. 그래서 JS 없이는 제목만 보인다.
 *
 * 원인은 이 파일이 아니다 — 본문을 `<main>PROBE</main>` 한 줄짜리 서버
 * 컴포넌트로 바꿔도 동일하게 flight에만 실렸다(intl·클라이언트 여부와 무관).
 * 루트에 `<html>`을 렌더하는 레이아웃이 없어서인데, `lang`이 로케일별로 달라야
 * 해서 `<html>`은 `[locale]/layout.tsx`가 소유할 수밖에 없다. 패스스루 루트
 * 레이아웃(`src/app/layout.tsx`)을 넣어도 바뀌지 않았다.
 *
 * 완화되어 있는 것: 상태 코드는 정확히 404이고, `<title>`은 이 파일의 메타데이터로
 * 로케일에 맞게 나간다. **매칭 실패** URL(`/AAPL/notatab` 등)은 루트
 * `src/app/not-found.tsx`가 받아 완전한 문서를 SSR한다.
 */
export default function NotFound() {
    return <NotFoundContent />;
}
