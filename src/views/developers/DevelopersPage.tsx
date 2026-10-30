import { getTranslations } from 'next-intl/server';
import type { ApiToolReference } from '@/entities/siglens-api-key/model';
import { PUBLIC_API_BASE_PATH } from '@/shared/config/publicApi';
import type { Locale } from '@/shared/i18n/locales';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import {
    DEVELOPER_SECTION_IDS,
    type DeveloperSectionId,
} from './lib/developersContent';
import { DevelopersHero } from './ui/layout/DevelopersHero';
import { DevelopersToc } from './ui/layout/DevelopersToc';
import { AuthenticationSection } from './ui/sections/AuthenticationSection';
import { DownloadsSection } from './ui/sections/DownloadsSection';
import { LocaleSection } from './ui/sections/LocaleSection';
import { QuickstartSection } from './ui/sections/QuickstartSection';
import { RateLimitsSection } from './ui/sections/RateLimitsSection';
import { ResponsesSection } from './ui/sections/ResponsesSection';
import { StreamingSection } from './ui/sections/StreamingSection';
import { ToolsSection } from './ui/sections/ToolsSection';

interface Props {
    readonly locale: Locale;
    /** Breadcrumb label, shared with the `BreadcrumbList` JSON-LD. */
    readonly title: string;
    /** 사이트 origin(끝 슬래시 없음). 예시 URL과 내려받기 링크의 기준이다. */
    readonly baseUrl: string;
    /** 노출 도구의 문서 표현 — OpenAPI 문서와 같은 빌더에서 온다. */
    readonly tools: readonly ApiToolReference[];
    /** `DEVELOPERS_UPDATED_AT`, already formatted for the locale. */
    readonly updatedAt: string;
}

/**
 * `siglens.io/developers`: 공개 API(`/api/v1`)의 개발자 포털. 작은 레퍼런스 페이지다 — 카드와 표,
 * 코드 블록과 복사 버튼만 쓰고 전부 서버 렌더 텍스트라 크롤러가 본문 전체를 받는다(복사 버튼만 클라이언트).
 *
 * **같은 소스에서 나온 문서다.** 도구 목록·인자 표·curl 예시는 `/api/v1/openapi.json`, SKILL.md,
 * `GET /tools`와 같은 도구 스펙(`tools` props)에서 오고, 한도 숫자는 `PUBLIC_API_RATE_LIMITS`, 오류 코드는
 * `API_ERROR_DOCS`에서 온다 — 문구에 숫자를 따로 적지 않는다(ICU 인자). 카드에는 카탈로그의 사람용 요약
 * (`tools.summaries.<name>`)만 두고, 코어가 에이전트용으로 영어로 쓴 도구 설명은 이 페이지에 싣지 않는다 —
 * 그 원문은 OpenAPI JSON·YAML과 SKILL.md에만 있다. 인자 설명은 영어 그대로 `lang="en"`으로 보여 준다.
 *
 * 이 파일은 조합만 한다: 목차와 각 섹션 `h2`가 같은 제목 표(`sectionTitles`)를 읽고, 섹션 순서는
 * `DEVELOPER_SECTION_IDS`(목차 순서)와 같게 둔다.
 */
export async function DevelopersPage({
    locale,
    title,
    baseUrl,
    tools,
    updatedAt,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'views.developers',
    });
    const apiBase = `${baseUrl}${PUBLIC_API_BASE_PATH}`;
    // 제목을 id로 묶어 둔 표 — `Record`라 새 섹션 id를 추가하고 제목을 빠뜨리면 컴파일이 실패하고, 목차 순서는
    // `DEVELOPER_SECTION_IDS` 하나가 정한다. 목차와 각 섹션 `h2`가 이 표 하나를 읽는다.
    const sectionTitles: Readonly<Record<DeveloperSectionId, string>> = {
        quickstart: t('quickstart.title'),
        authentication: t('authentication.title'),
        'rate-limits': t('rateLimits.title'),
        responses: t('responses.title'),
        streaming: t('streaming.title'),
        locale: t('localeSection.title'),
        tools: t('tools.title'),
        downloads: t('downloads.title'),
    };
    const toc = DEVELOPER_SECTION_IDS.map(id => ({
        id,
        label: sectionTitles[id],
    }));

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <DevelopersHero t={t} />

                <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
                    <DevelopersToc label={t('toc.label')} items={toc} />

                    <div className="min-w-0">
                        <QuickstartSection
                            t={t}
                            title={sectionTitles.quickstart}
                            apiBase={apiBase}
                            tools={tools}
                        />
                        <AuthenticationSection
                            t={t}
                            title={sectionTitles.authentication}
                        />
                        <RateLimitsSection
                            t={t}
                            title={sectionTitles['rate-limits']}
                        />
                        <ResponsesSection
                            t={t}
                            title={sectionTitles.responses}
                        />
                        <StreamingSection
                            t={t}
                            title={sectionTitles.streaming}
                            tools={tools}
                        />
                        <LocaleSection t={t} title={sectionTitles.locale} />
                        <ToolsSection
                            t={t}
                            title={sectionTitles.tools}
                            tools={tools}
                        />
                        <DownloadsSection
                            t={t}
                            title={sectionTitles.downloads}
                            apiBase={apiBase}
                        />

                        <p className="mt-14 text-xs text-secondary-400">
                            {t('updatedAt', { date: updatedAt })}
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
