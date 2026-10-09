import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitorPing } from '@/features/visitor-ping/ui/VisitorPing';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/**
 * 게이트는 `onFirstInteraction` 자체 테스트가 검증한다. 여기선 "입력 전엔 안 보내고,
 * 입력 후엔 보낸다"만 본다 — jsdom 이벤트는 isTrusted=false라 실제 게이트를 못 연다.
 */
const interaction = vi.hoisted(() => ({
    pending: [] as Array<() => void>,
}));
vi.mock('@/shared/lib/onFirstInteraction', () => ({
    onFirstInteraction: (callback: () => void) => {
        interaction.pending.push(callback);
        return () => {
            interaction.pending = interaction.pending.filter(
                c => c !== callback
            );
        };
    },
}));
function fireInteraction(): void {
    const callbacks = interaction.pending;
    interaction.pending = [];
    act(() => {
        callbacks.forEach(c => c());
    });
}

const STORAGE_KEY = 'siglens:visit:v2';

const authHint = vi.hoisted(() => ({ value: false }));
vi.mock('@/entities/auth/hooks/useAuthHint', () => ({
    useAuthHint: () => authHint.value,
}));

/**
 * 가짜 타이머를 쓰지 않는다. RTL의 `waitFor`가 타이머로 폴링하는데, vitest의
 * 가짜 타이머를 RTL이 감지하지 못해 폴링이 영원히 진행되지 않는다.
 * 대신 실제 현재 시각의 KST 날짜를 그대로 기대값으로 쓴다.
 */
const TODAY = kstDateKey(new Date());
const GUEST_MARKER = `${TODAY}:guest`;
const MEMBER_MARKER = `${TODAY}:member`;

describe('VisitorPing', () => {
    beforeEach(() => {
        interaction.pending = [];
        authHint.value = false;
        window.localStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('입력 전에는 보내지 않는다', () => {
        render(<VisitorPing />);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('언마운트하면 대기 중 게이트를 해제한다', () => {
        const { unmount } = render(<VisitorPing />);
        unmount();
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('첫 방문에 본문 없는 POST를 보낸다', async () => {
        render(<VisitorPing />);
        fireInteraction();

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                '/api/presence',
                expect.objectContaining({
                    method: 'POST',
                    keepalive: true,
                    // 타임아웃 없는 fire-and-forget fetch를 막는 회귀 가드.
                    signal: expect.any(AbortSignal),
                })
            );
        });
    });

    it('성공하면 오늘 날짜를 기록해 다시 보내지 않는다', async () => {
        const { unmount } = render(<VisitorPing />);
        fireInteraction();
        await waitFor(() => {
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(GUEST_MARKER);
        });
        unmount();

        render(<VisitorPing />);
        fireInteraction();
        // 같은 날 두 번째 마운트는 요청을 만들지 않는다.
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('비회원으로 보낸 날 로그인 힌트가 생기면 한 번 더 보내고, 회원 마커를 남긴다', async () => {
        const { rerender } = render(<VisitorPing />);
        fireInteraction();
        await waitFor(() => {
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(GUEST_MARKER);
        });
        expect(fetch).toHaveBeenCalledTimes(1);

        authHint.value = true;
        rerender(<VisitorPing />);
        fireInteraction();
        await waitFor(() => {
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
                MEMBER_MARKER
            );
        });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('회원으로 이미 보낸 날은 다시 보내지 않는다', () => {
        authHint.value = true;
        window.localStorage.setItem(STORAGE_KEY, MEMBER_MARKER);
        render(<VisitorPing />);
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('옛 형식(날짜만) 값은 무시하고 새 키로 보낸다', async () => {
        window.localStorage.setItem('siglens:visit', TODAY);
        render(<VisitorPing />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    it('저장된 날짜가 오늘이 아니면 다시 보낸다', async () => {
        window.localStorage.setItem(STORAGE_KEY, '2000-01-01');
        render(<VisitorPing />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    it('자동화 브라우저에서는 보내지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        render(<VisitorPing />);
        // webdriver면 게이트를 등록조차 하지 않는다 — 입력이 와도 보내지 않는다.
        fireInteraction();
        // 사람 수를 세는 것이 목적이다. Playwright·Puppeteer는 사람이 아니다.
        expect(fetch).not.toHaveBeenCalled();
    });

    it('응답이 실패하면 날짜를 기록하지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        render(<VisitorPing />);
        fireInteraction();

        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
        // pepper 미설정 같은 배포 오류는 다음 로드에서 다시 드러나야 한다.
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('네트워크가 던져도 화면을 깨뜨리지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('blocked')));
        expect(() => render(<VisitorPing />)).not.toThrow();
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
    });
});
