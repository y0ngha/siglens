import { NextResponse, type NextRequest } from 'next/server';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
} from '@/features/auth-oauth/lib/providers';
import {
    OAuthStateSecretMisconfiguredError,
    issueOAuthState,
} from '@/features/auth-oauth/lib/state';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

interface StartRouteParams {
    params: Promise<{ provider: string }>;
}

export async function GET(
    req: NextRequest,
    { params }: StartRouteParams
): Promise<NextResponse> {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) {
        return NextResponse.redirect(
            new URL('/login?error=oauth_unknown', req.url)
        );
    }
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'));
    let state: string;
    let cookie: ReturnType<typeof issueOAuthState>['cookie'];
    try {
        ({ state, cookie } = issueOAuthState(provider, next));
    } catch (error) {
        if (error instanceof OAuthStateSecretMisconfiguredError) {
            // Fail closed: never start an OAuth flow without a signed state.
            return NextResponse.redirect(
                new URL('/login?error=oauth_unknown', req.url)
            );
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
