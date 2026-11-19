import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';
import { removeMatchMedia } from '@/shared/test-utils/matchMedia';
import { Composer } from '@/widgets/agent-chat/Composer';
import ko from '../../../../messages/ko.json';

/** 주 입력이 손가락인 기기(`(pointer: coarse)`)로 보이게 하는 matchMedia 스텁. */
function stubCoarsePointer(): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: query === '(pointer: coarse)',
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        }),
    });
}

const prepareChatImage = vi.hoisted(() => vi.fn());
vi.mock('@/features/agent-chat/lib/prepareChatImage', async importOriginal => ({
    ...(await importOriginal<object>()),
    prepareChatImage,
}));

const imageCounter = { seq: 0 };
const attachmentFor = (): ChatImageAttachment => {
    imageCounter.seq += 1;
    const imageSeq = imageCounter.seq;
    return {
        id: `img-${imageSeq}`,
        src: `blob:img-${imageSeq}`,
        width: 10,
        height: 8,
        payload: { mediaType: 'image/jpeg', data: `D${imageSeq}` },
    };
};
const okImage = async () => ({ ok: true as const, image: attachmentFor() });
const png = (name = 'a.png') =>
    new File([new Uint8Array(4)], name, { type: 'image/png' });

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

function renderComposer(
    over: Partial<React.ComponentProps<typeof Composer>> = {}
) {
    const props = {
        disabled: false,
        streaming: false,
        remainingTurns: 5,
        onSend: vi.fn(),
        onStop: vi.fn(),
        ...over,
    };
    wrap(<Composer {...props} />);
    return props;
}

