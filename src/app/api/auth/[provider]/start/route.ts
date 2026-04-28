import { NextResponse, type NextRequest } from 'next/server';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
} from '@/infrastructure/auth/oauth/providers';
import { issueOAuthState } from '@/infrastructure/auth/oauth/state';
import { sanitizeNextPath } from '@/lib/authRoutes';

interface StartRouteParams {
    params: Promise<{ provider: string }>;
}

export async function GET(req: NextRequest, { params }: StartRouteParams) {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) {
        return NextResponse.redirect(
            new URL('/login?error=oauth_unknown', req.url)
        );
    }
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'));
    const { state, cookie } = issueOAuthState(provider, next);
    const redirectUri = buildOAuthRedirectUri(provider);
    const authorizeUrl = getOAuthAdapter(provider).authorizeUrl({
        state,
        redirectUri,
    });
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(cookie);
    return response;
}
