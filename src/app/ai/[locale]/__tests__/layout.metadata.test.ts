import { describe, expect, it, vi } from 'vitest';

// `next/font` 로더는 Next 컴파일러 밖(vitest)에서 함수가 아니다. 이 테스트는 메타데이터만 본다.
vi.mock('@/app/fontVariables', () => ({ FONT_VARIABLE_CLASSES: '' }));
import { generateMetadata } from '@/app/ai/[locale]/layout';
import { aiManifestPath } from '@/app/ai/[locale]/aiManifest';
import { brandAiName } from '@/shared/lib/brandName';
import { LOCALES } from '@/shared/i18n/locales';

/**
 * ai 레이아웃이 매니페스트를 직접 가리키지 않으면 `app/manifest.ts`가 자동으로 걸려,
 * ai 호스트에서 설치한 앱이 메인 사이트 이름("시그렌즈")과 바로가기(`/market`)를 단다.
 */
describe('ai layout generateMetadata — PWA', () => {
    it.each(LOCALES)('%s: ai 전용 매니페스트를 가리킨다', async locale => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale }),
        });
        expect(metadata.manifest).toBe(aiManifestPath(locale));
    });

    it.each(LOCALES)(
        '%s: iOS 홈 화면 이름은 로케일 제품명이다(긴 SEO 제목이 아니라)',
        async locale => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale }),
            });
            expect(metadata.appleWebApp).toEqual({
                title: brandAiName(locale),
            });
        }
    );
});
