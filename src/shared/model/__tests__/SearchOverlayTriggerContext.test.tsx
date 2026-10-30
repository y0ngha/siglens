// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useContext } from 'react';
import {
    HEADER_SEARCH_INPUT_ID,
    SearchOverlayTriggerContext,
} from '@/shared/model/SearchOverlayTriggerContext';

describe('SearchOverlayTriggerContext', () => {
    it('has no trigger without a provider', () => {
        const { result } = renderHook(() =>
            useContext(SearchOverlayTriggerContext)
        );

        expect(result.current).toBeNull();
    });

    it('pins the header search input id', () => {
        expect(HEADER_SEARCH_INPUT_ID).toBe('header-ticker-search');
    });
});
