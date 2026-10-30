/**
 * The `/lp/stock-chat` ad landing page.
 */
import { SiglensMark } from '@/widgets/agent-chat/SiglensMark';
import { ChatReplay } from '@/widgets/replay/ChatReplay';
import {
    CHAT_CTA,
    CHAT_CTA_HREF,
    CHAT_SCENARIOS,
    EXAMPLES,
    FAQ,
    HOW,
    HOW_DEMO,
} from './lib/stockChatContent';
import { LpCtaLink } from './ui/LpCtaLink';
import { LpDisclaimer } from './ui/LpDisclaimer';
import { LpEndCta } from './ui/LpEndCta';
import { LpSection } from './ui/LpSection';
import { LpShell } from './ui/LpShell';
import { ReplayDoneIcon } from './ui/ReplayDoneIcon';
import { FaqList } from './ui/stock-chat/FaqList';
import { HowItAnswers } from './ui/stock-chat/HowItAnswers';
import { QUESTION_BUBBLE } from './ui/stock-chat/questionBubble';

const REPLAY_LABELS = {
    region: '시그렌즈 AI 예시 대화',
    pause: '일시정지',
    resume: '재생',
    sources: '출처',
} as const;

/**
 * `ai.siglens.io/lp/stock-chat`: ad-only landing for the `챗GPT 제미나이 주식`
 * ad group, in `ai.siglens.io/about`'s visual language (chart-paper grid glow,
 * the SIGLENS mark, the auto-playing chat replay, the question-to-answer flow,
 * the disclosure FAQ). Korean-only hard-coded copy with no crypto wording.
 */
export function StockChatLanding() {
    return (
        <LpShell
            selfHref="/lp/stock-chat"
            cta={CHAT_CTA}
            ctaHref={CHAT_CTA_HREF}
        >
            {/* `AiAboutPage`'s chart-paper grid and glow, positioned against the shell's `<main>`. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[linear-gradient(to_right,var(--color-secondary-700)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-secondary-700)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)] bg-[size:44px_44px] opacity-50"
            />
            <div className="mx-auto max-w-4xl">
                <section className="flex flex-col items-center pt-12 pb-8 text-center sm:pt-16">
                    <SiglensMark size="lg" className="mb-5" />
                    <h1 className="text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-5xl">
                        주식 전용 AI 챗봇
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-secondary-300">
                        시세와 차트를 직접 조회하고 출처와 기준 시각을 함께
                        알려줘요.
                    </p>
                    <LpCtaLink href={CHAT_CTA_HREF} className="mt-6">
                        {CHAT_CTA}
                    </LpCtaLink>
                </section>

                <div className="motion-safe:animate-[fade-up_400ms_ease-out_both]">
                    <ChatReplay
                        scenarios={CHAT_SCENARIOS}
                        labels={REPLAY_LABELS}
                        sourcesSeparator={false}
                        avatar={<SiglensMark />}
                        doneIcon={<ReplayDoneIcon />}
                    />
                    <p className="mx-auto mt-2 max-w-3xl text-xs text-secondary-400">
                        예시 대화예요. 수치는 실제와 다를 수 있어요.
                    </p>
                </div>

                <LpSection
                    id="lp-examples"
                    align="center"
                    title="이렇게 물어보세요"
                    sub="평소 말투 그대로, 종목 이름으로 물어보면 됩니다."
                    className="mt-20"
                >
                    <ul className="mt-7 flex flex-col items-center gap-3">
                        {EXAMPLES.map(q => (
                            <li key={q} className={QUESTION_BUBBLE}>
                                {q}
                            </li>
                        ))}
                    </ul>
                </LpSection>

                <LpSection
                    id="lp-how"
                    align="center"
                    title="이렇게 답해요"
                    sub="답하기 전에 데이터를 직접 찾아보고, 무엇을 봤는지 함께 보여 줍니다."
                    className="mt-20"
                >
                    <HowItAnswers steps={HOW} demo={HOW_DEMO} />
                </LpSection>

                <LpSection
                    id="lp-faq"
                    align="center"
                    title="자주 묻는 질문"
                    className="mt-20"
                >
                    <FaqList items={FAQ} />
                </LpSection>

                <LpEndCta
                    title="지금 궁금한 종목을 물어보세요"
                    body="시세와 차트를 확인하고 출처와 함께 답해 드려요."
                    cta={CHAT_CTA}
                    href={CHAT_CTA_HREF}
                />

                <LpDisclaimer />
            </div>
        </LpShell>
    );
}
