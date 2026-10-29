import { SHARE_CLICK_ACTION } from '@/features/share/lib/shareClickAction';

describe('SHARE_CLICK_ACTION', () => {
    it('상태별 클릭 동작을 고정한다', () => {
        expect(SHARE_CLICK_ACTION).toEqual({
            unavailable: 'notice',
            success: 'share',
            pending: 'wait',
            idle: 'confirm',
            error: 'confirm',
        });
    });
});
