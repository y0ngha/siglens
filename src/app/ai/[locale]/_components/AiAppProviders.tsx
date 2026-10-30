import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { ReactQueryProvider } from '@/app/providers';
import { SearchOverlayProvider } from '@/features/ticker-search/model/SearchOverlayContext';
import { FunnelSignupPing } from '@/features/visitor-ping/ui/FunnelSignupPing';
import { VisitorPing } from '@/features/visitor-ping/ui/VisitorPing';
import { PwaBanner } from '@/features/pwa-install/ui/PwaBanner';
import { ServiceWorkerRegistrar } from '@/features/pwa-install/ui/ServiceWorkerRegistrar';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import type { Locale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { AI_CLIENT_PATHS } from '../_lib/aiClientPaths';

interface AiAppProvidersProps {
    readonly locale: Locale;
    /** 서버가 로드한 전체 카탈로그 — 여기서 `AI_CLIENT_PATHS`만 골라 클라이언트로 보낸다. */
    readonly messages: AbstractIntlMessages;
    /** 점검 모드. true면 채팅 대신 `maintenanceNotice`만 그린다. */
    readonly disabled: boolean;
    readonly maintenanceNotice: ReactNode;
    readonly children: ReactNode;
}

/**
 * ai 루트 레이아웃 `<body>` 안의 프로바이더·크롬 트리. 첫 페인트 전 스크립트는
 * 루트 레이아웃에 남는다(`beforeInteractive`는 루트에서만 허용).
 */
export function AiAppProviders({
    locale,
    messages,
    disabled,
    maintenanceNotice,
    children,
}: AiAppProvidersProps) {
    return (
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
                        {/* 설치 배너 + 서비스 워커 등록. 하단은 입력창 자리라 위에 띄우고,
                            스트리밍 중인 답변이 끊기지 않게 SW 교체 때 새로고침하지 않는다.
                            점검 중(`disabled`)에는 점검 안내만 여는 앱을 권하지 않도록 배너는 띄우지 않되,
                            오프라인 페이지 프리캐시가 빠지지 않게 서비스 워커는 등록한다. */}
                        {disabled ? (
                            <ServiceWorkerRegistrar reloadOnUpdate={false} />
                        ) : (
                            <PwaBanner
                                placement="top"
                                reloadOnServiceWorkerUpdate={false}
                            />
                        )}
                        <AuthSessionHeaderClient
                            authReturn="ai"
                            hideOnScrollDown
                        />
                        {disabled ? (
                            <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 text-center text-secondary-200">
                                {maintenanceNotice}
                            </main>
                        ) : (
                            children
                        )}
                    </SearchOverlayProvider>
                </ReactQueryProvider>
            </NextIntlClientProvider>
        </LocaleProvider>
    );
}
