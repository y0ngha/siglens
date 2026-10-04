import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * `dom-fast` 프로젝트 전용 셋업 — `isolate: false`로 워커 하나가 여러 테스트 파일을
 * 같은 모듈 캐시·같은 DOM 위에서 이어 돌리므로, 파일 격리가 해 주던 정리를 여기서
 * 테스트 단위로 대신한다.
 *
 * `cleanup()`을 직접 부르는 이유: @testing-library/react의 자동 cleanup은 **모듈이
 * 처음 평가될 때** `afterEach`를 한 번 등록한다. 격리를 끄면 그 모듈이 워커당 한 번만
 * 평가되므로 등록이 첫 파일에만 붙고, 두 번째 파일부터는 렌더한 트리가 body에 쌓여
 * "Found multiple elements"로 깨진다. 셋업 파일은 격리가 꺼져 있어도 파일마다 다시
 * 실행되므로 여기서 등록하면 모든 파일에 붙는다.
 *
 * 나머지는 다음 파일로 새는 전역 상태를 되돌린다 — 가짜 타이머, 스파이, 전역 스텁,
 * 스토리지, body에 직접 붙인 노드, 문서 루트 속성, `matchMedia` 교체.
 *
 * `vitest.setup.dom.ts`를 여기서 import하지 않는다. 그 파일은 vitest.config.ts의
 * `setupFiles`에 이 파일보다 **먼저** 따로 올라 있다 — import로 끌어오면 그 안의
 * `vi.mock('@testing-library/react')`(i18n 프로바이더 래퍼)이 적용되지 않아
 * `useTranslations`를 쓰는 컴포넌트 테스트가 전부 "프로바이더 밖" 오류로 깨진다
 * (2026-10-04 실측: 167개 중 94개 파일).
 */
/*
 * `matchMedia`는 테스트가 `Object.defineProperty(window, 'matchMedia', ...)`로 갈아
 * 끼우는 전역이다(`shared/test-utils/matchMedia.ts`의 `stubPrefersColorScheme` 등).
 * `vi.unstubAllGlobals()`는 `vi.stubGlobal`로 건 것만, `vi.restoreAllMocks()`는
 * 스파이만 되돌리므로 이 교체는 둘 다 통과해 다음 파일로 샌다 — 그 스텁은 'light'가
 * 없는 모든 쿼리에 `matches: true`를 답해서 `prefers-reduced-motion` 같은 무관한
 * 분기까지 뒤집는다. 셋업 시점의 디스크립터를 잡아 두고 매 테스트 뒤에 되돌린다.
 * (매 테스트 뒤에 되돌리므로 이 파일이 다시 실행되는 시점의 값은 항상 원본이다.)
 */
const originalMatchMedia = Object.getOwnPropertyDescriptor(
    window,
    'matchMedia'
);

/** `<html>`·`<body>`에 테스트가 남긴 속성(data-theme, style, class 등)을 전부 지운다. */
const stripAttributes = (element: Element): void => {
    for (const name of element.getAttributeNames()) {
        element.removeAttribute(name);
    }
};

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
    // 테마(`data-theme`·`style.colorScheme`), 분석 보기(`data-analysis-view`),
    // 스크롤 잠금(`body.style`)처럼 문서 루트에 쓰는 상태. body의 자식만 비워서는
    // 남는다 — 다음 파일이 "속성이 없을 때의 기본값"을 검증하면 순서에 따라 깨진다.
    stripAttributes(document.documentElement);
    stripAttributes(document.body);
    if (originalMatchMedia === undefined) {
        Reflect.deleteProperty(window, 'matchMedia');
    } else {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    }
});
