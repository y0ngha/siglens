import { MAIL_ALERT_MANAGE_PATH } from '@/entities/mail-alert/lib/mailAlertLinks';
import { MAIL_ALERTS_PATH } from '../mailAlertPaths';

describe('설정 페이지 경로', () => {
    it('메일 속 설정 링크가 가리키는 경로는 라우트의 경로와 같다', () => {
        expect(MAIL_ALERT_MANAGE_PATH).toBe(MAIL_ALERTS_PATH);
    });
});
