import { NextResponse, type NextRequest } from 'next/server';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
    OAuthStateSecretMisconfiguredError,
    issueOAuthState,
} from '@/features/auth-oauth';
import { localePath, splitLocalePath } from '@/shared/i18n/locales';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

interface StartRouteParams {
    params: Promise<{ provider: string }>;
}

export async function GET(
    req: NextRequest,
    { params }: StartRouteParams
): Promise<NextResponse> {
    const { provider } = await params;
    // `/api/*`는 로케일 접두사가 없다. 에러 시 돌려보낼 로그인 페이지의 로케일은
    // 호출자가 넘긴 `next`에서 복원한다 — 안 그러면 `/en/login`에서 시작한
    // 사용자가 한국어 로그인 페이지로 튕긴다.
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'));
    const loginUrl = new URL(
        `${localePath(splitLocalePath(next).locale, '/login')}?error=oauth_unknown`,
        req.url
    );
    if (!isOAuthProvider(provider)) {
        return NextResponse.redirect(loginUrl);
    }
    let state: string;
    let cookie: ReturnType<typeof issueOAuthState>['cookie'];
    try {
        ({ state, cookie } = issueOAuthState(provider, next));
    } catch (error) {
        if (error instanceof OAuthStateSecretMisconfiguredError) {
            // Fail closed: never start an OAuth flow without a signed state.
            return NextResponse.redirect(loginUrl);
        }
        throw error;
    }
    const redirectUri = buildOAuthRedirectUri(provider);
    const authorizeUrl = getOAuthAdapter(provider).authorizeUrl({
        state,
        redirectUri,
    });
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(cookie);
    return response;
}
