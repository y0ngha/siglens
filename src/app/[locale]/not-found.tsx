import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/shared/i18n/locales';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
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
        locale: resolveLocale(locale),
        namespace: 'app.home',
    });
    const title = t('not-found.6cbd6d');
    // JSX 들여쓰기에서 온 줄바꿈·연속 공백은 메타 태그에 그대로 실리면 안 되므로 한 줄로 접는다.
    const description = t('not-found.03ecab').replace(/\s+/gu, ' ').trim();
    return {
        title,
        /**
         * `description`을 비워 두면 Next가 **루트 레이아웃 값을 상속**시킨다 —
         * 즉 존재하지 않는 모든 URL이 홈과 **똑같은** `<meta name="description">`을
         * 달고 나간다(실측 2026-09-20: `/ZZZZZ`·`/nonexistent-page-xyz`·
         * `/news/nosuchcat`·`/share/<없는id>`가 전부 홈 설명문). 404 URL은 수에
         * 상한이 없어서 네이버 서치어드바이저의 "동일 설명문" 집계를 혼자 채운다.
         * `noindex`는 색인만 막을 뿐 이 동일성 선언까지 막아 주지 않는다 —
         * `NOINDEX_SYMBOL_METADATA`가 차단된 심볼에 대해 같은 이유로 자기 카피를
         * 갖는 것과 같은 처방이다.
         *
         * 본문(`NotFoundContent`)이 이미 쓰는 안내 문구를 재사용한다 — 4개 로케일에
         * 번역돼 있고, 페이지가 실제로 말하는 내용과 일치한다.
         */
        description,
        robots: { index: false, follow: true },
        /**
         * canonical을 명시적으로 비우고 홈의 `og:url`을 상속하지 않게 한다(루트 레이아웃은
         * canonical을 깔지 않는다 — 여기 `null`은 "정본 없음"의 명시다). 존재하지 않는 URL이
         * 전부 "내 정규 주소는 홈"이라고 선언하면 크롤러에게 홈의 중복 URL이 무한히
         * 생기는 모양이 된다 — `noindex`는 색인만 막을 뿐 이 선언까지 막지 못한다.
         * `openGraph`는 자식 값이 부모 값을 **통째로 대체**하므로(Next 메타데이터
         * 병합 규칙) `url`을 빼고 제목·설명만 싣는다.
         */
        alternates: { canonical: null },
        openGraph: { title, description },
        /**
         * `twitter`도 부모 값을 통째로 대체하는 키라, 비워 두면 루트 레이아웃의 홈 제목·설명·
         * 홈 OG 이미지가 그대로 실린다 — 404 URL을 X에 붙여 넣으면 홈 카드가 뜬다. 이미지 없이
         * 제목·설명만 싣는 `summary` 카드로 둔다.
         */
        twitter: buildTwitterMetadata({ title, description, card: 'summary' }),
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
