/**
 * Shared tooltip JSX for congress-trades page metrics.
 *
 * House style: `~이에요`체, 2–3문장, fits `max-w-xs`.
 *
 * These are pure JSX fragments (no time-dependent logic), so they are safe
 * as module-level constants — no `'use client'` directive needed here.
 * The `InfoTooltip` wrapper passed in each usage is already `'use client'`.
 */

/**
 * 금액 구간 tooltip — STOCK Act 공시 구간 정책을 설명한다.
 *
 * STOCK Act(2012)는 의원이 정확한 금액이 아닌 구간(예: $1,001–$15,000)만
 * 공시하도록 허용해요. 그래서 거래 규모를 정확히 알기 어려울 수 있어요.
 * 넓은 구간일수록 실제 금액의 불확실성이 커져요.
 */
export const AmountRangeTooltip = (
    <>
        <p>
            STOCK Act(2012)는 의원이 정확한 금액 대신 구간(예: $1,001–$15,000)만
            공시하도록 허용해요.
        </p>
        <p>
            그래서 거래의 실제 규모를 정확히 알기 어렵고, 구간이 넓을수록
            불확실성이 더 커져요.
        </p>
    </>
);

/**
 * 공시 지연 tooltip — 거래 시점과 공시 시점 사이의 간격을 설명한다.
 *
 * STOCK Act는 거래 후 최대 45일 이내에 공시하도록 규정하고 있어요.
 * 그래서 공시일이 실제 거래일보다 수 주 늦을 수 있어요.
 * 최근 공시라도 거래 자체는 한 달 이상 전에 이뤄졌을 수 있어요.
 */
export const DisclosureLagTooltip = (
    <>
        <p>
            STOCK Act는 거래 후 최대 45일 이내에 공시하도록 의무화하고 있어요.
        </p>
        <p>
            공시일이 실제 거래일보다 수 주 늦을 수 있어서, 최근 공시라도 거래는
            한 달 이상 전에 이뤄졌을 수 있어요.
        </p>
    </>
);

/**
 * 상원 chamber tooltip — 임기 및 규모를 설명한다.
 */
export const SenateChamberTooltip = (
    <>
        <p>
            미국 상원(Senate)은 50개 주에서 각 2명씩, 총 100명의 의원으로
            구성돼요.
        </p>
        <p>임기는 6년이에요.</p>
    </>
);

/**
 * 하원 chamber tooltip — 임기 및 규모를 설명한다.
 */
export const HouseChamberTooltip = (
    <>
        <p>
            미국 하원(House of Representatives)은 인구 비례에 따라 선출된
            435명의 의원으로 구성돼요.
        </p>
        <p>임기는 2년이에요.</p>
    </>
);

/**
 * 구분(원) 열 헤더 tooltip — 상원·하원 임기를 한 번에 설명한다.
 *
 * 상원(Senate) 임기 6년, 하원(House) 임기 2년을 간결하게 비교해요.
 */
export const ChamberColumnTooltip = (
    <>
        <p>상원(Senate)은 임기 6년, 하원(House)은 임기 2년이에요.</p>
        <p>임기가 긴 상원의원의 거래는 장기 투자 관점을 반영할 수 있어요.</p>
    </>
);

/**
 * 상원 공시 링크 tooltip — efdsearch 동의 페이지 흐름을 안내한다.
 *
 * 상원(Senate) 공시는 efdsearch.senate.gov의 disclaimer 동의 세션이 있어야
 * 열 수 있어요. 세션 없이 deep link를 직접 열면 403 오류가 발생해요.
 * 검색 페이지에서 PTR ID로 다시 찾을 수 있어요.
 */
export const SenateDisclosureTooltip = (
    <p className="max-w-xs leading-relaxed">
        상원 공시(efdsearch)는 동의 페이지를 통과해야 열 수 있어요. 검색
        페이지에서 PTR ID로 다시 찾아주세요. 하원 공시는 PDF 직링크라 바로
        열려요.
    </p>
);
