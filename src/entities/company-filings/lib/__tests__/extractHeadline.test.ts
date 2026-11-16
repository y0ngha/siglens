import { describe, expect, it } from 'vitest';
import { extractHeadline, extractLeadHeadline } from '../extractHeadline';
import { htmlToText } from '../htmlToText';

// 실제 EDGAR 문서를 htmlToText에 통과시킨 앞부분(2026-11-15 실측).
const SEALSQ = [
    'EX-99.1',
    '2',
    'ea030967501ex99-1.htm',
    'PRESS RELEASE OF SEALSQ CORP ISSUED ON OCTOBER 26, 2026',
    '',
    'Exhibit 99.1',
    '',
    'SEALSQ Announces Intent to Acquire Capacity',
    'and Operational Services Associated with 12',
    '',
    'WISeSat.Space Satellites for QSOC',
    '',
    'Binding Letter of',
    'Intent establishes the initial space and ground infrastructure for QSOC in a',
    '',
    'transaction estimated to be worth $15 million over the next',
    '18 months, building on recent',
    '',
    '$10 million PIPE made in WISeSat.Space',
    '',
    'Geneva, Switzerland /',
    'New York, United States — October 26, 2026 — SEALSQ Corp (NASDAQ: LAES) (“SEALSQ”), a developer of semiconductor,',
].join('\n');

const IONQ = [
    'EX-99.1',
    '3',
    'ionq-ex99_1.htm',
    'EX-99.1',
    '',
    'Exhibit 99.1',
    'IonQ Announces Record 3Q26 Revenues and Raises FY2026 Guidance to $505 - $515 Million as Backlog Grows to $1.2 Billion',
    'Revenue, GAAP EPS and Adjusted EPS All Exceed Consensus Estimates*',
    '●Reported GAAP Revenue of $173.8 Million, Up 336% Year-over-Year, Marking the Sixth Consecutive Record Quarter',
    '',
    '●Raises Full Year Revenue Guidance to $505 - $515 Million',
].join('\n');

const TESLA = [
    'EX-99.1',
    '2',
    'exhibit9914.htm',
    'EX-99.1',
    '',
    'Q3 2026 Update 1 Exhibit 99.1',
    '',
    'Highlights 03 Financial Summary 04 Operational Summary 05 Manufacturing & Hardware 06 Supporting Infrastructure 07 SI & Other Services 08 Outlook 09 Photos & Charts 10 Key Metrics 23 Financial Statements 26 Additional Information 32 2',
    '',
    'S U M M A R YH I G H L I G H T S (1) Refer to the definitions.',
].join('\n');

const HKEX_DISCLAIMER = [
    'Hong Kong Exchanges and Clearing',
    'Limited and The Stock Exchange of Hong Kong Limited (the “Hong Kong Stock Exchange”) take no responsibility for the',
    'contents of this announcement, make no representation as to its accuracy or completeness and expressly disclaim any liability whatsoever',
    'for any loss howsoever arising from or in reliance upon the whole or any part of the contents of this announcement.',
].join('\n');
const ONE_CLASS = [
    'We have one class of shares,',
    'and each holder of our shares is entitled to one vote per share. As the Alibaba Partnership’s director nomination rights are carried by the partnership and not by shares,',
    'the structure differs from a weighted voting rights structure and the exchange has accepted that it does not need to be described as one under the listing rules.',
].join('\n');
const ALIBABA_ANNOUNCEMENT = [
    'EX-99.1',
    '2',
    'tm2629456d1_ex99-1.htm',
    'EXHIBIT 99.1',
    '',
    'Exhibit 99.1',
    '',
    HKEX_DISCLAIMER,
    '',
    ONE_CLASS,
].join('\n');

const ALIBABA_RETURN = [
    'EX-99.1',
    '2',
    'tm2629111d1_ex99-1.htm',
    'EXHIBIT 99.1',
    '',
    'Exhibit 99.1',
    'FF301',
    'Page 1 of 10 v 1.2.1',
    'Monthly Return for Equity Issuer and Hong Kong Depositary Receipts listed under Chapter 19B of the Exchange Listing Rules on Movements in',
    'Securities',
    'For the month ended: 31 October 2026 Status: New Submission',
    'To : Hong Kong Exchanges and Clearing Limited',
].join('\n');

