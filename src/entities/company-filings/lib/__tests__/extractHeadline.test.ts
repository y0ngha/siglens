import { describe, expect, it } from 'vitest';
import { extractHeadline } from '../extractHeadline';
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

    it('(b) IonQ 8-K: 제목 + 부제에서 멈추고 불릿은 싣지 않는다', () => {
        expect(extractHeadline(IONQ)).toBe(
            'IonQ Announces Record 3Q26 Revenues and Raises FY2026 Guidance to $505 - $515 Million as Backlog Grows to $1.2 Billion Revenue, GAAP EPS and Adjusted EPS All Exceed Consensus Estimates*'
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

    it('10자 미만이거나 표지뿐이면 null', () => {
        expect(extractHeadline('')).toBeNull();
        expect(
            extractHeadline('EX-99.1\n2\nx-ex99_1.htm\nExhibit 99.1')
        ).toBeNull();
        expect(extractHeadline('Short')).toBeNull();
    });
});
