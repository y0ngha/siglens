import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createRef,
    startTransition,
    useEffect,
    useState,
    type RefObject,
} from 'react';
import { ApiKeySection } from '@/features/api-key-management/ui/ApiKeySection';
import { saveApiKeyAction } from '@/entities/api-key/actions/saveApiKeyAction';
import { deleteApiKeyAction } from '@/entities/api-key/actions/deleteApiKeyAction';
import type { LlmProvider } from '@/shared/config/llmProviders';
import type { ApiKeyActionState } from '@/shared/lib/types';

vi.mock('@/entities/api-key/actions/saveApiKeyAction', () => ({
    saveApiKeyAction: vi.fn(),
}));
vi.mock('@/entities/api-key/actions/deleteApiKeyAction', () => ({
    deleteApiKeyAction: vi.fn(),
}));

const mockSaveAction = vi.mocked(saveApiKeyAction);
const mockDeleteAction = vi.mocked(deleteApiKeyAction);

const KEY_LABEL = 'Claude (Anthropic) API 키';
/** 느린 CI에서도 넉넉한, 액션 도중 카드 재마운트를 기다리는 상한. */
const REMOUNT_WAIT_MS = 5000;

type SetRegistered = (next: LlmProvider[]) => void;
type SetterRef = RefObject<SetRegistered | null>;

interface HarnessProps {
    initial: LlmProvider[];
    setterRef: SetterRef;
}

/** 서버가 내려 주는 등록 목록을 테스트가 바꿀 수 있게 상태로 든 부모. */
function Harness({ initial, setterRef }: HarnessProps) {
    const [registered, setRegistered] = useState(initial);
    useEffect(() => {
        setterRef.current = setRegistered;
    }, [setterRef]);
    return <ApiKeySection registeredProviders={registered} />;
}

/**
 * 서버 액션 응답이 `revalidatePath`로 갱신된 목록을 함께 실어 오는 상황을 흉내 낸다.
 * 액션이 끝나기 직전에 부모 목록을 전환으로 바꿔, 카드 재마운트와 액션 결과가
 * 같은 커밋에 들어가게 한다.
 */
function revalidatingAction(
    setterRef: SetterRef,
    next: LlmProvider[],
    result: ApiKeyActionState
) {
    return async (): Promise<ApiKeyActionState> => {
        await Promise.resolve();
        startTransition(() => setterRef.current?.(next));
        return result;
    };
}

function renderSection(initial: LlmProvider[]) {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const setterRef = createRef<SetRegistered>();
    render(
        <QueryClientProvider client={queryClient}>
            <Harness initial={initial} setterRef={setterRef} />
        </QueryClientProvider>
    );
    return { invalidate, setterRef };
}

function anthropicCard(): HTMLElement {
    return screen.getByTestId('api-key-card-anthropic');
}

