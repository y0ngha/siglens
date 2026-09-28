import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbolViewPing } from '@/features/visitor-ping';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

const STORAGE_KEY = 'siglens:symbol-views';
// 가짜 타이머 금지 — RTL waitFor 폴링이 멈춘다 (VisitorPing.test.tsx와 같은 이유).
const TODAY = kstDateKey(new Date());

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

function storedSymbols(): unknown {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
}

describe('SymbolViewPing', () => {
    beforeEach(() => {
        interaction.pending = [];
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
        render(<SymbolViewPing symbol="AAPL" />);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('입력 후 심볼을 JSON 본문으로 보내고 오늘 목록에 기록한다', async () => {
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();

        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL'],
            });
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/presence/symbol',
            expect.objectContaining({
                method: 'POST',
                keepalive: true,
                body: JSON.stringify({ symbol: 'AAPL' }),
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('같은 날 같은 심볼은 다시 보내지 않는다', () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: TODAY, symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('같은 날 다른 심볼은 보내고 목록에 덧붙인다', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: TODAY, symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="NVDA" />);
        fireInteraction();
        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL', 'NVDA'],
            });
        });
    });

    it('날짜가 바뀌었으면 목록을 새로 시작한다', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: '2000-01-01', symbols: ['AAPL'] })
        );
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(storedSymbols()).toEqual({
                date: TODAY,
                symbols: ['AAPL'],
            });
        });
    });

    it('저장값이 깨져 있으면 무시하고 보낸다', async () => {
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    it('응답이 실패하면 기록하지 않는다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
        expect(storedSymbols()).toBeNull();
    });

    it('자동화 브라우저에서는 게이트조차 등록하지 않는다', () => {
        Object.defineProperty(navigator, 'webdriver', {
            value: true,
            configurable: true,
        });
        render(<SymbolViewPing symbol="AAPL" />);
        fireInteraction();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('심볼이 바뀌면 이전 게이트를 해제하고 새 심볼로 등록한다', async () => {
        const { rerender } = render(<SymbolViewPing symbol="AAPL" />);
        rerender(<SymbolViewPing symbol="NVDA" />);
        fireInteraction();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(1);
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/presence/symbol',
            expect.objectContaining({
                body: JSON.stringify({ symbol: 'NVDA' }),
            })
        );
    });
});
