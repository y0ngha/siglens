/**
 * 관심종목·최근 본 종목 저장 함수가 받는 저장소 모양. `localStorage`의 쓰는 부분만 적어
 * SSR(`null`)·테스트(메모리 저장소)에서 주입할 수 있게 한다.
 */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/**
 * 기본 저장소(`window.localStorage`). 서버 렌더이거나 접근 자체가 막힌 브라우저(사이트
 * 데이터를 차단하면 getter가 던진다)면 null — 호출부는 "저장소 없음"으로 처리한다.
 */
export function getDefaultLocalStorage(): StorageLike | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}
