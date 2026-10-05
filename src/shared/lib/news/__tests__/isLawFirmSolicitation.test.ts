import { describe, expect, it } from 'vitest';
import { isLawFirmSolicitation } from '../isLawFirmSolicitation';

describe('isLawFirmSolicitation', () => {
    describe('원고 모집 홍보 문구는 걸러낸다', () => {
        it.each([
            'ROSEN, A LEADING INVESTOR RIGHTS FIRM, Encourages Apple Inc. Investors to Secure Counsel Before Important Deadline in Securities Class Action',
            'Rosen Law Firm Reminds Tesla, Inc. Shareholders of Class Action Lawsuit - TSLA',
            'ROSEN, GLOBAL INVESTOR COUNSEL, Urges Nike Inc. Investors to Secure Counsel Before Important Deadline',
            'SMPL DEADLINE: Pomerantz Law Firm Reminds Investors of Securities Class Action',
            'Pomerantz Law Firm Investigates Claims On Behalf of Investors of Intel Corporation - Class Action',
            'Levi & Korsinsky Notifies Shareholders of a Class Action Lawsuit Against Peloton',
            'LEVI & KORSINSKY, LLP Reminds Investors of Lead Plaintiff Deadline in Class Action',
            'Bragar Eagel & Squibb, P.C. Reminds Investors That a Class Action Lawsuit Has Been Filed',
            'The Gross Law Firm Notifies Shareholders of Securities Fraud Class Action',
            'Kessler Topaz Meltzer & Check, LLP Encourages Investors to Inquire About Securities Class Action Investigation',
            'Faruqi & Faruqi, LLP Alerts Investors: Securities Class Action Filed Against Zoom',
            'Frank R. Cruz Reminds Investors of Securities Fraud Class Action Against Lucid Group',
            'Howard G. Smith Announces Investigation On Behalf of Investors; Law Firm Seeks Lead Plaintiff',
            // 로펌 이름 없이 권유 동사 + 투자자 + 소송 용어
            'Law Firm Encourages Shareholders Who Lost Money in XYZ Corp. to Contact Counsel About Class Action',
            'Law Firm Invites Investors in ABC Inc. to Join Securities Litigation',
            // 대소문자 무관
            'rosen law firm reminds investors of class action deadline',
        ])('%s', title => {
            expect(isLawFirmSolicitation(title)).toBe(true);
        });
    });

    describe('정상 기사는 남긴다', () => {
        it.each([
            // 소송 용어만 있는 정상 사건 보도
            'Judge approves class action against Tesla over Autopilot claims',
            'Boeing settles shareholder class action for $237.5 million',
            'Reuters: Wells Fargo faces new securities litigation over sham interviews',
            // 로펌 이름과 비슷한 증권사 리서치
            'Rosenblatt upgrades Palantir to Buy on AI demand',
            'Bernstein raises Nvidia price target ahead of earnings',
            'Glancy Prongay adds partner in Los Angeles',
            // 광고 어조지만 소송 용어 없음
            'Fund urges shareholders to vote against merger',
            'CEO reminds investors of long-term strategy at annual meeting',
            // 권유 동사 + 일반 소송 용어 — 규제기관·언론 기사 (영업 문구 아님)
            'SEC alerts investors to new securities fraud scheme targeting retirees',
            'Regulator urges shareholders to join Boeing class action settlement',
            // 로펌 성(姓)과 같은 일반 인명 — 로펌 형태(`Portnoy Law`)가 아니면 걸지 않는다
            'Portnoy says Barstool will fight class action lawsuit over crypto promotion',
            'Schall wins appeal in securities fraud case, court rules',
            'Holzer testifies in class action over pension plan',
            // 일반 실적
            'Apple reports record fourth-quarter revenue as iPhone sales climb',
            'Fed holds rates steady, signals two cuts later this year',
            '',
        ])('%s', title => {
            expect(isLawFirmSolicitation(title)).toBe(false);
        });
    });

    it('한국어로 번역된 제목에는 적용되지 않는다 (원제목 전용)', () => {
        expect(
            isLawFirmSolicitation(
                '로젠 법률사무소, 애플 투자자에게 집단소송 마감 전 변호사 선임 권유'
            )
        ).toBe(false);
    });
});
