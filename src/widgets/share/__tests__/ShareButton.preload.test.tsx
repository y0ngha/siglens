import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShareButton } from '../ui/ShareButton';

const { loaded } = vi.hoisted(() => ({
    loaded: { sheet: 0, trigger: 0, preparing: 0 },
}));

// 팩토리는 모듈이 처음 import될 때 한 번 돈다 — 청크를 받았는지의 대리 신호다.
vi.mock('../ui/ShareSheet', () => {
    loaded.sheet += 1;
    return { ShareSheet: () => null };
});
vi.mock('../ui/ShareTriggerDialog', () => {
    loaded.trigger += 1;
    return { ShareTriggerDialog: () => null };
});
vi.mock('../ui/SharePreparingModal', () => {
    loaded.preparing += 1;
    return { SharePreparingModal: () => null };
});

vi.mock('@/features/share/hooks/useShareFlow', () => ({
    useShareFlow: () => ({
        status: 'idle',
        isMutating: false,
        sheetOpen: false,
        triggerDialogOpen: false,
        preparingOpen: false,
        preparingPhase: 'pending',
        unavailableVisible: false,
        shareUrl: null,
        tweetText: '',
        describedById: 'share-desc',
        symbol: 'AAPL',
        buttonRef: { current: null },
        onClick: vi.fn(),
        onTriggerConfirm: vi.fn(),
        onTriggerCancel: vi.fn(),
        onPreparingClose: vi.fn(),
        onPreparingRetry: vi.fn(),
        onSheetClose: vi.fn(),
    }),
}));

describe('ShareButton — 대화상자 청크 미리 받기', () => {
    it('열리기 전에는 대화상자 청크를 받지 않고, 버튼에 포인터가 올라가면 미리 받는다', async () => {
        render(<ShareButton />);
        expect(loaded).toEqual({ sheet: 0, trigger: 0, preparing: 0 });

        fireEvent.pointerEnter(screen.getByRole('button'));

        await waitFor(() =>
            expect(loaded).toEqual({ sheet: 1, trigger: 1, preparing: 1 })
        );
    });
});
