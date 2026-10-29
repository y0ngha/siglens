import type { ReactNode } from 'react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { ReactQueryProvider } from '@/app/providers';
import { NoticePopupLoader } from '@/widgets/notice-popup/ui/NoticePopupLoader';
import { Footer } from '@/widgets/layout/Footer';
import { AnalysisRateLimitModalHost } from '@/features/analysis-rate-limit/ui/AnalysisRateLimitModalHost';
import { EmailReportNudgeHost } from '@/features/email-report-nudge/ui/EmailReportNudgeHost';
import { PwaBanner } from '@/features/pwa-install/ui/PwaBanner';
import { SearchOverlayProvider } from '@/features/ticker-search/model/SearchOverlayContext';
import { FunnelSignupPing } from '@/features/visitor-ping/ui/FunnelSignupPing';
import { VisitorPing } from '@/features/visitor-ping/ui/VisitorPing';
import { WatchlistMergeHost } from '@/features/watchlist/ui/WatchlistMergeHost';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import type { Locale } from '@/shared/i18n/locales';
import { NavigationPendingProvider } from '@/shared/model/NavigationPendingContext';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import { AuthSessionHeaderClient } from './AuthSessionHeaderClient';
import { RoutePendingSlot } from './RoutePendingSlot';

interface SiteChromeProps {
    readonly locale: Locale;
    /**
     * 루트에 마운트되는 클라이언트 컴포넌트(헤더·푸터·배너·모달)가 쓰는 네임스페이스만 고른 메시지
     * (`CHROME_CLIENT_PATHS`). 전체 카탈로그를 넘기면 first-load JS가 커진다 — 라우트별 추가
     * 네임스페이스는 해당 페이지가 자체 프로바이더로 덧붙인다.
     */
    readonly messages: AbstractIntlMessages;
    readonly children: ReactNode;
}

/**
 * 메인 호스트 전 페이지의 앱 크롬 — 클라이언트 프로바이더, 루트 호스트(배너·모달·비콘), 헤더,
 * 라우트 전환 골격, 푸터. `[locale]/layout.tsx`가 `<body>` 안에 하나 둔다.
 *
 * 서버 컴포넌트다. 여기서 `cookies()`·`headers()`를 부르면 전 라우트가 dynamic이 돼 ISR이 깨지므로
 * 인증 상태는 `AuthSessionHeaderClient`가 클라이언트에서 확정한다.
 */
export function SiteChrome({ locale, messages, children }: SiteChromeProps) {
    return (
        // 링크·프로그래매틱 이동이 로케일을 유지하도록 트리 전체에 현재 로케일을 흘려보낸다
        // (`LocaleLink`, `useLocalePath`).
        <LocaleProvider locale={locale}>
            <NextIntlClientProvider locale={locale} messages={messages}>
                <ReactQueryProvider>
                    {/* 전체화면 검색 오버레이는 앱 전체에 하나다 — 헤더와 홈 히어로가 같은 인스턴스를
                        연다. 번역된 문구를 쓰므로 `NextIntlClientProvider` 안이어야 한다. */}
                    <NavigationPendingProvider>
                        <ToastProvider>
                            <SearchOverlayProvider>
                                {/* 방문자 집계 비콘. 렌더 결과가 없고 하루 한 번만 요청한다 — 다른 UI보다
                                    먼저 두어 이탈이 빠른 방문자도 잡는다. */}
                                <VisitorPing />
                                {/* 가입 직후 첫 페이지에서 가입 완료 퍼널 이벤트를 한 번 보낸다. */}
                                <FunnelSignupPing />
                                <PwaBanner />
                                <NoticePopupLoader />
                                {/* 분석 스트림이 비회원 생성 한도에 걸리면 가입 유도 모달을 띄운다. 분석은
                                    여러 라우트(종목·허브)에서 나오므로 루트에 하나만 둔다. */}
                                <AnalysisRateLimitModalHost />
                                <EmailReportNudgeHost />
                                <WatchlistMergeHost />
                                <AuthSessionHeaderClient />
                                {/* 다른 라우트로 가는 이동은 클릭 즉시 목적지 모양의 골격으로 바꾼다.
                                    클라이언트 상태라 직접 접속·SSR·404에는 관여하지 않는다. */}
                                <RoutePendingSlot>{children}</RoutePendingSlot>
                                {/* 푸터를 루트에 두어 모든 라우트가 같은 내부 링크를 싣는다. 종목
                                    페이지(`/[symbol]`)는 레이아웃의 sticky-footer jail이 차트+AI를 첫
                                    뷰포트에 채우고, 푸터는 그 형제로 아래에 온다. */}
                                <Footer />
                            </SearchOverlayProvider>
                        </ToastProvider>
                    </NavigationPendingProvider>
                </ReactQueryProvider>
            </NextIntlClientProvider>
        </LocaleProvider>
    );
}
