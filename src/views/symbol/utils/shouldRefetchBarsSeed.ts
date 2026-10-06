interface BarsSeedRefetchInputs {
    /** 이 탭에서 신뢰 입력이 있었는가(`useHumanInteracted`). */
    readonly humanInteracted: boolean;
    /** 저장된 차트 설정이 있는 재방문자인가(`useHasStoredChartPreferences`). */
    readonly hasStoredChartPreferences: boolean;
    /**
     * 서버가 이 seed를 만든 시점에 정규장이 열려 있었는가(page 생성 시점의 `hasFormingBar` — 세션 기준이지
     * 실제로 봉을 뗐는지가 아니다). 생략 = 참.
     */
    readonly seedHasFormingBarTrimmed: boolean;
    /** 지금(뷰 시점) 형성 중 봉이 있는가(`hasFormingBar(session, now)`). */
    readonly formingBarNow: boolean;
}

/**
 * seed 복원 재조회(`useBars`의 `refetchEnabled`)를 지금 열어도 되는가.
 *
 * ## 규칙 — "seed가 이미 완전할 때만 입력을 기다린다"
 *
 * 입력·저장된 설정이 없으면 원칙적으로 재조회를 미룬다(크롤러 렌더마다 나가던 `getBarsAction`
 * POST 제거). 하지만 **seed에 형성 중 봉이 빠져 있으면 미루면 안 된다.** 정규장 중 서버 seed는
 * 마지막 봉이 오늘(현재 세션 날짜) 봉이면 그 봉을 뺀 채로 나가는데(`quantizeBarsDataToLastClosed`),
 * 그 사이 만들어진 분석의 작도(`chartOverlays`)는 형성 중 봉 시각을 참조한다. seed 봉에 그
 * 시각이 없으면 작도가 정렬되지 않아(`isOverlayAlignedToBars`) "차트 작도" 메뉴가 비고, 사람은
 * 마우스를 움직이기 전까지 한 봉 뒤처진 차트를 본다(PR #957 e2e `chart-overlays.spec.ts` 회귀,
 * 장중 한정).
 *
 * 형성 중 봉이 빠졌는지는 두 시점에서 본다 — 둘 중 하나면 연다.
 * - **생성 시점**(`seedHasFormingBarTrimmed`): ISR HTML이 장중에 만들어져 장 마감 뒤에 열린 경우,
 *   지금은 마감이어도 seed에는 그날 마지막 봉이 없을 수 있다. 생성 시점에 오늘 봉이 아직 없어 실제로는
 *   아무것도 안 뗐더라도, 그 뒤 생긴 오늘 봉을 분석이 참조할 수 있으므로 **세션이 열려 있었는지**로 본다.
 * - **뷰 시점**(`formingBarNow`): 장 마감 중 만들어진 HTML을 장중에 연 경우, 라이브 봉이 필요하다.
 *
 * 둘 다 아니면(장 마감 중 만든 완전한 seed를 장 마감 중에 본다) 입력 전까지 미룬다 — 지표
 * 복원이 필요한 건 오버레이를 켜는 사람이고 그건 입력이 선행한다. UA 분기는 없다.
 */
export function shouldRefetchBarsSeed({
    humanInteracted,
    hasStoredChartPreferences,
    seedHasFormingBarTrimmed,
    formingBarNow,
}: BarsSeedRefetchInputs): boolean {
    return (
        humanInteracted ||
        hasStoredChartPreferences ||
        seedHasFormingBarTrimmed ||
        formingBarNow
    );
}
