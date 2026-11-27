import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_CLIENT_PATHS } from '@/app/ai/[locale]/_lib/aiClientPaths';
import { CHAT_CHANGE_SIGNAL_TYPES } from '@/entities/chat-conversation/lib/chatChangeSignalTypes';
import ko from '../../../../../../messages/ko.json';

function walk(dir: string, exts: readonly string[] = ['.tsx']): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        if (e.isDirectory()) return walk(join(dir, e.name), exts);
        return exts.some(ext => e.name.endsWith(ext))
            ? [join(dir, e.name)]
            : [];
    });
}

describe('AI_CLIENT_PATHS', () => {
    it('includes every useTranslations/getTranslations namespace used by the SIGLENS AI widgets/features/pages', () => {
        const files = [
            ...walk(join(process.cwd(), 'src/widgets/agent-chat')),
            ...walk(join(process.cwd(), 'src/features/agent-chat')),
            // ai 레이아웃이 설치 배너(`PwaBanner`)를 렌더한다.
            ...walk(join(process.cwd(), 'src/features/pwa-install')),
            ...walk(join(process.cwd(), 'src/app/ai')),
            // 답변 안 차트(`ChatChartProvider` → `ChatChart` → `StockChart`). 훅(`.ts`)도 번역을 쓴다.
            ...walk(join(process.cwd(), 'src/widgets/chart'), ['.tsx', '.ts']),
            join(process.cwd(), 'src/shared/i18n/skillLabel.ts'),
        ].filter(f => !f.includes('__tests__'));
        const used = new Set<string>();
        for (const f of files) {
            const code = readFileSync(f, 'utf8');
            for (const m of code.matchAll(/useTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
            for (const m of code.matchAll(/getTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
        }
        // 정확히 같거나 조상 네임스페이스이거나, 그 네임스페이스 아래 **잎 키**만 싣는 항목(`shared.enumLabel.signalType.<type>`)이어도
        // 이 네임스페이스가 덮인 것으로 본다 — 아래 헤더 트리 검사와 같은 규칙이다.
        for (const ns of used)
            expect(
                AI_CLIENT_PATHS.some(
                    p =>
                        ns === p ||
                        ns.startsWith(`${p}.`) ||
                        p.startsWith(`${ns}.`)
                ),
                ns
            ).toBe(true);
    });

    /**
     * Task S3: the ai host also renders the shared `Header` widget tree
     * (`AuthSessionHeaderClient` → `Header`), so its namespaces must be
     * covered too. `AI_CLIENT_PATHS` covers this via `CHROME_CLIENT_PATHS`,
     * whose entries are a mix of whole namespaces (`widgets.layout`) and
     * individual leaf keys (`features.auth-logout.LogoutButton.xxxxxx`) —
     * a leaf key is a valid "namespace is covered" answer too, so the
     * predicate here also accepts an entry that is a *descendant* of the
     * used namespace, not only an ancestor/exact match.
     */
    it('includes every useTranslations namespace used by the shared header tree it now renders', () => {
        const files = [
            ...walk(join(process.cwd(), 'src/widgets/layout')),
            ...walk(join(process.cwd(), 'src/features/ticker-search')),
            ...walk(join(process.cwd(), 'src/features/auth-logout')),
            join(process.cwd(), 'src/shared/ui/ThemeRadioGroup.tsx'),
        ].filter(
            f =>
                !f.includes('__tests__') &&
                // `Footer`/`ContactDialog` are `widgets/layout` siblings of
                // `Header` but are not part of it and are not rendered on the
                // ai host (no `<Footer>` in `src/app/ai/[locale]/layout.tsx`).
                // They run server-side (`useTranslations('shared.seo')` is
                // explicitly excluded from every client payload — see
                // `clientKeyCoverage.test.ts`), so scanning them here would
                // demand a namespace the ai host must never actually ship.
                !f.endsWith('/Footer.tsx') &&
                !f.endsWith('/ContactDialog.tsx')
        );
        const used = new Set<string>();
        for (const f of files) {
            const code = readFileSync(f, 'utf8');
            for (const m of code.matchAll(/useTranslations\('([^']+)'\)/g))
                used.add(m[1]!);
        }
        expect(used.size).toBeGreaterThan(0);
        for (const ns of used)
            expect(
                AI_CLIENT_PATHS.some(
                    p =>
                        ns === p ||
                        ns.startsWith(`${p}.`) ||
                        p.startsWith(`${ns}.`)
                )
            ).toBe(true);
    });

    /**
     * 위 두 검사는 조상·후손 접두로 "덮였다"를 판정해, `shared.enumLabel.signalType` 아래 잎 키가 하나만 있어도
     * 통과한다. 카드가 푸는 신호마다 이름 키가 **정확히** 실리는지는 따로 본다 — 하나라도 빠지면 그 신호 줄은
     * ai 호스트에서 키 문자열로 보인다.
     */
    it('carries the name key of every signal the since-earlier card renders, leaf by leaf', () => {
        const labels = (
            ko as {
                shared: { enumLabel: { signalType: Record<string, string> } };
            }
        ).shared.enumLabel.signalType;
        expect(CHAT_CHANGE_SIGNAL_TYPES.length).toBeGreaterThan(0);
        for (const type of CHAT_CHANGE_SIGNAL_TYPES) {
            expect(AI_CLIENT_PATHS, type).toContain(
                `shared.enumLabel.signalType.${type}`
            );
            expect(labels[type], type).toEqual(expect.any(String));
        }
        // 이름 카탈로그는 통째가 아니라 쓰는 잎 키만 싣는다.
        expect(AI_CLIENT_PATHS).not.toContain('shared.enumLabel.signalType');
        expect(AI_CLIENT_PATHS).not.toContain('shared.enumLabel');
        expect(
            AI_CLIENT_PATHS.filter(p =>
                p.startsWith('shared.enumLabel.signalType.')
            ).toSorted()
        ).toEqual(
            CHAT_CHANGE_SIGNAL_TYPES.map(
                type => `shared.enumLabel.signalType.${type}`
            ).toSorted()
        );
    });
});
