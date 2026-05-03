/**
 * Route-level loading UI for the overall analysis page.
 * Next.js renders this automatically while `page.tsx` is streaming.
 */
export default function OverallLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            {[...Array(3)].map((_, i) => (
                <div
                    key={i}
                    className="bg-muted h-32 animate-pulse rounded-xl"
                    aria-hidden="true"
                />
            ))}
        </main>
    );
}
