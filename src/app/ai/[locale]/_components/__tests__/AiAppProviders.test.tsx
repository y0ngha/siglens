import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { AiAppProviders } from '../AiAppProviders';

const m = vi.hoisted(() => ({
    intlMessages: vi.fn(),
}));

vi.mock('next-intl', () => ({
    NextIntlClientProvider: ({
        messages,
        children,
    }: {
        messages: unknown;
        children: ReactNode;
    }) => {
        m.intlMessages(messages);
        return <>{children}</>;
    },
}));
vi.mock('@/shared/i18n/LocaleContext', () => ({
    LocaleProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/providers', () => ({
    ReactQueryProvider: ({ children }: { children: ReactNode }) => (
        <>{children}</>
    ),
}));
vi.mock('@/features/ticker-search/model/SearchOverlayContext', () => ({
    SearchOverlayProvider: ({ children }: { children: ReactNode }) => (
        <>{children}</>
    ),
}));
vi.mock('@/features/visitor-ping/ui/VisitorPing', () => ({
    VisitorPing: () => null,
}));
vi.mock('@/features/visitor-ping/ui/FunnelSignupPing', () => ({
    FunnelSignupPing: () => null,
}));
vi.mock('@/app/_components/AuthSessionHeaderClient', () => ({
    AuthSessionHeaderClient: () => <div data-testid="header" />,
}));
vi.mock('@/features/pwa-install/ui/PwaBanner', () => ({
    PwaBanner: () => <div data-testid="pwa-banner" />,
}));
vi.mock('@/features/pwa-install/ui/ServiceWorkerRegistrar', () => ({
    ServiceWorkerRegistrar: () => <div data-testid="sw-registrar" />,
}));

const MESSAGES = {
    app: { ai: { title: '제목' }, home: { title: '홈' } },
    widgets: { 'agent-chat': { send: '전송' } },
};

function renderProviders(disabled: boolean) {
    return render(
        <AiAppProviders
            locale="ko"
            messages={MESSAGES}
            disabled={disabled}
            maintenanceNotice="점검 중"
        >
            <div data-testid="chat" />
        </AiAppProviders>
    );
}

describe('AiAppProviders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('점검 중이면 점검 안내 main과 서비스 워커 등록기를 그린다', () => {
        renderProviders(true);

        expect(screen.getByRole('main')).toHaveTextContent('점검 중');
        expect(screen.getByTestId('sw-registrar')).toBeInTheDocument();
    });

    it('점검 중이면 설치 배너와 자식을 그리지 않는다', () => {
        renderProviders(true);

        expect(screen.queryByTestId('pwa-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
    });

    it('평소에는 자식과 설치 배너를 그린다', () => {
        renderProviders(false);

        expect(screen.getByTestId('chat')).toBeInTheDocument();
        expect(screen.getByTestId('pwa-banner')).toBeInTheDocument();
    });

    it('평소에는 점검 안내 main과 서비스 워커 등록기를 그리지 않는다', () => {
        renderProviders(false);

        expect(screen.queryByRole('main')).not.toBeInTheDocument();
        expect(screen.queryByTestId('sw-registrar')).not.toBeInTheDocument();
    });

    it('클라이언트 메시지는 AI 네임스페이스만 골라 내려보낸다', () => {
        renderProviders(false);

        expect(m.intlMessages).toHaveBeenCalledWith({
            app: { ai: { title: '제목' } },
            widgets: { 'agent-chat': { send: '전송' } },
        });
    });
});
