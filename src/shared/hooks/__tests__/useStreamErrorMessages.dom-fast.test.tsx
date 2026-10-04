import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import koMessages from '../../../../messages/ko.json';

describe('useStreamErrorMessages', () => {
    it('resolves every static message key from the real ko catalog', () => {
        const { result } = renderHook(() => useStreamErrorMessages(), {
            wrapper: IntlTestProvider,
        });
        const catalog = koMessages.app.api.stream;
        expect(result.current.busy).toBe(catalog.busy);
        expect(result.current.disconnected).toBe(catalog.disconnected);
        expect(result.current.unreadable).toBe(catalog.unreadable);
        expect(result.current.generic).toBe(catalog.generic);
        expect(result.current.unexpected).toBe(catalog.unexpected);
        expect(result.current.unstable).toBe(catalog.unstable);
        expect(result.current.keyRequired).toBe(catalog.keyRequired);
        expect(result.current.limitExceeded).toBe(catalog.limitExceeded);
        expect(result.current.noNews).toBe(catalog.noNews);
        expect(result.current.noOptionsChains).toBe(catalog.noOptionsChains);
        expect(result.current.analysisFailed).toBe(catalog.analysisFailed);
        expect(result.current.fetchFailed).toBe(catalog.fetchFailed);
        expect(result.current.congressFetchFailed).toBe(
            catalog.congressFetchFailed
        );
        expect(result.current.digestUnavailable).toBe(
            catalog.digestUnavailable
        );
    });

    it('interpolates the HTTP status into the failed() message', () => {
        const { result } = renderHook(() => useStreamErrorMessages(), {
            wrapper: IntlTestProvider,
        });
        expect(result.current.failed(503)).toBe(
            koMessages.app.api.stream.failed.replace('{v0}', '503')
        );
    });

    it('interpolates the cooldown seconds into reanalyzeCooldown()', () => {
        const { result } = renderHook(() => useStreamErrorMessages(), {
            wrapper: IntlTestProvider,
        });
        expect(result.current.reanalyzeCooldown(42)).toBe(
            koMessages.app.api.stream.reanalyzeCooldown.replace('{v0}', '42')
        );
    });
});