describe('extractHeadline: 실제 문서 앞부분', () => {
    it('(a) SEALSQ 6-K: 줄바꿈으로 쪼개진 제목을 이어 붙이고 빈 줄 뒤 부제까지 포함한다', () => {
        expect(extractHeadline(SEALSQ)).toBe(
            'SEALSQ Announces Intent to Acquire Capacity and Operational Services Associated with 12 WISeSat.Space Satellites for QSOC'
        );
    });

    it('(b) IonQ 8-K: 제목 + 부제에서 멈추고 불릿은 싣지 않는다(끝의 각주 표시 *는 지운다)', () => {
        expect(extractHeadline(IONQ)).toBe(
            'IonQ Announces Record 3Q26 Revenues and Raises FY2026 Guidance to $505 - $515 Million as Backlog Grows to $1.2 Billion Revenue, GAAP EPS and Adjusted EPS All Exceed Consensus Estimates'
        );
    });

    it('(c) Tesla 슬라이드: 줄 안의 Exhibit 토큰과 쪽 번호를 지우고 목차 앞에서 멈춘다', () => {
        expect(extractHeadline(TESLA)).toBe('Q3 2026 Update');
    });

    it('(d) Alibaba 공고: 긴 면책·본문 문단은 제목이 아니다', () => {
        expect(extractHeadline(ALIBABA_ANNOUNCEMENT)).toBeNull();
    });

    it('(d) 면책 문단 뒤에 짧은 문단이 오면 그것이 제목', () => {
        const withTitle = `${ALIBABA_ANNOUNCEMENT}\n\nAlibaba Group Announces Results for the Quarter\nNov. 13, 2026 — Hangzhou\n\nBody.`;
        expect(extractHeadline(withTitle)).toBe(
            'Alibaba Group Announces Results for the Quarter'
        );
    });

    it('(e) Alibaba 월간 보고: 양식 코드·쪽·버전 줄을 건너뛰고 날짜·양식 필드 앞에서 멈춘다', () => {
        expect(extractHeadline(ALIBABA_RETURN)).toBe(
            'Monthly Return for Equity Issuer and Hong Kong Depositary Receipts listed under Chapter 19B of the Exchange Listing Rules on Movements in Securities'
        );
    });
});

