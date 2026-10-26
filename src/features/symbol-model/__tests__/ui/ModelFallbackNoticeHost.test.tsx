import { act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';
import { publishAnalysisModelFallback } from '@/shared/lib/sse/analysisModelFallback';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import {
    ModelFallbackNoticeHost,
    resetModelFallbackNoticeForTests,
} from '@/features/symbol-model/ui/ModelFallbackNoticeHost';

const mocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    symbolModel: {
        allowedModels: [] as string[],
        unavailableModels: [] as string[],
        isHydrated: true,
    },
}));

vi.mock('@/shared/ui/ToastProvider', () => ({
    useToast: () => ({ showToast: mocks.showToast, dismiss: vi.fn() }),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: () => mocks.symbolModel,
}));

function renderHost(client = new QueryClient()) {
    renderWithIntl(
        <QueryClientProvider client={client}>
            <ModelFallbackNoticeHost />
        </QueryClientProvider>
    );
    return client;
}

describe('ModelFallbackNoticeHost', () => {
    beforeEach(() => {
        resetModelFallbackNoticeForTests();
        mocks.showToast.mockClear();
        mocks.symbolModel = {
            allowedModels: ['deepseek-v4.1-flash', 'claude-sonnet-5-5'],
            unavailableModels: [],
            isHydrated: true,
        };
        localStorage.clear();
    });

    it('저장된 선택이 일시 중단된 모델이면 기본 모델로 분석한다고 한 번 알린다', () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'claude-sonnet-5-5'
        );
        mocks.symbolModel = {
            allowedModels: ['deepseek-v4.1-flash', 'claude-sonnet-5-5'],
            unavailableModels: ['claude-sonnet-5-5'],
            isHydrated: true,
        };

        renderHost();

        expect(mocks.showToast).toHaveBeenCalledTimes(1);
        const toast = mocks.showToast.mock.calls[0]![0] as {
            message: string;
            detail: string;
        };
        expect(toast.message).toContain('Sonnet');
        expect(toast.detail).toContain('기본 모델');
        expect(toast.detail).toContain('DeepSeek');
    });

    it('저장된 선택이 켜진 모델이면 알리지 않는다', () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'deepseek-v4.1-flash'
        );
        mocks.symbolModel = {
            allowedModels: ['deepseek-v4.1-flash', 'claude-sonnet-5-5'],
            unavailableModels: ['claude-sonnet-5-5'],
            isHydrated: true,
        };

        renderHost();

        expect(mocks.showToast).not.toHaveBeenCalled();
    });

    it('서버 대체 신호를 받으면 알리고 꺼진 목록을 다시 받는다', () => {
        const client = new QueryClient();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHost(client);

        act(() => {
            publishAnalysisModelFallback({
                from: 'claude-haiku-5-5' as never,
                to: 'deepseek-v4.1-flash' as never,
            });
        });

        expect(mocks.showToast).toHaveBeenCalledTimes(1);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.disabledServerKeyModels(),
        });
    });

    it('안내는 페이지 생명주기당 한 번이다(종목을 옮겨 다시 마운트돼도)', () => {
        const first = new QueryClient();
        renderHost(first);
        act(() => {
            publishAnalysisModelFallback({
                from: 'claude-haiku-5-5' as never,
                to: 'deepseek-v4.1-flash' as never,
            });
        });
        renderHost(first);
        act(() => {
            publishAnalysisModelFallback({
                from: 'claude-haiku-5-5' as never,
                to: 'deepseek-v4.1-flash' as never,
            });
        });

        expect(mocks.showToast).toHaveBeenCalledTimes(1);
    });
});
