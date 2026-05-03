/**
 * Route-level loading UI for the news page.
 * Next.js renders this automatically while `page.tsx` is streaming.
 */
export default function NewsLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className="bg-secondary-700 h-32 animate-pulse rounded-xl"
                    aria-hidden="true"
                />
            ))}
        </main>
    );
}
