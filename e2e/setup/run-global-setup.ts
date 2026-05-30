/**
 * Standalone runner for the Playwright global setup (DB migrate + seed).
 *
 * Lets `yarn e2e:db` prepare the local e2e Postgres WITHOUT launching Playwright
 * or the Next webServer. It is intentionally a thin wrapper: it imports the same
 * `globalSetup` default that Playwright runs (single source of truth — see
 * `global-setup.ts`), so there is no duplicated migrate/seed logic and no risk of
 * the convenience script drifting from the real setup.
 *
 * We use a static ESM import (not `tsx -e` + dynamic import): under `tsx -e` the
 * eval context transpiles to CJS and the dynamic-import namespace nests the real
 * default at `m.default.default`, and an unhandled rejection there exits 0 —
 * masking failures. A proper module with explicit error handling guarantees a
 * non-zero exit when migrate/seed fails, which CI relies on.
 */
import globalSetup from './global-setup';

globalSetup()
    .then(() => {
        console.log('e2e:db: global-setup complete');
        process.exit(0);
    })
    .catch((err: unknown) => {
        console.error('e2e:db: global-setup failed');
        console.error(err);
        process.exit(1);
    });
