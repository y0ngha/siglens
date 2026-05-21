import { connection } from 'next/server';
import { Suspense } from 'react';

async function Connection() {
    await connection();
    return null;
}

/**
 * cacheComponents 모드에서 generateMetadata가 dynamic params에 의존할 때
 * metadata를 PPR shell에 prerender하지 않고 request-time으로 미루도록
 * 페이지에 dynamic 신호를 보낸다. Next.js 16 docs 권장 패턴.
 *
 * 사용: page.tsx의 main 태그 바깥, JsonLd 옆에 `<DynamicMetadataMarker />` 한 줄 배치.
 */
export function DynamicMetadataMarker() {
    return (
        <Suspense>
            <Connection />
        </Suspense>
    );
}
