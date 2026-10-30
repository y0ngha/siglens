/**
 * @file 하이드레이션 **전에** 일어난 첫 입력을 기억하는 장치.
 *
 * 설치 배너는 첫 사용자 입력에 뜬다(`usePwaInstall`). 그 입력을 듣는 리스너는 React effect가
 * 붙이므로, 페이지가 보이자마자(하이드레이션이 끝나기 전에) 누른 첫 탭·키는 아무도 듣지 않아
 * 사라진다. 하이드레이션 시점은 번들 구성·기기 속도에 따라 수백 ms씩 흔들리므로 그 입력을
 * 놓치면 배너가 언제 뜨는지도 따라 흔들린다.
 *
 * 그래서 루트 레이아웃이 아래 스크립트를 `<body>` 첫머리에 **인라인 `<script>`로** 실어 HTML을
 * 파싱하는 즉시 첫 입력을 `window` 플래그에 남기고, 훅은 마운트 때 그 플래그를 보고 이미 입력이
 * 있었으면 곧바로 배너를 띄운다. `next/script`의 `beforeInteractive`는 쓰지 않는다 — App Router에서는
 * `self.__next_s` 대기열에 들어갔다가 Next 런타임 청크가 로드될 때 실행돼, 하이드레이션과 거의 같은
 * 시점이라 이 목적에 소용이 없다(실측). 이벤트는 훅의 방아쇠와 같은 것만 캡처 단계로 본다.
 */

import { BANNER_TRIGGER_EVENTS } from './bannerTriggers';

/** 프로브가 첫 입력을 남기는 `window` 속성 이름. 인라인 스크립트와 훅이 함께 쓴다. */
export const FIRST_INPUT_FLAG = '__siglensPwaFirstInput';

/** 훅의 방아쇠와 같은 집합(`click`·`keydown` + 지연 `pointerup`) — 놓치는 입력이 없게 한 소스에서 만든다. */
export const FIRST_INPUT_EVENTS = [
    ...BANNER_TRIGGER_EVENTS,
    'pointerup',
] as const;

/** 루트 레이아웃이 `<body>` 첫머리에 인라인으로 싣는 프로브 — 첫 입력 하나만 남기고 리스너를 걷는다. */
export const FIRST_INPUT_PROBE_SCRIPT = `(function(){var k=${JSON.stringify(FIRST_INPUT_FLAG)},e=${JSON.stringify(FIRST_INPUT_EVENTS)},o={capture:true,passive:true};function f(){window[k]=true;e.forEach(function(t){removeEventListener(t,f,o)})}e.forEach(function(t){addEventListener(t,f,o)})})();`;

/** 하이드레이션 전에 첫 입력이 있었는가. 서버·프로브가 없는 환경에서는 false. */
export function hadFirstInputBeforeHydration(): boolean {
    return (
        typeof window !== 'undefined' &&
        (window as unknown as Record<string, unknown>)[FIRST_INPUT_FLAG] ===
            true
    );
}
