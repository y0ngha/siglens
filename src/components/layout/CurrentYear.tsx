// cacheComponents 비활성 기간 동안 'use cache' directive 제거. 단순 동기 렌더로
// 충분(year는 매 요청마다 server time으로 평가, 비용 무시할 수준).

export function CurrentYear() {
    return <>{new Date().getFullYear()}</>;
}
