import { test as base, expect } from '@playwright/test';
import { SESSION_STORAGE_NUDGE_SHOWN_KEY } from '@/shared/lib/storageKeys';

// ai.localhost:4300 is the SIGLENS AI subtree host (`ai` project, agent-chat.spec.ts) —
// same app/server, just routed by `src/proxy.ts` on Host, so it belongs in the allowlist
// alongside the main host.
const ALLOWED_HOSTS = new Set([
    'localhost:4300',
    '127.0.0.1:4300',
    'ai.localhost:4300',
]);
const ALLOWED_PROTOCOLS = new Set(['data:', 'blob:', 'chrome-extension:']);

/**
 * Wraps the page so any browser request to a non-app host fails the test.
 * Catches stubbing drift and prevents accidental real external API calls.
 * Server-side fetches (FMP/LLM/etc.) are not visible here — those are handled
 * by E2E_TEST fake-provider injection.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        // 넛지 모달(비회원 가입 넛지·회원 메일 리포트 넛지)을 모든 스펙에서 끈다. 비회원
        // 가입 넛지는 그날 첫 분석이 렌더되면 뜨는 화면 전체 오버레이라, 끄지 않으면 종목
        // 페이지를 연 뒤의 클릭이 전부 모달에 가로막힌다. 넛지들은 "이 탭 세션에 이미 띄움"
        // 플래그를 보면 뜨지 않으므로(`shared/lib/nudgeSession`) 그 플래그를 미리 심는다.
        // 넛지 동작 자체는 단위 테스트(`useAnonAnalysisNudge`·`useEmailReportNudge`)가 맡는다.
        await page.addInitScript(key => {
            try {
                sessionStorage.setItem(key, '1');
            } catch {
                // 저장소가 막힌 브라우저 — 넛지가 떠도 이 스펙만의 문제로 드러난다.
            }
        }, SESSION_STORAGE_NUDGE_SHOWN_KEY);
        const violations: string[] = [];
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            // Explicit protocol allowlist so external ws/wss (and any non-http
            // scheme) is also guarded — only app-host requests and a handful of
            // browser-internal schemes are let through.
            const isAllowed =
                ALLOWED_PROTOCOLS.has(url.protocol) ||
                ALLOWED_HOSTS.has(url.host);
            if (isAllowed) return route.continue();
            violations.push(url.href);
            return route.abort();
        });
        await use(page);
        expect(
            violations,
            `Unstubbed external requests: ${violations.join(', ')}`
        ).toEqual([]);
    },
});

export { expect };
