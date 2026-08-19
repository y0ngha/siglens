// liveness 전용. shallow — DB/Redis를 타지 않는다.
// (자주 호출되므로 외부 의존성 블립이 인스턴스를 죽이면 안 됨)
//
// 폴링 주체는 2026-08 ALB 제거로 바뀌었지만 **역할은 그대로다**:
//   - `siglens-wait-healthy.sh` — cloudflared를 터널에 붙이기 전 게이트(부팅 시 1회)
//   - `siglens-selfcheck.timer` — 60초마다. 2회 연속 실패면 인스턴스를 Unhealthy로 표시
// 깊은 확인이 필요하면 `/api/ready`(DB+Redis 핑)를 쓸 것.
export const dynamic = 'force-dynamic';

export function GET(): Response {
    return Response.json({ status: 'ok' }, { status: 200 });
}
