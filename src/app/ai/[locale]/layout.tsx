import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import {
    getMessages,
    getTranslations,
    setRequestLocale,
} from 'next-intl/server';
import type { ReactNode } from 'react';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { FIRST_INPUT_PROBE_SCRIPT } from '@/features/pwa-install/lib/firstInputProbe';
import { SITE_VIEWPORT } from '@/shared/config/viewport';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
import {
    LOCALE_HREFLANG,
    isLocale,
    resolveLocale,
} from '@/shared/i18n/locales';
import { AUTH_HINT_INIT_SCRIPT } from '@/shared/lib/auth/authHintAttribute';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { AiAppProviders } from './_components/AiAppProviders';
import { buildAiLayoutMetadata } from './_lib/aiLayoutMetadata';
import { FONT_VARIABLE_CLASSES } from '../../fontVariables';
import '../../globals.css';

export const dynamic = 'force-dynamic';

/**
 * 이 레이아웃은 ai 서브트리의 **루트**라 메인 호스트 `[locale]/layout.tsx`의 `viewport`를
 * 상속하지 않는다. 없으면 모바일 주소창 띠가 브라우저 기본색으로 떠 헤더와 갈라지고,
 * `viewport-fit=cover`가 빠져 노치 영역이 비었다. 메인과 같은 값을 쓴다.
 */
export const viewport: Viewport = SITE_VIEWPORT;

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: raw } = await params;
    return buildAiLayoutMetadata(resolveLocale(raw));
}

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
                {/* 하이드레이션 전의 첫 탭·키를 기억한다 — 설치 배너가 effect보다 먼저 온 입력을
                    놓치지 않게. `next/script`가 아니라 인라인이어야 파싱 즉시 실행된다(근거는
                    `features/pwa-install/lib/firstInputProbe.ts`). 루트 레이아웃은 클라이언트에서
                    다시 그려지지 않으므로 "클라이언트 렌더 시 스크립트 미실행" 경고 대상이 아니다. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: FIRST_INPUT_PROBE_SCRIPT,
                    }}
                />
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
                <AiAppProviders
                    locale={locale}
                    messages={messages}
                    disabled={disabled}
                    maintenanceNotice={t('layout.9401e4')}
                >
                    {children}
                </AiAppProviders>
                {/* Google Ads 전환 측정(질문 전송·가입). 판단 근거는
                    shared/config/googleAds.ts. */}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
            </body>
        </html>
    );
}
