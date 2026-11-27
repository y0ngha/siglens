import { checkMigrations } from '@/app/api/ready/_lib/checkMigrations';

// 온박스 마이그레이션 게이트(`siglens-wait-migrations.sh`)가 부팅 때 폴링한다. /api/health(shallow)는
// selfcheck가 1분마다 쓰므로 DB에 묶지 않고, 이 라우트가 DB 판정을 맡는다.
export const dynamic = 'force-dynamic';

/**
 * Cloudflare를 거친 요청이 싣는 헤더. 이 라우트는 박스 안(127.0.0.1)의 게이트 전용이라 외부 요청은
 * 처리하지 않는다: 공개 인터넷에서 DB 조회를 유발하는 입구가 되면 안 된다. 게이트의 curl은 이
 * 헤더를 보내지 않는다(`migrationGateContract` 가드가 지킨다).
 */
const EDGE_HEADERS = ['cf-ray', 'cf-connecting-ip'] as const;

/**
 * 이미지의 마이그레이션 저널이 DB에 모두 적용됐는지 알린다(적용은 하지 않는다).
 * 응답은 개수만 싣는다 — 태그 이름은 서버 로그에만 남는다.
 */
export async function GET(request: Request): Promise<Response> {
    if (EDGE_HEADERS.some(name => request.headers.has(name))) {
        return new Response(null, {
            status: 404,
            headers: { 'Cache-Control': 'no-store' },
        });
    }
    const { httpStatus, body } = await checkMigrations();
    return Response.json(body, {
        status: httpStatus,
        headers: { 'Cache-Control': 'no-store' },
    });
}