describe('extractHeadline: 규칙', () => {
    it('표지 토큰이 한 줄에 붙어 있어도 제목부터 취한다', () => {
        const text =
            'EX-99.1 3 ionq-ex99_1.htm EX-99.1 EX-99.1 Exhibit 99.1 IonQ Announces Executive Leadership Evolution';
        expect(extractHeadline(text)).toBe(
            'IonQ Announces Executive Leadership Evolution'
        );
    });

    it('표지 문구와 제목이 한 줄이어도 표지만 벗긴다', () => {
        const text =
            'PRESS RELEASE OF SEALSQ CORP ISSUED ON OCTOBER 27, 2026 Exhibit 99.1 SEALSQ QS7001 V1 Successfully Completes Evaluation';
        expect(extractHeadline(text)).toBe(
            'SEALSQ QS7001 V1 Successfully Completes Evaluation'
        );
    });

    it('제목 자체의 날짜(월 일 없는)는 멈추지 않는다, 시작 줄의 날짜도 허용', () => {
        expect(
            extractHeadline('Results for the Quarter Ended September 30, 2026')
        ).toBe('Results for the Quarter Ended September 30, 2026');
    });

    it('날짜줄(영문 월 표기 세 가지)에서 멈춘다', () => {
        for (const dateline of [
            'October 26, 2026 — Boston',
            'Nov. 13, 2026 /PRNewswire/',
            '26 October 2026, London',
        ])
            expect(
                extractHeadline(
                    `Acme Announces a Very Important Thing\n${dateline}\nrest`
                )
            ).toBe('Acme Announces a Very Important Thing');
    });

    it('120자 미만이면 빈 줄을 건너 이어 붙이고, 120자 이상이면 빈 줄에서 멈춘다', () => {
        expect(
            extractHeadline('Short title here\n\nSubtitle here\n\nBody')
        ).toBe('Short title here Subtitle here Body');
        const long = 'word '.repeat(25).trim();
        expect(extractHeadline(`${long}\n\nNext paragraph`)).toBe(long);
    });

    it('200자를 넘기 전에 멈추고 단어 경계에서 자른다', () => {
        const words = Array.from({ length: 35 }, (_, i) => `word${i}`).join(
            ' '
        );
        const headline = extractHeadline(words) ?? '';
        expect(headline.length).toBeLessThanOrEqual(200);
        expect(words.startsWith(headline)).toBe(true);
        expect(words[headline.length]).toBe(' ');
    });

    it('FOR IMMEDIATE RELEASE 같은 상투 줄과 불릿 시작은 건너뛴다', () => {
        const text = htmlToText(
            '<p>EX-99.1</p><p>FOR IMMEDIATE RELEASE</p><p>●a bullet that is long enough</p><p>IonQ Reports Third Quarter 2026 Financial Results</p>'
        );
        expect(extractHeadline(text)).toBe(
            'IonQ Reports Third Quarter 2026 Financial Results'
        );
    });

    it('건너뛸 줄이 1만 개여도 스택이 넘치지 않는다(불릿·빈 줄·양식 코드)', () => {
        const bullets = Array.from(
            { length: 10_000 },
            () => '● skipped bullet line'
        ).join('\n');
        expect(extractHeadline(bullets)).toBeNull();
        expect(extractHeadline(`${'\n'.repeat(10_000)}`)).toBeNull();
        expect(
            extractHeadline(
                Array.from({ length: 10_000 }, () => 'FF301').join('\n')
            )
        ).toBeNull();
        expect(
            extractHeadline(
                `${bullets}\n\nIonQ Reports Third Quarter 2026 Financial Results`
            )
        ).toBe('IonQ Reports Third Quarter 2026 Financial Results');
    });

    it('긴 본문 문단이 1만 개 이어져도 끝난다', () => {
        const para = `${'Long body sentence that is clearly not a title. '.repeat(8)}`;
        const text = Array.from({ length: 10_000 }, () => para).join('\n\n');
        expect(extractHeadline(text)).toBeNull();
    });

    // 아래 원문은 2026-11-16 EDGAR 실측 문서를 htmlToText에 통과시킨 앞부분이다(필요한 문단만 남겼다).
    it('홍콩 상장사 공고: 면책·의결권 고지와 한자 병기 회사명을 건너뛰고 (Stock Code) 뒤의 공고 제목을 쓴다', () => {
        const text = [
            'Exhibit 99.1',
            '',
            'Hong',
            'Kong Exchanges and Clearing Limited and The Stock Exchange of Hong Kong Limited (the “Hong Kong Stock Exchange”)',
            'take no responsibility for the contents of this announcement, make no representation as to its accuracy or completeness and expressly',
            'disclaim any liability whatsoever for any loss howsoever arising from or in reliance upon the whole or any part of the contents of',
            'this announcement.',
            '',
            'Alibaba',
            'Group Holding Limited',
            '',
            '阿里巴巴集團控股有限公司',
            '',
            '(Incorporated',
            'in the Cayman Islands with limited liability)',
            '',
            '(Stock',
            'Code: 9988 (HKD Counter) and 89988 (RMB Counter))',
            '',
            'DATE',
            'OF BOARD MEETING',
            '',
            'Our',
            'board of directors will hold a board meeting for the purposes of, among other matters, discussing our unaudited results for the three',
            'months and six months ended September 30, 2026 (“Results”) and the publication of the Results announcement.',
        ].join('\n');
        expect(extractHeadline(text)).toBe('DATE OF BOARD MEETING');
    });

    it('전각 괄호 (Stock Code)와 빈 줄 없이 붙은 제목, 표지 각주(For identification purposes only)를 처리한다', () => {
        const notice = [
            'XPeng Inc.',
            '',
            '小鵬集團*',
            '',
            '(A company controlled through weighted voting rights and incorporated in the Cayman Islands with limited liability)',
            '',
            '（Stock Code:',
            '9868）',
            'NOTICE OF BOARD MEETING',
            '',
            'The board of directors of the Company announces that a meeting of the Board will be held on Tuesday for the purpose of approving results.',
        ].join('\n');
        expect(extractHeadline(notice)).toBe('NOTICE OF BOARD MEETING');
        expect(
            extractHeadline(
                '2026 中期報告 INTERIM REPORT * 僅供識別 For identification purposes only XPeng Inc.'
            )
        ).toBe('2026 INTERIM REPORT');
    });

    it('줄로 쪼개진 표지(Exhibit ⏎ 99.1) 뒤의 긴 제목 문단을 쓴다', () => {
        const text = [
            'PRESS RELEASE OF SEALSQ CORP ISSUED ON OCTOBER 27, 2026',
            '',
            'Exhibit',
            '99.1',
            '',
            'SEALSQ QS7001 V1 Successfully Completes Common',
            'Criteria EAL5+ Technical Security Evaluation at SERMA, as Announced at the “Uncovering the Coming Wave of Quantum + AI” Event',
            'in NYC',
            '',
            'All physical and functional security tests passed.',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'SEALSQ QS7001 V1 Successfully Completes Common Criteria EAL5+ Technical Security Evaluation at SERMA, as Announced at the “Uncovering the Coming Wave of Quantum + AI” Event in NYC'
        );
    });

    it('MEDIA RELEASE·연락처 블록을 건너뛰고, 마침표로 끝나는 장소 표기 뒤 날짜줄에서 멈춘다', () => {
        const rocketLab = [
            'MEDIA RELEASE',
            '',
            'Exhibit 99.1',
            'Rocket Lab Announces Third Quarter 2026 Financial Results: Posts Record Revenue and Guides to Record Revenue in Q4 2026',
            'Long Beach, California. November 9, 2026 – Rocket Lab Corporation (Nasdaq: RKLB), a global leader in launch services, today shared results.',
        ].join('\n');
        expect(extractHeadline(rocketLab)).toBe(
            'Rocket Lab Announces Third Quarter 2026 Financial Results: Posts Record Revenue and Guides to Record Revenue in Q4 2026'
        );
        const amd = [
            'NEWS RELEASE',
            'Contact:',
            'Brandi Martina',
            'AMD Communications',
            '(512) 705-1720',
            'brandi.martina@amd.com',
            '',
            'Liz Stine',
            'AMD Investor Relations',
            'liz.stine@amd.com',
            '',
            'AMD Appoints Tim Ryan to Board of Directors',
            '',
            'News Highlights:',
            '•Appointment strengthens AMD board with deep expertise',
        ].join('\n');
        expect(extractHeadline(amd)).toBe(
            'AMD Appoints Tim Ryan to Board of Directors'
        );
    });

    it('문서 전체가 한 문단이어도 연락처는 제목 후보에서만 거른다(제목 줄은 남는다)', () => {
        const text = [
            'Exhibit 99.1',
            'Rocket Lab Provides Update on Neutron Development and Adjusts Target Launch Timing',
            'LONG BEACH, Calif., Oct. 14, 2026 – Rocket Lab Corporation (Nasdaq: RKLB) today shared an update.',
            'Rocket Lab Media',
            'media@rocketlabusa.com',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'Rocket Lab Provides Update on Neutron Development and Adjusts Target Launch Timing'
        );
    });

    it('제목 바로 뒤 줄에 전화번호가 붙어도 제목은 남는다', () => {
        expect(
            extractHeadline(
                'Acme Announces Strong Results\nCall (212) 555-1234 for details\n\nBOSTON'
            )
        ).toBe('Acme Announces Strong Results');
    });

    it('MEDIA/NEWS RELEASE는 줄 전체가 라벨일 때만 건너뛴다', () => {
        expect(
            extractHeadline(
                'News Release Archive Shows Record Quarter for Acme'
            )
        ).toBe('News Release Archive Shows Record Quarter for Acme');
    });

    // 건너뛸 문단·줄이 많은 256KB 적대적 입력: 문단마다 처음부터 다시 훑으면 초 단위가 된다(SERVER.md#SA-23).
    it.each([
        ['한두 글자 문단', 'o\n\n'],
        ['한자뿐인 문단', '集團\n\n'],
        ['연락처뿐인 문단', 'a@bb.cc\n\n'],
        ['짧은 조각 문단', 'Xy\n\n'],
    ])('%s가 256KB 이어져도 선형 시간이다', (_, unit) => {
        const text = unit.repeat(Math.floor((256 * 1024) / unit.length));
        const started = performance.now();
        extractHeadline(text);
        extractLeadHeadline(text);
        expect(performance.now() - started).toBeLessThan(1_500);
    });

    it('연락처 판정은 256KB 단어 덩어리에서도 선형 시간이다', () => {
        const blob = 'a'.repeat(256 * 1024);
        const started = performance.now();
        extractHeadline(`${blob}\n\nShort Title Of The Release Here`);
        expect(performance.now() - started).toBeLessThan(1_500);
    });

    it('빈 줄 없이 요점 줄이 이어져도 첫 줄이 Title Case 제목이면 그 줄을 쓴다', () => {
        const text = [
            'SoFi Reports Third Quarter 2026 with Record Net Revenue of $1.4 Billion, Net Income of $241 Million and Raises Full-Year Guidance',
            'Adjusted Net Revenue up 44% to a record $1.4 billion',
            'Adjusted EBITDA up 70% to a record $470 million',
            'Adjusted Net income of $243 million, with $0.18 EPS',
            'Member growth up 35% to a record 17.1 million members',
            'SAN FRANCISCO, Calif. – (BUSINESS WIRE) – October 27, 2026 – SoFi Technologies, Inc. reported financial results today.',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'SoFi Reports Third Quarter 2026 with Record Net Revenue of $1.4 Billion, Net Income of $241 Million and Raises Full-Year Guidance'
        );
    });

    it('"This announcement is not for release…" 같은 공고 상투 문장은 제목이 아니다', () => {
        const text = [
            'This announcement is not for release, publication or distribution, in whole or in part, in, into or from any jurisdiction.',
            '',
            'Nebius secures $3.5 billion financing facility with Citi',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'Nebius secures $3.5 billion financing facility with Citi'
        );
    });

    it('짧은 제목 문단이 본문과 이어 붙어 길어지면 그 문단 하나가 제목이고, 본문 속 날짜에서는 멈추지 않는다', () => {
        const text = [
            'Exhibit 99.1',
            '',
            'Reconciliation between U.S. GAAP and IFRS Accounting',
            'Standards',
            '',
            'The Company’s consolidated financial statements',
            'for its primary listing in the United States are prepared in accordance with the accounting principles generally accepted in the United',
            'States of America (the “U.S. GAAP”). As a secondary listed issuer of the Hong Kong Stock Exchange, the Company is required',
            'to include a reconciliation statement in our annual financial statements starting from the first full financial year commencing on or',
            'after January 1, 2022, and in all subsequent financial statements (including interim financial statements).',
            '',
            'For our interim reporting with the Hong Kong Stock',
            'Exchange for the six month period ended June 30, 2026, we have prepared and included as Appendix, the reconciliation statement of the',
            'unaudited condensed consolidated statement of comprehensive loss for the six months ended June 30, 2026 and the unaudited condensed consolidated',
            'balance sheets as of June 30, 2026 of the Company, its subsidiaries and consolidated VIEs (collectively referred to as “the Group”).',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'Reconciliation between U.S. GAAP and IFRS Accounting Standards'
        );
        // 본문 문장 속 날짜(`period ended June 30, 2026`)에서 끊긴 조각은 제목이 아니다.
        expect(
            extractHeadline(text.split('\n').slice(11).join('\n'))
        ).toBeNull();
    });

    it('장소 표기 뒤의 날짜줄(SHANGHAI, China, …)에서는 멈춘다', () => {
        const text = [
            'NIO Inc. Provides August 2026 Delivery',
            'Update',
            'SHANGHAI, China, September 01, 2026 (GLOBE',
            'NEWSWIRE) -- NIO Inc. (NYSE: NIO; HKEX: 9866; SGX: NIO) (“NIO” or the “Company”), a pioneer',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'NIO Inc. Provides August 2026 Delivery Update'
        );
    });

    it('주주 서한: 레터헤드(주소·날짜) 대신 인사말 다음 문단의 첫 문장을 쓴다', () => {
        const text = [
            'Exhibit 99.1',
            '',
            'Arqit Quantum Inc.',
            '',
            '3 Orchard Place',
            '',
            'London SW1H 0BF',
            '',
            'United Kingdom',
            '',
            'August 19, 2026',
            '',
            'Dear Shareholder:',
            '',
            'You are invited to attend',
            'the Annual General Meeting of Arqit Quantum Inc. (“Arqit”), which will be held on September 8, 2026. Details follow below.',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'You are invited to attend the Annual General Meeting of Arqit Quantum Inc. (“Arqit”), which will be held on September 8, 2026.'
        );
    });

    it('날짜줄이 없는 제목 붙은 서한은 제목을 그대로 쓴다', () => {
        const text = [
            'Letter to Shareholders from the Chief Executive',
            '',
            'Dear Shareholders,',
            '',
            'This year we doubled revenue.',
        ].join('\n');
        expect(extractHeadline(text)).toBe(
            'Letter to Shareholders from the Chief Executive'
        );
    });

    it('줄 안의 한자 병기를 지우고 한자뿐인 줄은 건너뛴다', () => {
        expect(
            extractHeadline(
                [
                    '小鵬集團',
                    '',
                    'XPENG 小鵬 Announces Vehicle Delivery Results for October 2026',
                ].join('\n')
            )
        ).toBe('XPENG Announces Vehicle Delivery Results for October 2026');
    });

    it('10자 미만이거나 표지뿐이면 null', () => {
        expect(extractHeadline('')).toBeNull();
        expect(
            extractHeadline('EX-99.1\n2\nx-ex99_1.htm\nExhibit 99.1')
        ).toBeNull();
        expect(extractHeadline('Short')).toBeNull();
    });
});
