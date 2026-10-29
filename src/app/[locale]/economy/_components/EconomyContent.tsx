import { getLocale, getTranslations } from 'next-intl/server';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이다.
// app 레이어(RSC)에서만 import하므로 클라이언트 번들 누출 위험이 없다.
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { etDateOf } from '@/entities/economy/lib/calendarWindow';
import { CALENDAR_COUNTRY } from '@/entities/economy/lib/economyCalendarConstants';
import { macroBriefingDayKey } from '@/entities/economy/lib/macroBriefingDayKey';
import { EconomicCalendarGrid as EconomicCalendar } from '@/widgets/economy/sections/EconomicCalendarGrid';
import { EconomicIndicatorGrid } from '@/widgets/economy/sections/EconomicIndicatorGrid';
import { EconomyMacroFacts } from '@/widgets/economy/sections/EconomyMacroFacts';
import { MacroBriefing } from '@/widgets/economy/sections/MacroBriefing';
import {
    shortenRevalidateIfDatabaseMissingAtBuild,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { resolveLocale } from '@/shared/i18n/locales';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { JsonLd } from '@/shared/ui/JsonLd';
import { hasEconomyData } from '../_lib/economyDegraded';
import { buildEconomyPageJsonLd } from '../_lib/economyJsonLd';
import { requestNow } from '../_lib/requestNow';
import { economyDescription, economyTitle } from '../constants';
import { EconomyDegraded } from './EconomyDegraded';

/**
 * `/economy` 본문의 서버 데이터 섹션(스냅샷·브리핑·캘린더) — 페이지 셸이 Suspense 없이 그린다.
 *
 * cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`)를 쓰지
 * 않는다. `setRequestLocale`은 셸(`EconomyPage`)이 이미 불렀으므로 로케일은 요청 스코프에서 찾는다.
 * 스냅샷이 비면(또는 실패하면) `generateMetadata`와 같은 판정으로 `EconomyDegraded`만 그린다.
 */
export async function EconomyContent() {
    const tSeo = await getTranslations('shared.seo');
    const locale = resolveLocale(await getLocale());
    // 캘린더는 스냅샷·브리핑과 무관한 DB 조회라 먼저 출발시키고 아래에서 받는다 — 셋을 한 줄로
    // 기다리면 콜드 렌더가 조회 세 개를 직렬로 기다린다. ET-오늘은 1회 계산해 reader 앵커와
    // 그리드 기본 선택일이 공유한다(ISR 안전: 결정론적 Intl 변환, dynamic API 미사용).
    //
    // 대가: 스냅샷이 degrade면(아래에서 일찍 반환) 이 조회 결과를 버린다. degrade 렌더는 드물고
    // 버리는 것은 캐시된 읽기 한 번이라 감수한다. 두 promise 모두 `.catch`가 붙어 있어 미처리
    // rejection은 남지 않는다.
    const now = requestNow();
    const todayEt = etDateOf(now);
    const calendarEventsPromise = getCalendarFromDb(
        todayEt,
        CALENDAR_COUNTRY,
        locale
    ).catch((e: unknown) => {
        console.error('[EconomyContent] getCalendarFromDb failed:', e);
        return [];
    });
    // dict → DB 캐시 → 영어 fallback 체인. 미매핑은 클라 훅이 AI로 채운다.
    // 캘린더에만 의존하므로 캘린더가 오는 즉시 이어 붙인다.
    const indicatorLabelsPromise = calendarEventsPromise.then(events =>
        resolveIndicatorLabels(events, locale).catch(
            (e: unknown): Record<string, string> => {
                console.error(
                    '[EconomyContent] resolveIndicatorLabels failed:',
                    e
                );
                return {};
            }
        )
    );

    // throw가 전파되면 빈 렌더가 ISR에 굳으므로 null로 폴백해 EconomyDegraded를 반환한다.
    const snapshot = await getEconomySnapshotStatic().catch(e => {
        console.error('[EconomyContent] snapshot failed:', e);
        return null;
    });
    // 빌드 중 FMP가 실패했으면 이 prerender를 60초 뒤 재생성되게 한다(헬퍼 JSDoc).
    await shortenRevalidateIfFmpFailedAtBuild();
    // 배포 빌드에는 DB가 없어 캘린더가 비어 구워진다 — 같은 방식으로 60초 뒤 재생성한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
    if (!hasEconomyData(snapshot)) return <EconomyDegraded />;

    // UTC 날짜 버킷 키(core 거시 브리핑 캐시 키와 같은 경계)로 브리핑 peek seed를 읽는다.
    // miss는 null → 클라가 submit한다. 실패는 로그를 남기고 흡수한다(SERVER.md#SA-2).
    const peekSeed = await peekMacroBriefingStatic(
        snapshot,
        macroBriefingDayKey(now)
    ).catch(e => {
        console.error('[EconomyContent] peekMacroBriefingStatic failed:', e);
        return null;
    });

    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로 앵커도 같은 KST keyspace여야 한다(정오-ET 합성은 KST
    // 다음날로 밀려 오늘 그룹을 건너뛴다).
    const todayKstKey = kstDateKey(now);
    const calendarEvents = await calendarEventsPromise;
    // `analyzedAt`은 클라이언트 그리드가 읽지 않는다. 타입에서 빼는 것만으로는 런타임 값이
    // flight에 그대로 실리므로 여기서 실제로 떼어낸다.
    const calendarEventsForClient = calendarEvents.map(
        ({ analyzedAt: _analyzedAt, ...rest }) => rest
    );
    const indicatorLabels = await indicatorLabelsPromise;
    // 구조화데이터를 셸이 아니라 **여기서** 낸다(FAQ는 예외 — 셸에 남는다). degrade 분기를
    // 지난 렌더에서만 도달하므로 `generateMetadata`가 noindex를 건 렌더에는 실리지 않는다.
    const jsonLd = buildEconomyPageJsonLd({
        path: '/economy',
        title: economyTitle(tSeo),
        description: economyDescription(tSeo),
        locale,
    });

    return (
        <div className="space-y-6">
            <JsonLd data={jsonLd.webPage} />
            <JsonLd data={jsonLd.breadcrumb} />
            {/* SSR 크롤 텍스트 — MacroBriefing은 'use client'라 크롤러에 빈 HTML을
                반환한다. EconomyMacroFacts가 서버사이드에서 핵심 수치를 텍스트로
                노출해 검색 엔진이 수치 데이터를 색인할 수 있도록 한다. */}
            <EconomyMacroFacts snapshot={snapshot} />
            <MacroBriefing peekSeed={peekSeed} />
            <EconomicIndicatorGrid snapshot={snapshot} />
            <EconomicCalendar
                events={calendarEventsForClient}
                today={todayKstKey}
                labels={indicatorLabels}
                country={CALENDAR_COUNTRY}
            />
        </div>
    );
}