describe('Composer', () => {
    describe('거절된 글 되돌리기', () => {
        const props = {
            disabled: false,
            streaming: false,
            remainingTurns: 5,
            onSend: vi.fn(),
            onStop: vi.fn(),
        };
        const textbox = () => screen.getByRole('textbox');

        it('restoredDraft의 id가 바뀔 때마다 글을 입력창에 되돌린다', () => {
            const view = wrap(<Composer {...props} restoredDraft={null} />);
            expect(textbox()).toHaveValue('');
            view.rerender(
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <Composer
                        {...props}
                        restoredDraft={{ id: 1, text: '이 차트 어때?' }}
                    />
                </NextIntlClientProvider>
            );
            expect(textbox()).toHaveValue('이 차트 어때?');
            fireEvent.change(textbox(), { target: { value: '고친 글' } });
            view.rerender(
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <Composer
                        {...props}
                        restoredDraft={{ id: 1, text: '이 차트 어때?' }}
                    />
                </NextIntlClientProvider>
            );
            expect(textbox()).toHaveValue('고친 글');
            view.rerender(
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <Composer
                        {...props}
                        restoredDraft={{ id: 2, text: '이 차트 어때?' }}
                    />
                </NextIntlClientProvider>
            );
            expect(textbox()).toHaveValue('이 차트 어때?');
        });

        it('복원된 여러 줄 글에 맞춰 입력창 높이를 다시 맞춘다', () => {
            const scrollHeight = vi
                .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
                .mockReturnValue(96);
            const view = wrap(<Composer {...props} restoredDraft={null} />);
            view.rerender(
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <Composer
                        {...props}
                        restoredDraft={{ id: 1, text: '첫 줄\n둘째 줄' }}
                    />
                </NextIntlClientProvider>
            );
            expect(textbox().style.height).toBe('96px');
            scrollHeight.mockRestore();
        });
    });

    afterEach(() => {
        removeMatchMedia();
    });

    it('on a touch device Enter is a newline and only the button sends', () => {
        stubCoarsePointer();
        const { onSend } = renderComposer();
        const box = screen.getByRole('textbox');
        expect(box).toHaveAttribute('enterkeyhint', 'enter');
        fireEvent.change(box, { target: { value: '첫 줄' } });
        const notPrevented = fireEvent.keyDown(box, { key: 'Enter' });
        // The default (inserting the newline) is left to the browser.
        expect(notPrevented).toBe(true);
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '전송' }));
        expect(onSend).toHaveBeenCalledWith('첫 줄', []);
    });

    it('with a mouse and keyboard Enter is labelled send on the soft keyboard', () => {
        renderComposer();
        expect(screen.getByRole('textbox')).toHaveAttribute(
            'enterkeyhint',
            'send'
        );
    });

    it('Enter sends, Shift+Enter does not, over 4,000 chars disables send', () => {
        const { onSend } = renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('안녕', []);
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
        expect(box).toHaveAttribute('aria-invalid', 'true');
    });

    it('refocuses the textarea after sending', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(box).toHaveFocus();
    });

    it('shows a full ICU sentence (not a fragment glued onto the counter) once over the limit', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(
            screen.getByText('4,001 / 4,000자로 너무 깁니다')
        ).toBeInTheDocument();
    });

    it('keeps the counter out of the way until the message nears the cap', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        expect(screen.queryByText(/\/ 4,000$/)).toBeNull();
        expect(
            screen.getByText('Enter 전송, Shift+Enter 줄바꿈')
        ).toBeInTheDocument();
        fireEvent.change(box, { target: { value: 'x'.repeat(3200) } });
        expect(screen.getByText('3,200 / 4,000')).toBeInTheDocument();
        expect(screen.queryByText('Enter 전송, Shift+Enter 줄바꿈')).toBeNull();
    });

    it('shows a stop button while streaming and no send button', () => {
        const { onStop } = renderComposer({ streaming: true });
        fireEvent.click(screen.getByRole('button', { name: '중단' }));
        expect(onStop).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '전송' })).toBeNull();
    });

    it('the action button and the textarea share the 44px row (spec R4)', () => {
        renderComposer();
        const box = screen.getByRole('textbox');
        const send = screen.getByRole('button', { name: '전송' });
        expect(box.className).toMatch(/\bmin-h-11\b/);
        expect(send.className).toMatch(/\bsize-11\b/);
        // Disabled is expressed with opaque tokens, never `disabled:opacity-*`.
        expect(send.className).not.toMatch(/opacity/);
        // Icon-only control: the accessible name comes from aria-label, the SVG is hidden.
        expect(send.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });

    it('uses 16px text on touch devices so iOS Safari does not zoom on focus', () => {
        renderComposer();
        expect(screen.getByRole('textbox').className).toMatch(
            /(^|\s)pointer-coarse:text-base(\s|$)/
        );
    });

    it('an entry-link draft is prefilled but only sent when the user presses send', () => {
        const { onSend } = renderComposer({ initialValue: 'NVDA 지금 어때?' });
        expect(screen.getByRole('textbox')).toHaveValue('NVDA 지금 어때?');
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '전송' }));
        expect(onSend).toHaveBeenCalledWith('NVDA 지금 어때?', []);
    });

    it('states the Beta status next to the not-investment-advice notice', () => {
        renderComposer();
        expect(
            screen.getByText(/Beta: 답변에 오류가 있을 수 있으며/)
        ).toBeInTheDocument();
    });

    describe('이미지 첨부', () => {
        const fileInput = (): HTMLInputElement => {
            const input = document.querySelector('input[type="file"]');
            if (!(input instanceof HTMLInputElement))
                throw new Error('no file input');
            return input;
        };

        beforeEach(() => {
            prepareChatImage.mockReset();
            prepareChatImage.mockImplementation(okImage);
            vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        });

        it('숨은 파일 입력은 허용 형식·다중 선택이고, 첨부 버튼이 그것을 연다', () => {
            renderComposer();
            const input = fileInput();
            expect(input).toHaveAttribute(
                'accept',
                'image/png,image/jpeg,image/webp,image/gif'
            );
            expect(input).toBeInTheDocument();
            expect(input.multiple).toBe(true);
            const click = vi.spyOn(input, 'click');
            fireEvent.click(
                screen.getByRole('button', { name: '이미지 첨부' })
            );
            expect(click).toHaveBeenCalled();
        });

        it('파일을 고르면 썸네일과 개인정보 안내가 보이고, 글이 비어도 보낼 수 있다', async () => {
            const onSend = vi.fn();
            renderComposer({ onSend });
            expect(screen.queryByText(/개인정보가 보이지 않게/)).toBeNull();
            fireEvent.change(fileInput(), { target: { files: [png()] } });
            await screen.findByAltText('첨부 이미지 1');
            expect(
                screen.getByText(
                    '계좌번호 등 개인정보가 보이지 않게 가려서 올려 주세요'
                )
            ).toBeInTheDocument();
            const send = screen.getByRole('button', { name: '전송' });
            expect(send).toBeEnabled();
            fireEvent.click(send);
            expect(onSend).toHaveBeenCalledTimes(1);
            const sent = onSend.mock.calls.find(([text]) => text === '');
            expect(sent).toBeDefined();
            expect(sent?.[1]).toHaveLength(1);
            // 보낸 뒤에는 입력창이 비워지고 안내도 사라진다.
            expect(screen.queryByAltText('첨부 이미지 1')).toBeNull();
            expect(screen.queryByText(/개인정보가 보이지 않게/)).toBeNull();
        });

        it('이미지도 글도 없으면 보낼 수 없다', () => {
            renderComposer();
            expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
        });

        it('클립보드의 이미지는 첨부하고 기본 붙여넣기를 막는다', async () => {
            renderComposer();
            const notPrevented = fireEvent.paste(screen.getByRole('textbox'), {
                clipboardData: { files: [png('shot.png')], getData: () => '' },
            });
            expect(notPrevented).toBe(false);
            await screen.findByAltText('첨부 이미지 1');
            expect(prepareChatImage).toHaveBeenCalledTimes(1);
        });

        it('텍스트와 이미지가 함께 오는 붙여넣기(Excel·Sheets)는 텍스트 붙여넣기를 막지 않고 이미지도 붙이지 않는다', () => {
            renderComposer();
            const notPrevented = fireEvent.paste(screen.getByRole('textbox'), {
                clipboardData: {
                    files: [png('cells.png')],
                    getData: (type: string) =>
                        type === 'text/plain' ? 'A1\tB1' : '',
                },
            });
            expect(notPrevented).toBe(true);
            expect(prepareChatImage).not.toHaveBeenCalled();
        });

        it('공백뿐인 텍스트와 이미지가 오면 이미지를 첨부한다', async () => {
            renderComposer();
            const notPrevented = fireEvent.paste(screen.getByRole('textbox'), {
                clipboardData: {
                    files: [png('shot.png')],
                    getData: () => '  \n',
                },
            });
            expect(notPrevented).toBe(false);
            await screen.findByAltText('첨부 이미지 1');
        });

        it('이미지가 없는 붙여넣기는 건드리지 않는다', () => {
            renderComposer();
            const notPrevented = fireEvent.paste(screen.getByRole('textbox'), {
                clipboardData: { files: [] },
            });
            expect(notPrevented).toBe(true);
            expect(prepareChatImage).not.toHaveBeenCalled();
        });

        it('끌어다 놓은 이미지 파일을 첨부한다(이미지가 아닌 파일은 거른다)', async () => {
            renderComposer();
            const surface = screen
                .getByRole('textbox')
                .closest('div[class*="flex-col"]');
            if (!surface) throw new Error('composer surface not found');
            fireEvent.drop(surface, {
                dataTransfer: {
                    types: ['Files'],
                    files: [
                        png(),
                        new File(['x'], 'a.txt', { type: 'text/plain' }),
                    ],
                },
            });
            await screen.findByAltText('첨부 이미지 1');
            expect(prepareChatImage).toHaveBeenCalledTimes(1);
        });

        it('썸네일마다 44px 제거 버튼이 있고 누르면 그 이미지만 빠지며 URL을 놓는다', async () => {
            renderComposer();
            fireEvent.change(fileInput(), {
                target: { files: [png('a.png'), png('b.png')] },
            });
            await screen.findByAltText('첨부 이미지 2');
            const removeSecond = screen.getByRole('button', {
                name: '첨부 이미지 2 제거',
            });
            expect(removeSecond.className).toMatch(/\bsize-11\b/);
            fireEvent.click(removeSecond);
            expect(screen.queryByAltText('첨부 이미지 2')).toBeNull();
            expect(screen.getByAltText('첨부 이미지 1')).toBeInTheDocument();
            expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        });

        it('최대 4장이고 넘치면 안내를 띄우며 첨부 버튼이 잠긴다', async () => {
            renderComposer();
            fireEvent.change(fileInput(), {
                target: {
                    files: [
                        png('1.png'),
                        png('2.png'),
                        png('3.png'),
                        png('4.png'),
                        png('5.png'),
                    ],
                },
            });
            await waitFor(() =>
                expect(screen.getAllByAltText(/^첨부 이미지 \d$/)).toHaveLength(
                    4
                )
            );
            expect(prepareChatImage).toHaveBeenCalledTimes(4);
            expect(screen.getByRole('status')).toHaveTextContent(
                '이미지는 최대 4장까지 첨부할 수 있어요'
            );
            expect(
                screen.getByRole('button', { name: '이미지 첨부' })
            ).toBeDisabled();
        });

        it('읽지 못한 파일은 그 파일만 안내하고 나머지는 첨부한다', async () => {
            prepareChatImage
                .mockImplementationOnce(async () => ({
                    ok: false as const,
                    reason: 'unreadable' as const,
                }))
                .mockImplementationOnce(okImage);
            renderComposer();
            fireEvent.change(fileInput(), {
                target: { files: [png('깨짐.png'), png('좋음.png')] },
            });
            await screen.findByAltText('첨부 이미지 1');
            expect(screen.getAllByAltText(/^첨부 이미지 \d$/)).toHaveLength(1);
            expect(screen.getByRole('status')).toHaveTextContent(
                '깨짐.png 파일을 읽지 못했어요'
            );
        });

        it('너무 큰 파일은 크기 안내를 띄운다', async () => {
            prepareChatImage.mockImplementationOnce(async () => ({
                ok: false as const,
                reason: 'too_large' as const,
            }));
            renderComposer();
            fireEvent.change(fileInput(), {
                target: { files: [png('큼.png')] },
            });
            await screen.findByRole('status');
            expect(screen.getByRole('status')).toHaveTextContent(
                '큼.png 파일이 너무 커요(25MB 이하만 올릴 수 있어요)'
            );
            expect(screen.queryByAltText('첨부 이미지 1')).toBeNull();
        });

        it('썸네일 목록은 접근성 이름이 있다', async () => {
            renderComposer();
            fireEvent.change(fileInput(), { target: { files: [png()] } });
            const list = await screen.findByRole('list', {
                name: '첨부한 이미지',
            });
            expect(within(list).getAllByRole('listitem')).toHaveLength(1);
        });

        it('보내지 않고 사라지면 첨부 URL을 놓는다', async () => {
            const view = render(
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <Composer
                        disabled={false}
                        streaming={false}
                        remainingTurns={null}
                        onSend={vi.fn()}
                        onStop={vi.fn()}
                    />
                </NextIntlClientProvider>
            );
            fireEvent.change(fileInput(), { target: { files: [png()] } });
            await screen.findByAltText('첨부 이미지 1');
            view.unmount();
            expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        });
    });
});
