import { agentLimit } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { GUEST_TURNS_PER_DAY, MEMBER_TURNS_PER_DAY } from '../guestTurnLimit';

describe('GUEST_TURNS_PER_DAY', () => {
    it('core AGENT_LIMITS.turnsPerDay.free 값과 일치한다 — 어긋나면 배너가 틀린 숫자를 보여준다', () => {
        expect(GUEST_TURNS_PER_DAY).toBe(agentLimit('free', 'turnsPerDay'));
        expect(MEMBER_TURNS_PER_DAY).toBe(agentLimit('member', 'turnsPerDay'));
    });
});
