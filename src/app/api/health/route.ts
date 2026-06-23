// ALB 타깃 그룹 헬스체크 전용. shallow — DB/Redis를 타지 않는다.
// (30초마다 호출되므로 외부 의존성 블립이 인스턴스를 죽이면 안 됨)
export const dynamic = 'force-dynamic';

export function GET() {
    return Response.json({ status: 'ok' }, { status: 200 });
}
