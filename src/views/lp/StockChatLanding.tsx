import { AI_SITE_URL } from '@/shared/config/aiHost';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LP_PRIMARY_BUTTON, LpDisclaimer, LpShell } from './ui/LpShell';

const CTA = 'AI에게 물어보기';
const CTA_HREF = `${AI_SITE_URL}/`;

const EXAMPLES = [
    '삼성전자 요즘 어때?',
    '엔비디아 지금 비싼 편?',
    '이번 주 미국 시장 뉴스 중요한 것만',
] as const;

const HOW = [
    {
        title: '시세 직접 조회',
        body: '답하기 전에 최신 시세와 차트를 직접 찾아봅니다.',
    },
    {
        title: '지표는 규칙으로 계산',
        body: 'RSI, 이동평균 같은 지표는 AI가 짐작하지 않고 정해진 규칙으로 계산합니다.',
    },
    {
        title: '답변마다 출처와 기준 시각',
        body: '어떤 데이터를 언제 기준으로 봤는지 답변과 함께 보여 줍니다.',
    },
] as const;

const FAQ = [
    {
        q: '어떤 종목을 물어볼 수 있나요?',
        a: '미국 주식과 ETF, 코스피와 코스닥 종목을 물어볼 수 있어요.',
    },
    {
        q: '돈이 드나요?',
        a: '무료로 쓸 수 있어요. 로그인하면 더 많이 물어볼 수 있어요.',
    },
    {
        q: '투자 추천을 해주나요?',
        a: '아니요. 매수나 매도를 권하지 않고, 데이터로 지금 상황을 설명해 드려요.',
    },
] as const;

/**
 * `ai.siglens.io/lp/stock-chat`: ad-only landing for the `챗GPT 제미나이 주식`
 * ad group. Korean-only hard-coded copy with no crypto wording (spec
 * `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 */
export function StockChatLanding() {
    return (
        <LpShell selfHref="/lp/stock-chat" cta={CTA} ctaHref={CTA_HREF}>
            <section className="flex flex-col items-center pt-14 pb-10 text-center sm:pt-20">
                <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                    주식 전용 AI 챗봇
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                    시세와 차트를 직접 조회하고 출처와 기준 시각을 함께
                    알려줘요.
                </p>
                <a href={CTA_HREF} className={cn(LP_PRIMARY_BUTTON, 'mt-6')}>
                    {CTA}
                </a>
            </section>

            <section aria-labelledby="lp-examples" className="mt-6">
                <h2
                    id="lp-examples"
                    className={cn(HEADING_SECTION, 'text-center text-2xl')}
                >
                    이렇게 물어보세요
                </h2>
                <ul className="mt-6 flex flex-col items-center gap-3">
                    {EXAMPLES.map(q => (
                        <li
                            key={q}
                            className="rounded-lg bg-primary-600/15 px-4 py-2.5 text-sm text-secondary-100"
                        >
                            {q}
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="lp-how" className="mt-14">
                <h2
                    id="lp-how"
                    className={cn(HEADING_SECTION, 'text-center text-2xl')}
                >
                    이렇게 답해요
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                    {HOW.map(({ title, body }) => (
                        <li key={title} className={cn(SURFACE_CARD, 'p-5')}>
                            <h3 className="text-base font-semibold text-secondary-100">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-secondary-400">
                                {body}
                            </p>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="lp-faq" className="mt-14">
                <h2
                    id="lp-faq"
                    className={cn(HEADING_SECTION, 'text-center text-2xl')}
                >
                    자주 묻는 질문
                </h2>
                <dl className="mx-auto mt-6 flex max-w-2xl flex-col gap-4">
                    {FAQ.map(({ q, a }) => (
                        <div key={q} className={cn(SURFACE_CARD, 'p-5')}>
                            <dt className="font-semibold text-secondary-100">
                                {q}
                            </dt>
                            <dd className="mt-2 text-sm leading-6 text-secondary-400">
                                {a}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            <LpDisclaimer />
        </LpShell>
    );
}
