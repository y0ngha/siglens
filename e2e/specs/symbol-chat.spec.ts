import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { resetChatTokens } from '../support/resetChatTokens';

/**
 * `@webkit`-tagged symbol-chat spec — Task 5 (last) of the E2E Tier 1 plan.
 *
 * Runs on BOTH Playwright projects: chromium (Desktop Chrome, runs every spec)
 * and webkit (iPhone 14, runs only `@webkit`-tagged specs). All selectors and
 * interactions below are written to work on both — see the per-step notes.
 *
 * What this proves: the full client → `chatAction` server action →
 * `getLlmProvider()` → `fakeCallAiProvider` round-trip renders a deterministic
 * assistant reply, all same-origin (localhost:4300), so the network guard in
 * `support/fixtures` sees zero external requests.
 *
 * Chat UI (verified against the real DOM, NOT the unit-test mocks):
 *
 *   - The chat is NOT the mobile analysis vaul drawer (that is the separate
 *     `MobileAnalysisSheet`, mounted only on the chart page). It is a single
 *     `FloatingChatButton` mounted once in the symbol layout, shared by desktop
 *     AND mobile — only its fixed position differs via `md:` classes. So the
 *     panel survives client-side tab navigation (layout-level mount).
 *
 *   - Trigger: a fixed button labelled `AI 채팅 열기` (→ `AI 채팅 닫기` once open).
 *
 *   - Input: a controlled `<textarea>` whose placeholder is
 *     `질문을 입력하세요… (Enter로 전송)` once analysis is ready (else
 *     `분석이 완료된 후 질문할 수 있어요`), `disabled` until ready. On the chart page
 *     `isAnalysisReady = !displayAnalyzing`, which flips true only AFTER the ~9s
 *     progress-finishing animation (real setTimeout). We wait for the textarea
 *     to be ENABLED with a generous timeout and do NOT freeze the clock (a
 *     frozen clock would stall those timers and the input would never enable).
 *
 *   - Send: a button `aria-label="전송"`, or Enter. We click the send button.
 *
 *   - Assistant bubble (`MarkdownText`): the deterministic fake
 *     (`FakeChatProvider.fakeCallAiProvider`) echoes the last user turn as
 *     `[E2E <model>] "<text>"에 대한 테스트 답변입니다. 이 응답은 실제 LLM 호출 없이
 *     생성된 결정적 응답입니다.`, so we assert the bubble contains
 *     `"지금 사도 돼?"에 대한 테스트 답변입니다`.
 *
 * WEBKIT-SPECIFIC DOM REALITY (iPhone 14 / chart page):
 *   The chart page mounts the `MobileAnalysisSheet` vaul drawer (always open,
 *   `dismissible={false}`). vaul's Radix Dialog (1) marks the sibling chat panel
 *   `aria-hidden="true"` and (2) installs a focus scope that redirects focus off
 *   the textarea. Consequences handled here:
 *     - Role queries (`getByRole`) skip the aria-hidden chat subtree, so the send
 *       button and tab links are addressed via CSS locators on webkit. We use CSS
 *       locators uniformly (also valid on chromium).
 *     - Synthetic keystrokes never reach the textarea (focus is yanked back). We
 *       drive the controlled input via the native value setter + an `input` event
 *       — exactly how the browser commits text to a React-controlled field — then
 *       click the send button. This mirrors real text entry (a real soft keyboard
 *       on a device does commit; only Playwright's programmatic focus is trapped)
 *       and works identically on both projects.
 *
 * CHAT TOKEN BUDGET: `chatAction` enforces a daily 5-message limit per hashed IP
 * in Redis (~24h TTL), NOT reset by global-setup. `beforeEach` clears it via
 * `resetChatTokens` so the round-trip is deterministic across runs/retries
 * (otherwise the assistant renders `token_exhausted` instead of the fake answer).
 */

const SYMBOL = 'AAPL';

// 분석 진행 마무리 애니메이션(~9s, 실 setTimeout)이 끝나야 입력이 활성화되므로 넉넉히.
const ANALYSIS_READY_TIMEOUT_MS = 25_000;
// chatAction → fake provider 왕복(서버 액션 + onMutate의 최소 analyzing 단계 1.5s)을 수용.
const CHAT_REPLY_TIMEOUT_MS = 15_000;

const READY_PLACEHOLDER = '질문을 입력하세요… (Enter로 전송)';
const QUESTION = '지금 사도 돼?';
const EXPECTED_ANSWER_FRAGMENT = `"${QUESTION}"에 대한 테스트 답변입니다`;

