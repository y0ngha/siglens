/**
 * 첫 토큰을 기다리는 동안의 숨쉬는 점 세 개.
 */

/**
 * Three dots that breathe while the first token is still on its way. Not a
 * live region of its own — it only renders inside the streaming turn's
 * `aria-live` wrapper, and nested live regions announce unpredictably.
 */
export function Thinking({ label }: { readonly label: string }) {
    return (
        <span className="inline-flex h-7 items-center gap-1">
            <span className="sr-only">{label}</span>
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-secondary-400 motion-safe:animate-pulse"
                    style={{ animationDelay: `${i * 160}ms` }}
                />
            ))}
        </span>
    );
}
