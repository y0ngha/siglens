import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetActiveNoticesMemoForTests,
    getActiveNoticesMemoized,
} from '../lib/activeNoticesMemo';
import type { NoticeWireRecord } from '../model/types';

const NOTICES: NoticeWireRecord[] = [];

describe('getActiveNoticesMemoized', () => {
    beforeEach(() => {
        __resetActiveNoticesMemoForTests();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('같은 로케일의 두 번째 호출은 메모에서 낸다', async () => {
        vi.stubEnv('E2E_TEST', '');
        const load = vi.fn(async () => NOTICES);

        await getActiveNoticesMemoized('ko', load);
        const second = await getActiveNoticesMemoized('ko', load);

        expect(load).toHaveBeenCalledTimes(1);
        expect(second).toBe(NOTICES);
    });

    it('E2E에서는 메모를 건너뛰고 매번 load한다 — 시드한 공지가 곧바로 보이도록', async () => {
        vi.stubEnv('E2E_TEST', '1');
        const load = vi.fn(async () => NOTICES);

        await getActiveNoticesMemoized('ko', load);
        await getActiveNoticesMemoized('ko', load);

        expect(load).toHaveBeenCalledTimes(2);
    });
});
