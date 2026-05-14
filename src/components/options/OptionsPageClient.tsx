// TODO(Phase 5): Replace stub with full UI implementation.
'use client';

import type { OptionsSnapshot, SlotMapping } from '@y0ngha/siglens-core';

interface OptionsPageClientProps {
    symbol: string;
    companyName: string;
    snapshot: OptionsSnapshot;
    slots: ReadonlyArray<SlotMapping | null>;
}

export function OptionsPageClient({ symbol }: OptionsPageClientProps) {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
            <p className="text-secondary-300">
                Options analysis for {symbol} — Phase 5 will render full UI here.
            </p>
        </main>
    );
}
