import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';
import { useImageAttachments } from '@/widgets/agent-chat/hooks/useImageAttachments';

const prepareChatImage = vi.hoisted(() => vi.fn());
vi.mock('@/features/agent-chat/lib/prepareChatImage', async importOriginal => ({
    ...(await importOriginal<object>()),
    prepareChatImage,
}));

const attachment = (id: string): ChatImageAttachment => ({
    id,
    src: `blob:${id}`,
    width: 10,
    height: 8,
    payload: { mediaType: 'image/jpeg', data: id },
});
const png = () => new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });

afterEach(() => vi.clearAllMocks());

describe('useImageAttachments', () => {
    /**
     * 썸네일이 그려진 직후 효과가 돌기 전에 전송을 누르면, 효과로 맞추던 ref가 빈 목록을 돌려줘 이미지가 조용히
     * 빠졌다. 같은 act 안(효과가 아직 돌지 않은 시점)에서 바로 꺼내도 방금 붙인 이미지가 나와야 한다.
     */
    it('붙인 직후 효과가 돌기 전에 꺼내도 방금 붙인 이미지를 돌려준다', async () => {
        prepareChatImage.mockResolvedValue({
            ok: true,
            image: attachment('a'),
        });
        const { result } = renderHook(() => useImageAttachments());
        const taken = await act(async () => {
            await result.current.addFiles([png()]);
            return result.current.takeAll();
        });
        expect(taken.map(image => image.id)).toEqual(['a']);
        expect(result.current.attachments).toEqual([]);
    });

    it('지운 직후 꺼내면 지운 이미지는 빠진다', async () => {
        prepareChatImage
            .mockResolvedValueOnce({ ok: true, image: attachment('a') })
            .mockResolvedValueOnce({ ok: true, image: attachment('b') });
        const { result } = renderHook(() => useImageAttachments());
        await act(async () => {
            await result.current.addFiles([png(), png()]);
        });
        const taken = await act(async () => {
            result.current.remove('a');
            return result.current.takeAll();
        });
        expect(taken.map(image => image.id)).toEqual(['b']);
    });

    it('줄이는 도중 언마운트되면 끝난 뒤 만든 URL을 상태에 넣지 않고 바로 놓는다', async () => {
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => {});
        const gate = { open: () => {} };
        prepareChatImage.mockImplementation(
            () =>
                new Promise(resolve => {
                    gate.open = () =>
                        resolve({ ok: true, image: attachment('late') });
                })
        );
        const { result, unmount } = renderHook(() => useImageAttachments());
        const pending = result.current.addFiles([png()]);
        unmount();
        gate.open();
        await act(async () => {
            await pending;
        });
        expect(revoke).toHaveBeenCalledWith('blob:late');
        revoke.mockRestore();
    });
});
