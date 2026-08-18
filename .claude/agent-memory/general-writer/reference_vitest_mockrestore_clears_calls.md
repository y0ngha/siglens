---
name: reference-vitest-mockrestore-clears-calls
description: vi.spyOn(...).mockRestore() wipes .mock.calls too — assert on a spy's call history before calling mockRestore(), not after
metadata:
  type: reference
---

`mockRestore()` does everything `mockReset()` does (including clearing
`.mock.calls`) *and* restores the original implementation. If a test spies on
something in a `try { ... } finally { spy.mockRestore(); }` block and then
asserts `expect(spy).toHaveBeenCalledWith(...)` after the `finally`, the
assertion always sees zero calls — not because the code under test didn't
call it, but because the harness erased the record.

**Symptom:** an assertion like `expect(timeoutSpy).toHaveBeenCalledTimes(2)`
fails with "0 times" even though manual instrumentation (writing call count to
a file mid-test) proves the spy recorded the calls correctly at the time they
happened.

**Fix:** capture `spy.mock.calls` (or the specific args you need) into a local
variable *before* the `finally` block runs `mockRestore()`, then assert on the
captured snapshot afterward. `mockClear()` (not `mockReset`/`mockRestore`)
only clears calls without touching the implementation, if you need to keep
the spy live.

**How to apply:** whenever writing a Vitest test that spies on a global/static
method (e.g. `vi.spyOn(AbortSignal, 'timeout')`, `vi.spyOn(Date, 'now')`) and
restores it in a `finally` for cleanup, snapshot the call data first. This
cost ~30 min of debugging (writing throwaway repro files, comparing "single
call vs two calls" behavior) before the root cause was found — the spy itself
was working fine the whole time.
