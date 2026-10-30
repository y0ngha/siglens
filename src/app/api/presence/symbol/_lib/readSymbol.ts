import { isAdmissibleSymbolShape } from '@/shared/config/ticker';

/**
 * 요청 본문 `{ symbol }`에서 대문자 심볼을 꺼낸다. JSON이 아니거나 객체가 아니거나 심볼 형상이
 * 맞지 않으면 `null`이다(호출부가 400으로 답한다). 존재 여부는 검증하지 않는다 — 형상만 본다.
 */
export async function readSymbol(request: Request): Promise<string | null> {
    try {
        const body: unknown = await request.json();
        if (typeof body !== 'object' || body === null) return null;
        const { symbol } = body as { symbol?: unknown };
        if (typeof symbol !== 'string') return null;
        const upper = symbol.toUpperCase();
        return isAdmissibleSymbolShape(upper) ? upper : null;
    } catch {
        return null;
    }
}
