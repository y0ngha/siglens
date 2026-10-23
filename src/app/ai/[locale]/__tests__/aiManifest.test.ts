import { describe, expect, it } from 'vitest';
import { aiManifestPath, buildAiManifest } from '@/app/ai/[locale]/aiManifest';
import { LOCALE_HREFLANG, LOCALES } from '@/shared/i18n/locales';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const NS = 'app.ai.manifest';

describe('buildAiManifest', () => {
    it('ko: 홈 화면 이름은 시그렌즈 AI이고 ai 호스트 루트에서 시작한다', () => {
        const result = buildAiManifest('ko', catalogTranslator(NS, 'ko'));

        expect(result.short_name).toBe('시그렌즈 AI');
        expect(result.name).toContain('시그렌즈 AI');
        expect(result.id).toBe('/');
        expect(result.start_url).toBe('/');
        expect(result.scope).toBe('/');
        expect(result.display).toBe('standalone');
    });

    /**
     * 끝 슬래시 없는 정본 URL이어야 한다 — Next(`trailingSlash: false`)가 `/en/`을
     * `/en`으로 308 보내므로 `/en/` 스코프면 설치 앱이 열자마자 스코프 밖에 떨어진다.
     */
    it.each(LOCALES)('%s: 진입 경로·lang이 로케일을 따른다', locale => {
        const result = buildAiManifest(locale, catalogTranslator(NS, locale));
        const home = locale === 'ko' ? '/' : `/${locale}`;

        expect(result.start_url).toBe(home);
        expect(result.scope).toBe(home);
        expect(result.lang).toBe(LOCALE_HREFLANG[locale]);
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 이름·설명에 한글이 남지 않는다',
        locale => {
            const result = buildAiManifest(
                locale,
                catalogTranslator(NS, locale)
            );

            for (const value of [
                result.name,
                result.short_name,
                result.description,
            ]) {
                expect(value, `${locale}: ${value}`).not.toMatch(/[가-힣]/);
            }
        }
    );

    it('설치 아이콘 192·512를 싣는다', () => {
        expect(
            buildAiManifest('ko', catalogTranslator(NS, 'ko')).icons
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sizes: '192x192' }),
                expect.objectContaining({ sizes: '512x512' }),
            ])
        );
    });
});

describe('aiManifestPath', () => {
    /**
     * 메인 호스트의 `/{locale}/manifest.webmanifest`와 겹치면 ai 문서가 메인 앱
     * 매니페스트(이름 "시그렌즈", 바로가기 `/market`)를 가리키게 된다.
     */
    it.each(LOCALES)('%s: 내부 ai 라우트 경로를 가리킨다', locale => {
        expect(aiManifestPath(locale)).toBe(
            `/ai/${locale}/manifest.webmanifest`
        );
    });
});
