// 로컬 in-process 태그 무효화 맵 (soft invalidation).
// 단일 인스턴스(ASG desired=1)라 로컬 맵이 source of truth. revalidateTag가 즉시 기록해
// 같은 인스턴스의 후속 get에서 read-your-writes가 보장된다.
//
// 확장 경로(spec §8): 멀티 인스턴스 전파가 필요해지면
//   1차 → S3 태그 마커(siglens-isr/tags/{tag}에 revalidatedAt 객체)
//   2차 → DynamoDB 태그 스토어
// 로 교체한다. 현재는 의도적으로 로컬 맵만 둔다.
//
// 메모리: revalidateTag된 태그만 누적되며 심볼 유니버스가 유한해 상한이 수만 엔트리(~수 MB).
// 우려 시 LRU 도입.
const revalidatedAt = new Map();

export function markRevalidated(tag, now) {
    revalidatedAt.set(tag, now);
}

export function maxRevalidatedAt(tags) {
    return tags.reduce((max, tag) => {
        const t = revalidatedAt.get(tag) ?? 0;
        return t > max ? t : max;
    }, 0);
}

export function _resetForTest() {
    revalidatedAt.clear();
}
