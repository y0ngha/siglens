import { act, renderHook } from '@testing-library/react';
import type { UIEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { useTranscriptScroll } from '@/widgets/agent-chat/hooks/useTranscriptScroll';

/** 스크롤 상자를 흉내 낸다 — 높이 값만 필요하다. */
function fakeBox(init: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
}) {
    return init as {
        scrollHeight: number;
        scrollTop: number;
        clientHeight: number;
    } & HTMLDivElement;
}

const scrollEvent = (el: object) =>
    ({ currentTarget: el }) as unknown as UIEvent<HTMLDivElement>;

function setup(box: ReturnType<typeof fakeBox>) {
    const hook = renderHook(() => useTranscriptScroll([], false));
    hook.result.current.containerRef.current = box;
    return hook;
}

describe('useTranscriptScroll — keepAtBottomIfWasThere', () => {
    it('마지막 스크롤 때 맨 아래 근처였으면 내용이 자란 뒤 맨 아래로 붙인다', () => {
        const box = fakeBox({
            scrollHeight: 1000,
            scrollTop: 600,
            clientHeight: 400,
        });
        const { result } = setup(box);
        act(() => result.current.handleScroll(scrollEvent(box)));
        // 카드가 붙어 내용이 커졌다 — 스크롤 이벤트 없이 `scrollHeight`만 자란다.
        box.scrollHeight = 1200;
        act(() => result.current.keepAtBottomIfWasThere());
        expect(box.scrollTop).toBe(1200);
    });

    it('위로 올려 읽던 사람의 자리는 건드리지 않는다', () => {
        const box = fakeBox({
            scrollHeight: 1000,
            scrollTop: 100,
            clientHeight: 400,
        });
        const { result } = setup(box);
        act(() => result.current.handleScroll(scrollEvent(box)));
        box.scrollHeight = 1200;
        act(() => result.current.keepAtBottomIfWasThere());
        expect(box.scrollTop).toBe(100);
    });

    it('맨 아래에서 위로 올라갔다가 다시 내용이 붙으면 올라간 자리를 지킨다', () => {
        const box = fakeBox({
            scrollHeight: 1000,
            scrollTop: 600,
            clientHeight: 400,
        });
        const { result } = setup(box);
        act(() => result.current.handleScroll(scrollEvent(box)));
        box.scrollTop = 200;
        act(() => result.current.handleScroll(scrollEvent(box)));
        box.scrollHeight = 1200;
        act(() => result.current.keepAtBottomIfWasThere());
        expect(box.scrollTop).toBe(200);
    });

    it('아직 스크롤 이벤트가 없었으면(열자마자) 맨 아래로 본다', () => {
        const box = fakeBox({
            scrollHeight: 500,
            scrollTop: 0,
            clientHeight: 500,
        });
        const { result } = setup(box);
        box.scrollHeight = 700;
        act(() => result.current.keepAtBottomIfWasThere());
        expect(box.scrollTop).toBe(700);
    });

    it('스크롤 상자가 아직 없으면 아무 일도 하지 않는다', () => {
        const { result } = renderHook(() => useTranscriptScroll([], false));
        expect(() => result.current.keepAtBottomIfWasThere()).not.toThrow();
    });

    it('호출할 때마다 같은 함수다(효과 의존성에 넣어도 다시 돌지 않는다)', () => {
        const { result, rerender } = renderHook(() =>
            useTranscriptScroll([], false)
        );
        const first = result.current.keepAtBottomIfWasThere;
        rerender();
        expect(result.current.keepAtBottomIfWasThere).toBe(first);
    });
});