describe('ApiKeySection with the real form hooks', () => {
    beforeEach(() => {
        mockSaveAction.mockReset();
        mockDeleteAction.mockReset();
    });

    describe('first registration that remounts the card', () => {
        it('invalidates the registered-providers query', async () => {
            const user = userEvent.setup();
            const { invalidate, setterRef } = renderSection([]);
            mockSaveAction.mockImplementation(
                revalidatingAction(setterRef, ['anthropic'], {
                    status: 'success',
                    message: '저장되었습니다.',
                })
            );

            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );
            await screen.findByText('등록됨');

            expect(invalidate).toHaveBeenCalledWith({
                queryKey: ['llm', 'registered-providers'],
            });
        });

        it('moves focus to 재등록 on the remounted card', async () => {
            const user = userEvent.setup();
            const { setterRef } = renderSection([]);
            mockSaveAction.mockImplementation(
                revalidatingAction(setterRef, ['anthropic'], {
                    status: 'success',
                    message: '저장되었습니다.',
                })
            );

            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );

            await waitFor(() =>
                expect(
                    within(anthropicCard()).getByRole('button', {
                        name: '재등록',
                    })
                ).toHaveFocus()
            );
        });
    });

    describe('delete that remounts the card', () => {
        it('moves focus to the key input on the remounted card', async () => {
            const user = userEvent.setup();
            const { setterRef } = renderSection(['anthropic']);
            mockDeleteAction.mockImplementation(
                revalidatingAction(setterRef, [], {
                    status: 'success',
                    message: '삭제되었습니다.',
                })
            );

            await user.click(
                within(anthropicCard()).getByRole('button', { name: '삭제' })
            );

            await waitFor(() =>
                expect(screen.getByLabelText(KEY_LABEL)).toHaveFocus()
            );
        });
    });

    describe('a remount this card did not cause', () => {
        it('does not take focus on a remount with no preceding action', () => {
            const { setterRef } = renderSection([]);

            // 다른 탭에서 등록해 목록만 다시 내려온 경우.
            act(() => setterRef.current?.(['anthropic']));

            expect(
                within(anthropicCard()).getByRole('button', { name: '재등록' })
            ).toBeInTheDocument();
            expect(document.body).toHaveFocus();
        });

        it('does not take focus again on a second remount after the hand-off', async () => {
            const user = userEvent.setup();
            const { setterRef } = renderSection([]);
            mockSaveAction.mockImplementation(
                revalidatingAction(setterRef, ['anthropic'], {
                    status: 'success',
                    message: '저장되었습니다.',
                })
            );
            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );
            // 카드가 다시 마운트되므로 컨테이너를 매번 새로 집는다.
            const reRegister = (): HTMLElement =>
                within(anthropicCard()).getByRole('button', { name: '재등록' });
            await waitFor(() => expect(reRegister()).toHaveFocus());
            reRegister().blur();

            // 다른 탭에서 삭제했다가 다시 등록해, 넘겨받았던 카드와 같은 키의
            // 카드가 또 마운트되는 경우.
            act(() => setterRef.current?.([]));
            act(() => setterRef.current?.(['anthropic']));

            expect(reRegister()).toBeInTheDocument();
            expect(document.body).toHaveFocus();
        });

        it('does not take focus on a later remount after a re-registration', async () => {
            const user = userEvent.setup();
            const { setterRef } = renderSection(['anthropic']);
            mockSaveAction.mockResolvedValue({
                status: 'success',
                message: '저장되었습니다.',
            });
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '재등록' })
            );
            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-new');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );
            await within(anthropicCard()).findByText('저장되었습니다.');
            (document.activeElement as HTMLElement | null)?.blur();

            // 재등록은 카드를 다시 마운트하지 않는다. 그 뒤 다른 탭에서 삭제해
            // 목록만 다시 내려와도 포커스를 가져오지 않는다.
            act(() => setterRef.current?.([]));

            expect(screen.getByLabelText(KEY_LABEL)).toBeInTheDocument();
            expect(document.body).toHaveFocus();
        });

        it('hands focus over when the list update commits before the action settles', async () => {
            const user = userEvent.setup();
            const { setterRef } = renderSection([]);
            let remountedBeforeSuccess = false;
            mockSaveAction.mockImplementation(async () => {
                // 목록 갱신을 액션 전환 밖에서 먼저 커밋해, 새 카드가 마운트된
                // 뒤에야 성공이 도착하게 한다.
                // 액션 안의 갱신은 액션 전환에 묶여 액션이 끝날 때까지 미뤄지므로
                // 타이머로 전환 밖에서 걸고, 새 카드가 보일 때까지 기다린다.
                setTimeout(
                    () => act(() => setterRef.current?.(['anthropic'])),
                    0
                );
                // 상한에 걸려도 액션을 실패시키지 않고 플래그만 남겨, 아래 단언이
                // 원인을 밝힌 채 실패하게 한다.
                remountedBeforeSuccess = await waitFor(
                    () =>
                        expect(
                            within(anthropicCard()).getByText('등록됨')
                        ).toBeInTheDocument(),
                    { timeout: REMOUNT_WAIT_MS }
                ).then(
                    () => true,
                    () => false
                );
                return { status: 'success', message: '저장되었습니다.' };
            });

            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );

            // 액션이 끝날 때까지 기다린 뒤 재마운트 여부부터 확인해, 상한에 걸렸을
            // 때 포커스 단언이 아니라 원인을 밝히는 단언으로 실패하게 한다.
            await act(async () => {
                await mockSaveAction.mock.results[0]?.value;
            });
            expect(
                remountedBeforeSuccess,
                `the list update did not remount the card within ${REMOUNT_WAIT_MS}ms, before the action settled`
            ).toBe(true);
            await waitFor(() =>
                expect(
                    within(anthropicCard()).getByRole('button', {
                        name: '재등록',
                    })
                ).toHaveFocus()
            );
        }, 15_000);
    });

    describe('re-registration', () => {
        it('shows a failed save after the edit form closes', async () => {
            const user = userEvent.setup();
            renderSection(['anthropic']);
            mockSaveAction.mockResolvedValue({
                status: 'error',
                message: '저장에 실패했습니다.',
                code: 'unknown',
            });

            await user.click(
                within(anthropicCard()).getByRole('button', { name: '재등록' })
            );
            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-bad');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );

            expect(
                await within(anthropicCard()).findByText('저장에 실패했습니다.')
            ).toBeInTheDocument();
        });
    });

    describe('while a save is pending', () => {
        // 끝나지 않은 비동기 액션은 이후 테스트의 전환까지 묶어 두므로 매번 풀어 준다.
        let settlePending: () => void = () => {};
        beforeEach(() => {
            mockSaveAction.mockReturnValue(
                new Promise(resolve => {
                    settlePending = () =>
                        resolve({ status: 'idle', message: null });
                })
            );
        });
        afterEach(async () => {
            await act(async () => settlePending());
        });

        it('keeps the submit button focusable with aria-disabled', async () => {
            const user = userEvent.setup();
            renderSection([]);

            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );

            const pendingButton = await within(anthropicCard()).findByRole(
                'button',
                { name: '저장 중…' }
            );
            expect(pendingButton).toHaveAttribute('aria-disabled', 'true');
            expect(pendingButton).not.toBeDisabled();
        });

        it('does not queue a second save from a click on the pending button', async () => {
            const user = userEvent.setup();
            renderSection([]);
            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-test');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );
            const pendingButton = await within(anthropicCard()).findByRole(
                'button',
                { name: '저장 중…' }
            );

            await user.click(pendingButton);
            // 막지 않으면 두 번째 제출이 큐에 쌓였다가 첫 요청이 끝난 뒤 실행된다.
            await act(async () => settlePending());

            expect(mockSaveAction).toHaveBeenCalledTimes(1);
        });
    });

    describe('after a failed first registration', () => {
        it('does not keep the submitted key in the input', async () => {
            const user = userEvent.setup();
            renderSection([]);
            mockSaveAction.mockResolvedValue({
                status: 'error',
                message: '키 형식이 올바르지 않습니다.',
                code: 'invalid_key_format',
            });

            await user.type(screen.getByLabelText(KEY_LABEL), 'sk-ant-secret');
            await user.click(
                within(anthropicCard()).getByRole('button', { name: '저장' })
            );
            await within(anthropicCard()).findByText(
                '키 형식이 올바르지 않습니다.'
            );

            expect(screen.getByLabelText(KEY_LABEL)).toHaveValue('');
        });
    });
});
