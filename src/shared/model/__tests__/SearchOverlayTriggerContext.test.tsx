// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useContext } from 'react';
import {
    HEADER_SEARCH_INPUT_ID,
    SearchOverlayTriggerContext,
} from '@/shared/model/SearchOverlayTriggerContext';

describe('SearchOverlayTriggerContext', () => {
    it('프로바이더가 없으면 트리거는 null이다', () => {
        const { result } = renderHook(() =>
            useContext(SearchOverlayTriggerContext)
        );

        expect(result.current).toBeNull();
    });

    // 외부(관심종목 버튼의 getElementById)가 이 id 문자열에 의존하는 계약이라 리터럴로 고정한다.
    it('헤더 검색 입력 id는 리터럴로 고정된다', () => {
        expect(HEADER_SEARCH_INPUT_ID).toBe('header-ticker-search');
    });
});
