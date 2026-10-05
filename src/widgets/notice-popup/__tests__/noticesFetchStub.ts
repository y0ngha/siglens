import type { NoticeRecord } from '@/entities/notice/model/types';

/**
 * `GET /api/notices` 전역 `fetch` 스텁.
 *
 * 반환하는 `source`가 호출 계약이다: `mockResolvedValue(list)`는 200 JSON 응답(`Date`는
 * 실제 전송처럼 ISO 문자열로 직렬화된다), `mockRejectedValue(err)`는 네트워크 실패,
 * `mockReturnValue(pending)`은 응답 지연이다. `toHaveBeenCalledTimes`는 fetch 호출 수다.
 *
 * **기본값은 거부다** — 구현 없는 fetch 스파이는 원본을 호출해 실제 네트워크로 새므로,
 * 테스트가 값을 정하지 않은 호출은 눈에 띄게 실패한다.
 */
export function stubNoticesFetch() {
    const source = vi.fn<() => Promise<NoticeRecord[]>>();
    source.mockRejectedValue(new Error('notices fetch not stubbed'));
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
            const list = await source();
            return new Response(JSON.stringify(list), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        })
    );
    return source;
}
