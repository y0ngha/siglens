/**
 * 수급 데이터가 없는 종목의 빈 화면 — 시장별로 이유를 밝힌다.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsMarket } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

const HEADING_ID = 'flows-empty-heading';

/**
 * 이 종목에는 수급 데이터가 전혀 없다(신규 상장·CUSIP 미매핑·소형주 등). 장애(degrade)가 아니라 정상 상태라
 * 색인·상태 코드는 그대로고, 화면은 "데이터 없음"을 명시해 빈 화면과 구분한다.
 *
 * 한국 종목(`market: 'kr'`)은 DART 지분공시 문구다 — 2년 안에 공시가 없거나 DART 회사 매핑이 없을 때 "데이터 없음", DART 초기 수집
 * 중이면 "모으는 중"이다(13F·FINRA 수집 상태는 보지 않는다). `DART_API_KEY`가 없으면 호출부가 수집 중이 아니라고 넘겨 "데이터 없음"이
 * 된다 — 설정 여부를 화면에 드러내지 않는다. 기관·외국인 순매수를 제공하지 않는다는 안내와 출처를 함께 둔다.
 */
export function InvestorFlowsEmpty({
    collecting = false,
    shortCollecting = false,
    market = 'us',
}: {
    /** 초기 수집이 아직 안 끝났다(미국 13F, 한국 DART) — 스냅샷이 없는 것이 "데이터 없음"이 아니라 "아직 못 모음"일 수 있다. */
    readonly collecting?: boolean;
    /** FINRA가 켜져 있고 공매도 첫 수집도 아직이다 — 본문이 공매도도 함께 말한다. 미국 13F가 수집 중일 때만 의미가 있다. */
    readonly shortCollecting?: boolean;
    readonly market?: InvestorFlowsMarket;
}) {
    const t = useTranslations('widgets.investor-flows');
    const copy = (() => {
        if (market === 'kr') {
            return collecting
                ? {
                      title: t('collecting.dart.title'),
                      body: t('collecting.dart.body'),
                  }
                : { title: t('kr.empty.title'), body: t('kr.empty.body') };
        }
        if (!collecting)
            return { title: t('empty.title'), body: t('empty.body') };
        return {
            title: t('collecting.empty.title'),
            body: shortCollecting
                ? t('collecting.empty.body')
                : t('collecting.empty.bodyInstitutionalOnly'),
        };
    })();
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-2', HEADING_SECTION)}>
                {copy.title}
            </h2>
            <p className="text-sm text-secondary-300">{copy.body}</p>
            {market === 'kr' && (
                <>
                    <p className="mt-3 text-xs leading-relaxed text-secondary-300">
                        {t('kr.notProvided')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-secondary-400">
                        {t('kr.source')}
                    </p>
                </>
            )}
        </section>
    );
}
