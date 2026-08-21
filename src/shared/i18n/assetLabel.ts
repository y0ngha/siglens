/**
 * `'use client'`를 붙이지 않는다 — 이 훅은 next-intl의 `useTranslations`만
 * 쓰고, 그건 RSC 진입점에도 있어 **경계와 무관**하다. 클라이언트 전용으로
 * 표시하면 서버 컴포넌트가 이 훅을 부르는 순간 그 서브트리 렌더가 죽는다
 * (라운드 12에 실제로 그렇게 냈다).
 */
import { useTranslations } from 'next-intl';

/**
 * 심볼 → 표시 이름.
 *
 * 지수·섹터명은 config 상수에 **한국어로만** 있고(`koreanName`), 그 값은 core
 * 프롬프트로도 흘러간다. 그래서 화면에서는 심볼로 카탈로그를 다시 찾는다.
 *
 * ## 왜 전용 네임스페이스(`shared.assetName`)인가
 *
 * 키가 심볼 변수라 정적 스캔이 못 본다 → 추출기가 네임스페이스를 통째로 넓힌다.
 * 이 표를 `widgets.dashboard` 아래 두면 **그 슬라이스 전체**가 크롬 페이로드에
 * 실려 카탈로그의 36%가 전 라우트에 딸려갔다(목표 15% 미만). 2세그먼트 전용
 * 네임스페이스로 빼면 넓혀도 이 표만 실린다.
 *
 * ## 왜 훅인가
 *
 * 예전에는 `assetLabel(t, symbol, fallback)`처럼 번역자를 **인자로** 받았다.
 * 추출기는 `t(변수)` 호출만 동적으로 보므로 그 파일은 "리터럴 전용"으로 분류됐고,
 * 네임스페이스가 좁혀져 **번역 60개가 페이로드에서 통째로 빠졌다** — 전 로케일이
 * 한국어로 렌더되는데 `t.has()` 폴백 때문에 에러조차 안 났다. 훅이 직접
 * `useTranslations`를 부르면 그 오분류가 원천적으로 불가능하다.
 */
export function useAssetLabel(): (symbol: string, fallback: string) => string {
    const t = useTranslations('shared.assetName');
    return (symbol, fallback) => {
        // next-intl은 `.`를 중첩 구분자로 쓴다. `091160.KS`를 그대로 키에 넣으면
        // `assetName → 091160 → KS`를 찾다 실패하고, 카탈로그 로드 시점에
        // `INVALID_KEY`를 매 요청 console.error로 뱉는다. 이스케이프 수단이 없어
        // 양쪽에서 똑같이 치환하는 것 말고는 방법이 없다.
        const key = symbol.replace(/\./g, '_');
        return t.has(key) ? t(key) : fallback;
    };
}
