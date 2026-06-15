/**
 * Shared tooltip JSX for financials-page metrics.
 *
 * Tooltip copy for financial statement terms used across
 * IncomeStatementSection, BalanceSheetSection, CashFlowSection, and
 * GrowthAnalysisSection. Centralising here prevents silent drift when a term
 * appears in multiple sections and one site is reworded while the others are
 * forgotten.
 *
 * House style: `~이에요`체, 정의→해석→임계값, 2–4문장, fits `max-w-xs`.
 *
 * These are pure JSX fragments (no DST / time-dependent logic), so they
 * are safe as module-level constants — no `'use client'` directive needed here.
 * The `InfoTooltip` wrapper each section passes them into is already
 * `'use client'`.
 */

export const FcfTooltip = (
    <>
        <p>
            본업으로 번 현금에서 설비투자(CapEx)를 빼고 남아 자유롭게 쓸 수 있는
            현금이에요.
        </p>
        <p>배당·자사주·빚 상환의 재원이 돼요.</p>
        <p>꾸준히 양수(+)면 현금 창출력이 탄탄하다는 뜻이에요.</p>
    </>
);

export const NetDebtTooltip = (
    <>
        <p>총부채에서 보유 현금을 뺀 값이에요.</p>
        <p>
            음수(−)면 현금이 빚보다 많은 &lsquo;순현금&rsquo; 상태로 재무가 매우
            탄탄하다는 뜻이에요.
        </p>
    </>
);

export const AccrualsTooltip = (
    <>
        <p>
            장부상 순이익이 실제 영업현금흐름으로 얼마나 뒷받침되는지 보는
            거예요.
        </p>
        <p>
            영업현금흐름이 순이익보다 많으면(비율 1 이상) 이익의 질이 좋다고
            봐요.
        </p>
    </>
);

export const CapExTooltip = (
    <>
        <p>공장·설비처럼 미래를 위해 투자한 돈이에요.</p>
        <p>매출 대비 너무 크면 현금 부담, 적절하면 성장 투자로 봐요.</p>
    </>
);

export const FcfMarginTooltip = (
    <>
        <p>매출 100원당 잉여현금흐름이 몇 원인지예요.</p>
        <p>높을수록 매출을 현금으로 잘 바꾼다는 뜻이에요.</p>
    </>
);

export const GrossMarginTooltip = (
    <>
        <p>매출에서 원가를 뺀 매출총이익이 매출의 몇 %인지예요.</p>
        <p>높을수록 제품의 기본 수익성이 좋다는 뜻이에요.</p>
    </>
);
