import { buildVocNotification } from '../templates/operator-mail/buildVocNotification';

const base = {
    surface: 'siglens',
    rating: 4,
    comment: '좋아요',
    trigger: 'analysis' as const,
    pagePath: '/AAPL',
    locale: 'ko',
    isMember: false,
};

describe('buildVocNotification', () => {
    it('제목에 별점을, 본문에 별·표면·계기·회원 여부를 싣는다', () => {
        const mail = buildVocNotification(base);
        expect(mail.subject).toBe('[SIGLENS] 새 VOC 별점 4/5');
        expect(mail.text).toContain('별점: ★★★★☆ (4/5)');
        expect(mail.text).toContain('계기: 분석 직후');
        expect(mail.text).toContain('사용자: 비회원');
        expect(mail.text).toContain('의견: 좋아요');
    });

    it('시그렌즈 AI 표면과 회원을 한국어 라벨로 보인다', () => {
        const mail = buildVocNotification({
            ...base,
            surface: 'siglens_ai',
            trigger: 'agent_chat',
            isMember: true,
        });
        expect(mail.text).toContain('표면: 시그렌즈 AI');
        expect(mail.text).toContain('사용자: 회원');
    });

    it('의견이 없으면 "(없음)"이다', () => {
        expect(buildVocNotification({ ...base, comment: null }).text).toContain(
            '의견: (없음)'
        );
    });

    it('html 에서 의견을 이스케이프한다', () => {
        const mail = buildVocNotification({
            ...base,
            comment: '<script>x</script>',
        });
        expect(mail.html).not.toContain('<script>');
    });

    it('replyTo 를 싣지 않는다', () => {
        expect(buildVocNotification(base)).not.toHaveProperty('replyTo');
    });
});
