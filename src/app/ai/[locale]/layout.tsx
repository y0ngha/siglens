import { getTranslations } from 'next-intl/server';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { ReactQueryProvider } from '@/app/providers';
import { SearchOverlayProvider } from '@/features/ticker-search/model/SearchOverlayContext';
import { VisitorPing } from '@/features/visitor-ping/ui/VisitorPing';
import { FunnelSignupPing } from '@/features/visitor-ping/ui/FunnelSignupPing';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { SITE_VIEWPORT } from '@/shared/config/viewport';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import {
    isLocale,
    LOCALE_HREFLANG,
    resolveLocale,
} from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import Script from 'next/script';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
import { SITE_URL } from '@/shared/lib/seo';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { AUTH_HINT_INIT_SCRIPT } from '@/shared/lib/auth/authHintAttribute';
import { AI_CLIENT_PATHS } from './aiClientPaths';
import { FONT_VARIABLE_CLASSES } from '../../fontVariables';
import '../../globals.css';

export const dynamic = 'force-dynamic';

/**
 * 이 레이아웃은 ai 서브트리의 **루트**라 메인 호스트 `[locale]/layout.tsx`의 `viewport`를
 * 상속하지 않는다. 없으면 모바일 주소창 띠가 브라우저 기본색으로 떠 헤더와 갈라지고,
 * `viewport-fit=cover`가 빠져 노치 영역이 비었다. 메인과 같은 값을 쓴다.
 */
export const viewport: Viewport = SITE_VIEWPORT;

/**
 * 제목의 제품명은 로케일을 따른다 — ko `시그렌즈 AI`, 그 외 `SIGLENS AI`
 * (`CONVENTIONS.md#I18-11`). 그래서 정적 `metadata`가 아니라 `generateMetadata`다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: raw } = await params;
    const productName = brandAiName(resolveLocale(raw));
    return {
        ...AI_LAYOUT_METADATA,
        title: {
            default: productName,
            template: `%s | ${productName}`,
        },
    };
}

const AI_LAYOUT_METADATA: Metadata = {
    metadataBase: new URL(AI_SITE_URL),
    // Default for everything under the ai host (conversations, not-found):
    // private or empty, never indexed. The landing (`page.tsx`) overrides it.
    robots: { index: false, follow: false },
    // 네이버 서치어드바이저는 호스트별로 소유 확인을 받는다. siglens.io 토큰은
    // `[locale]/layout.tsx`에 있고, 이 레이아웃은 별도 루트라 상속되지 않는다.
    verification: {
        other: {
            'naver-site-verification':
                'dd05a56cc099f67ca0597793f6965c8c9bd13ba3',
        },
    },
};

export default async function AiRootLayout({
    children,
    params,
}: {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    const t = await getTranslations('app.ai');
    const messages = await getMessages({ locale });
    const disabled = process.env.AGENT_CHAT_DISABLED === '1';
    return (
        <html
            lang={LOCALE_HREFLANG[locale]}
            className={`${FONT_VARIABLE_CLASSES} h-full antialiased scheme-dark`}
            // `THEME_INIT_SCRIPT`는 첫 페인트 전에 `<html>`에 `data-theme`·`color-scheme`을
            // 찍는다. 서버 HTML에는 그 속성이 없으므로 React가 불일치로 보고 경고한다 —
            // 의도된 차이라 이 요소에서만 억제한다(자식 트리에는 영향 없음).
            suppressHydrationWarning
        >
            <body className="flex min-h-full flex-col bg-secondary-900">
                {/* 컴포넌트 트리에서 `<script>`를 렌더하면 클라이언트 내비게이션 때
                    실행되지 않고 React가 경고한다. `next/script`의 beforeInteractive는
                    루트 레이아웃에서만 허용되고(이 파일이 ai 서브트리의 루트),
                    하이드레이션 전에 실행돼 테마 깜빡임도 막는다. */}
                <Script
                    id="ai-theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
                {/* 로그인 추정 표식(`<html data-auth-hint>`)을 첫 페인트 전에 찍는다 — 헤더 인증
                    영역의 폭을 CSS가 처음부터 맞게 잡아 회원의 헤더가 하이드레이션 때 밀리지
                    않게 한다(CLS). 테마 스크립트와 같은 이유로 `beforeInteractive`이고, 의도된
                    `<html>` 속성 차이라 위의 `suppressHydrationWarning`이 함께 덮는다. */}
                <Script
                    id="ai-auth-hint-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: AUTH_HINT_INIT_SCRIPT }}
                />
                <LocaleProvider locale={locale} hrefBase={SITE_URL}>
                    <NextIntlClientProvider
                        locale={locale}
                        messages={pickMessages(messages, [...AI_CLIENT_PATHS])}
                    >
                        <ReactQueryProvider>
                            <SearchOverlayProvider>
                                <VisitorPing />
                                {/* 가입 직후 첫 페이지에서 가입 완료 퍼널 이벤트를 한 번 보낸다.
                                렌더 결과가 없다. 근거는 FunnelSignupPing JSDoc. */}
                                <FunnelSignupPing />
                                <AuthSessionHeaderClient authReturn="ai" />
                                {disabled ? (
                                    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 text-center text-secondary-200">
                                        {t('layout.9401e4')}
                                    </main>
                                ) : (
                                    children
                                )}
                            </SearchOverlayProvider>
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </LocaleProvider>
                {/* Google Ads 전환 측정(질문 전송·가입). 판단 근거는
                    shared/config/googleAds.ts. */}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
            </body>
        </html>
    );
}