/**
 * Commit text to the React-controlled chat textarea without keyboard input.
 * Uses the prototype value setter + a bubbling `input` event so React's
 * onChange fires — the only reliable path on webkit, where vaul's focus scope
 * redirects synthetic keystrokes away from the textarea (see file header).
 */
async function typeIntoChat(input: Locator, text: string): Promise<void> {
    await input.evaluate((el, value) => {
        const textarea = el as HTMLTextAreaElement;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value'
        )!.set!;
        setter.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    await expect(input).toHaveValue(text);
}

/** Opens the floating chat panel and returns the message textarea once enabled. */
async function openChatAndWaitReady(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'AI 채팅 열기' }).click();

    // textarea에는 명시적 accessible name이 없으므로 ready placeholder로 정확히 집는다.
    // 준비 전에는 disabled placeholder를 갖다가, 준비되면 ready placeholder + enabled로 바뀐다.
    const ready = page.getByPlaceholder(READY_PLACEHOLDER);
    await expect(ready).toBeVisible({ timeout: ANALYSIS_READY_TIMEOUT_MS });
    await expect(ready).toBeEnabled({ timeout: ANALYSIS_READY_TIMEOUT_MS });
    return ready;
}

/** Sends the current message via the chat send button (CSS — role tree hides it on webkit). */
async function sendChat(page: Page): Promise<void> {
    await page.locator('button[aria-label="전송"]').click();
}

const answerBubble = (page: Page): Locator =>
    page.getByText(EXPECTED_ANSWER_FRAGMENT, { exact: false });

test.describe('@webkit symbol chat', () => {
    // Both tests reset and then consume the SAME shared per-IP chat token bucket
    // (localhost → `unknown` IP → one Redis key). Run them serially so a parallel
    // worker's reset/consume cannot race another's send and trip `token_exhausted`.
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async () => {
        await resetChatTokens();
    });

    test('@webkit open chat → ask → deterministic fake answer renders', async ({
        page,
    }) => {
        await page.goto(`/${SYMBOL}`);

        const messageInput = await openChatAndWaitReady(page);

        await typeIntoChat(messageInput, QUESTION);
        await sendChat(page);

        // 사용자 버블이 먼저 렌더된다 (onMutate가 즉시 append).
        await expect(page.getByText(QUESTION, { exact: true })).toBeVisible();

        // 어시스턴트 버블이 결정적 fake 응답을 렌더한다 — client → chatAction →
        // getLlmProvider() → fakeCallAiProvider 전체 왕복이 동작했음을 증명한다.
        await expect(answerBubble(page)).toBeVisible({
            timeout: CHAT_REPLY_TIMEOUT_MS,
        });
    });

    test('@webkit chat persists and announces context switch across a tab change', async ({
        page,
    }) => {
        await page.goto(`/${SYMBOL}`);

        const messageInput = await openChatAndWaitReady(page);

        // 차트 탭에서 먼저 한 번 질문/응답을 남긴다.
        await typeIntoChat(messageInput, QUESTION);
        await sendChat(page);
        await expect(answerBubble(page)).toBeVisible({
            timeout: CHAT_REPLY_TIMEOUT_MS,
        });

        // 패널을 연 채로 뉴스 탭으로 client-side 이동. FloatingChatButton은 레이아웃
        // 레벨에 마운트돼 탭 네비게이션을 가로질러 유지되므로 useChat이 언마운트되지
        // 않아 컨텍스트 전환을 감지할 수 있다. 차트 페이지의 vaul 드로어가 탭 nav를
        // aria-hidden 처리하므로 role 대신 CSS 로케이터로 링크를 집는다(양 프로젝트 공통).
        await page
            .locator('nav[aria-label="분석 종류"] a', { hasText: '뉴스' })
            .first()
            .click();
        await expect(page).toHaveURL(/\/AAPL\/news$/);

        // 1) 이전 어시스턴트 메시지가 패널에 그대로 남아 있다 (chat 지속성).
        await expect(answerBubble(page).first()).toBeVisible();

        // 2) 컨텍스트 전환 시스템 메시지가 삽입된다 (차트 분석 → 뉴스 분석).
        //    뉴스 페이지에는 vaul 드로어가 없어 패널이 aria-hidden이 아니므로 role 조회 가능.
        //    ContextSwitchSystemMessage: role="status" + "뉴스 분석 페이지로 전환되었습니다".
        await expect(
            page
                .getByRole('status')
                .filter({ hasText: '뉴스 분석 페이지로 전환되었습니다' })
        ).toBeVisible({ timeout: CHAT_REPLY_TIMEOUT_MS });
    });
});
