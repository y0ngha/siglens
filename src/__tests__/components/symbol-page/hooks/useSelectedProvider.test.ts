/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { LOCAL_STORAGE_PROVIDER_KEY } from '@/lib/storageKeys';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import { AI_PROVIDER_VALUES } from '@/domain/llm';

let store: Record<string, string> = {};
const localStorageMock = {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
    }),
    clear: jest.fn(() => {
        store = {};
    }),
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

describe('useSelectedProvider', () => {
    beforeEach(() => {
        store = {};
        jest.clearAllMocks();
    });

    it('returns "claude" as default when no localStorage value exists', () => {
        const { result } = renderHook(() => useSelectedProvider());
        const [provider] = result.current;
        expect(provider).toBe('claude');
    });

    it('reads a valid stored provider from localStorage after mount and updates state', () => {
        store[LOCAL_STORAGE_PROVIDER_KEY] = 'gemini';
        const { result } = renderHook(() => useSelectedProvider());
        expect(result.current[0]).toBe('gemini');
    });

    it('ignores an invalid localStorage value and stays at default', () => {
        store[LOCAL_STORAGE_PROVIDER_KEY] = 'invalid-provider';
        const { result } = renderHook(() => useSelectedProvider());
        expect(result.current[0]).toBe('claude');
    });

    it('updates state when the setter is called with a new provider', () => {
        const { result } = renderHook(() => useSelectedProvider());
        act(() => {
            result.current[1]('chatgpt');
        });
        expect(result.current[0]).toBe('chatgpt');
    });

    it('writes to localStorage when the setter is called', () => {
        const { result } = renderHook(() => useSelectedProvider());
        act(() => {
            result.current[1]('chatgpt');
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            LOCAL_STORAGE_PROVIDER_KEY,
            'chatgpt'
        );
    });

    it('stores "gemini" in localStorage when setter is called with "gemini"', () => {
        const { result } = renderHook(() => useSelectedProvider());
        act(() => {
            result.current[1]('gemini');
        });
        expect(store[LOCAL_STORAGE_PROVIDER_KEY]).toBe('gemini');
    });

    it.each(AI_PROVIDER_VALUES)(
        'accepts the core provider value "%s" from localStorage',
        provider => {
            store[LOCAL_STORAGE_PROVIDER_KEY] = provider;
            const { result } = renderHook(() => useSelectedProvider());
            expect(result.current[0]).toBe(provider);
        }
    );

    it('rejects an unknown provider that is not in core AI_PROVIDER_VALUES', () => {
        store[LOCAL_STORAGE_PROVIDER_KEY] = 'mistral';
        const { result } = renderHook(() => useSelectedProvider());
        // falls back to default
        expect(result.current[0]).toBe('claude');
    });
});
