import { cacheLife } from 'next/cache';

// 'use cache' 안에서 new Date()를 호출하지만 cacheLife('days')로 캐시 기간을
// 일 단위로 묶어두면 재검증 시점에만 year가 다시 평가되어 결정적으로 동작한다.
// year는 연 1회만 바뀌므로 일 단위 revalidate면 cross-year boundary도 24시간
// 이내에 자동 반영된다. cacheComponents non-determinism 경고를 피하는 의도.
export async function CurrentYear() {
    'use cache';
    cacheLife('days');
    return <>{new Date().getFullYear()}</>;
}
