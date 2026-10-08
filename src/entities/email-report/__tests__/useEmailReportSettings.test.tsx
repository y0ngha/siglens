vi.mock('@/entities/email-report/actions/getEmailReportSettingsAction', () => ({
    getEmailReportSettingsAction: vi.fn(),
}));
vi.mock(
    '@/entities/email-report/actions/saveEmailReportSettingsAction',
    () => ({ saveEmailReportSettingsAction: vi.fn() })
);

import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getEmailReportSettingsAction } from '@/entities/email-report/actions/getEmailReportSettingsAction';
import { saveEmailReportSettingsAction } from '@/entities/email-report/actions/saveEmailReportSettingsAction';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import type { EmailReportSettingsView } from '@/entities/email-report/model';

const mockGet = vi.mocked(getEmailReportSettingsAction);
const mockSave = vi.mocked(saveEmailReportSettingsAction);

const STORED: EmailReportSettingsView = {
    enabled: false,
    daysOfWeek: [1],
    sendHour: 8,
    timezone: 'Asia/Seoul',
    isSaved: false,
};

const SAVED: EmailReportSettingsView = {
    enabled: true,
    daysOfWeek: [2, 4],
    sendHour: 19,
    timezone: 'Europe/Paris',
    isSaved: true,
};

describe('useEmailReportSettings', () => {
    const clients: QueryClient[] = [];

    function makeWrapper() {
        const client = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        clients.push(client);
        return function Wrapper({ children }: { children: ReactNode }) {
            return (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            );
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue(STORED);
    });

    afterEach(() => {
        clients.splice(0).forEach(c => c.clear());
    });

    it('조회한 설정을 돌려준다', async () => {
        const { result } = renderHook(() => useEmailReportSettings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isPending).toBe(false));
        expect(result.current.settings).toEqual(STORED);
    });

    it('조회 실패는 isError로 드러난다', async () => {
        mockGet.mockRejectedValue(new Error('DB down'));
        const { result } = renderHook(() => useEmailReportSettings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.settings).toBeUndefined();
    });

    it('저장에 성공하면 응답 설정으로 캐시를 바꾸고 다시 조회하지 않는다', async () => {
        mockSave.mockResolvedValue({ status: 'ok', settings: SAVED });
        const { result } = renderHook(() => useEmailReportSettings(), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));

        await act(async () => {
            await result.current.save.mutateAsync({
                enabled: true,
                daysOfWeek: [2, 4],
                sendHour: 19,
                timezone: 'Europe/Paris',
            });
        });

        await waitFor(() => expect(result.current.settings).toEqual(SAVED));
        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('저장 오류 결과는 캐시를 바꾸지 않는다', async () => {
        mockSave.mockResolvedValue({
            status: 'error',
            code: 'invalid_hour',
            message: '올바른 시각을 골라 주세요.',
        });
        const { result } = renderHook(() => useEmailReportSettings(), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.isPending).toBe(false));

        await act(async () => {
            await result.current.save.mutateAsync({
                enabled: true,
                daysOfWeek: [1],
                sendHour: 8,
                timezone: 'Asia/Seoul',
            });
        });

        expect(result.current.settings).toEqual(STORED);
    });
});
