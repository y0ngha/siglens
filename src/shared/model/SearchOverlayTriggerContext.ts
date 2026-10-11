'use client';

import { createContext } from 'react';

/** 검색 오버레이를 여는 동작. 값은 `features/ticker-search`의 `SearchOverlayProvider`가 채운다. */
export interface SearchOverlayTrigger {
    open: () => void;
}

/**
 * 검색 오버레이 트리거 컨텍스트. 정의를 `shared`에 두는 이유는 의존 방향이다 — 오버레이는
 * `features/ticker-search`가 그리지만 "종목 검색" 버튼은 다른 기능(관심종목 카드·페이지)에도
 * 있다. 그 기능들이 ticker-search를 import하면 ticker-search → watchlist(검색 결과 ★)와
 * 순환이 생기므로, 양쪽이 이 컨텍스트만 공유한다.
 */
export const SearchOverlayTriggerContext =
    createContext<SearchOverlayTrigger | null>(null);

/** 데스크톱 헤더 검색 입력의 id. "종목 검색" 버튼(`useOpenTickerSearch`)이 이 입력에 포커스를 보낸다. */
export const HEADER_SEARCH_INPUT_ID = 'header-ticker-search';
