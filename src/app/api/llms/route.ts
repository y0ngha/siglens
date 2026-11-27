import { buildLlmsDocument } from '@/app/api/llms/_lib/buildLlmsDocument';
import {
    LLMS_TXT_CACHE_CONTROL,
    LLMS_TXT_CONTENT_TYPE,
} from '@/app/api/llms/_lib/constants';
import { llmsInputs } from '@/app/api/llms/_lib/llmsInputs';
import type { LlmsHost } from '@/app/api/llms/_lib/model';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';
import { isAiHost } from '@/shared/config/aiHost';

// 호스트마다 본문이 다르다(Host 헤더) — 정적으로 굳힐 수 없다. 본문은 상수와 번들 데이터로만 만든다.
export const dynamic = 'force-dynamic';

/** `/llms.txt`(rewrite). 메인과 ai 호스트가 서로 다른 안내 파일을 받는다. 색인은 막고(noindex) 수집은 막지 않는다. */
export function GET(request: Request): Response {
    const host: LlmsHost = isAiHost(request.headers.get('host'))
        ? 'ai'
        : 'main';
    const body = renderLlmsTxt(buildLlmsDocument(host, llmsInputs()));
    return new Response(body, {
        headers: {
            'Content-Type': LLMS_TXT_CONTENT_TYPE,
            'Cache-Control': LLMS_TXT_CACHE_CONTROL,
            'X-Robots-Tag': 'noindex',
        },
    });
}
