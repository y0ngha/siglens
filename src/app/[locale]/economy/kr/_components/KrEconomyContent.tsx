import { getLocale, getTranslations } from 'next-intl/server';
// entities/economy/api/*는 server-only(`@upstash/redis` + `next/cache`) 의존이다.
// app 레이어(RSC)에서만 import하므로 클라이언트 번들 누출 위험이 없다.
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import { getKrIndicatorCards } from '@/entities/economy/api/getKrIndicatorCards';
import { resolveIndicatorLabels } from '@/entities/economy/api/resolveIndicatorLabels';
import { etDateOf } from '@/entities/economy/lib/calendarWindow';
import { CALENDAR_COUNTRY_KR } from '@/entities/economy/lib/economyCalendarConstants';
import { EconomicCalendarGrid as EconomicCalendar } from '@/widgets/economy/sections/EconomicCalendarGrid';
import { EconomyKrMacroFacts } from '@/widgets/economy/sections/EconomyKrMacroFacts';
import { KrEconomicIndicatorGrid } from '@/widgets/economy/sections/KrEconomicIndicatorGrid';
import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { resolveLocale } from '@/shared/i18n/locales';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { JsonLd } from '@/shared/ui/JsonLd';
import { calendarEventsForClient } from '../../_lib/calendarEventsForClient';
import { isKrEconomyDegraded } from '../../_lib/economyDegraded';
import { buildEconomyPageJsonLd } from '../../_lib/economyJsonLd';
import { requestNow } from '../../_lib/requestNow';
import { economyKrDescription, economyKrTitle } from '../../constants';
import { KrEconomyDegraded } from './KrEconomyDegraded';

/**
 * `/economy/kr` 본문의 서버 데이터 섹션(지표 카드·캘린더) — 페이지 셸이 Suspense 없이 그린다.
 *
 * cold-gen(ISR 정적 생성 컨텍스트)에서 dynamic API(`cookies`/`headers`/`connection()`)를 쓰지
 * 않는다. `setRequestLocale`은 셸(`EconomyKrPage`)이 이미 불렀으므로 로케일은 요청 스코프에서 찾는다.
 */
export async function KrEconomyContent() {
    const tSeo = await getTranslations('shared.seo');
    const locale = resolveLocale(await getLocale());
    const now = requestNow();
    const todayEt = etDateOf(now);
    // 그리드 기본 선택일 = 현재 인스턴트의 KST 달력일. 그리드가 이벤트를 ET-인스턴트의
    // kstDateKey로 그룹화하므로 앵커도 같은 KST keyspace여야 한다.
    const todayKstKey = kstDateKey(now);

    // 배포 빌드에는 DB가 없어 지표 카드가 비어 구워진다(KrEconomyDegraded + noindex) —
    // 24h 굳지 않게 이 렌더를 60초 뒤 재생성한다. 로더 앞에서 불러도 된다: DB 부재 판정은
    // 로더 결과가 아니라 빌드 환경이다.
    await shortenRevalidateIfDatabaseMissingAtBuild();

    // 지표와 캘린더는 서로 독립이라 병렬로 기다린다. 라벨 조회는 캘린더 결과를 소비하므로
    // 그 뒤에 이어진다. 로더마다 `.catch`를 단다 — 하나라도 reject하면 `Promise.all`이 통째로
    // reject해 `economy/error.tsx`(클라 컴포넌트, noindex를 낼 수 없다)가 200으로 뜬다.
    const [cards, calendarEvents] = await Promise.all([
        getKrIndicatorCards(todayEt).catch((e: unknown) => {
            console.error('[KrEconomyContent] getKrIndicatorCards failed:', e);
            return [];
        }),
        getCalendarFromDb(todayEt, CALENDAR_COUNTRY_KR, locale).catch(
            (e: unknown) => {
                console.error(
                    '[KrEconomyContent] getCalendarFromDb failed:',
                    e
                );
                return [];
            }
        ),
    ]);

    // dict → DB 캐시 → 영어 fallback 체인. 미매핑은 클라 훅이 AI로 채운다(미국과 동일).
    const indicatorLabels = await resolveIndicatorLabels(
        calendarEvents,
        locale
    ).catch((e: unknown): Record<string, string> => {
        console.error('[KrEconomyContent] resolveIndicatorLabels failed:', e);
        return {};
    });

    // 지표도 캘린더도 없으면 `generateMetadata`가 noindex를 건다 — 그 렌더에서 WebPage를 내면
    // "색인하지 말라"면서 "이 URL이 정식 문서"라고 주장하게 되므로 같은 술어로 끈다. 데이터를
    // 가진 유일한 지점이 여기라 셸이 아니라 이 컴포넌트에서 낸다.
    const jsonLd = isKrEconomyDegraded(cards, calendarEvents)
        ? null
        : buildEconomyPageJsonLd({
              path: '/economy/kr',
              title: economyKrTitle(tSeo),
              description: economyKrDescription(tSeo),
              locale,
          });

    return (
        <div className="space-y-6">
            {jsonLd && (
                <>
                    <JsonLd data={jsonLd.webPage} />
                    <JsonLd data={jsonLd.breadcrumb} />
                </>
            )}
            {cards.length === 0 ? (
                <KrEconomyDegraded />
            ) : (
                <>
                    {/* 그리드 위에 둔다 — 크롤러와 사람이 숫자표보다 먼저 읽는 요약이다
                        (미국 라우트에서 `EconomyMacroFacts`가 있는 자리와 같다). */}
                    <EconomyKrMacroFacts cards={cards} />
                    <KrEconomicIndicatorGrid cards={cards} />
                </>
            )}
            {/*
             * 캘린더는 비어 있어도 항상 렌더한다. KR 인제스션을 트리거하는
             * `useEconomicCalendarTrigger`가 `EconomicCalendarGrid` 안에 있어, 데이터가 없을 때
             * 캘린더를 빼면 트리거가 마운트되지 않아 수집이 영영 돌지 않고 그 빈 결과가 24시간
             * ISR에 굳는다. 그리드는 자체 빈 상태를 갖고 있다.
             */}
            <EconomicCalendar
                events={calendarEventsForClient(calendarEvents)}
                today={todayKstKey}
                labels={indicatorLabels}
                country={CALENDAR_COUNTRY_KR}
            />
        </div>
    );
}
