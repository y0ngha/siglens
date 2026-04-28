import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { PolicySection, type TocItem } from '@/components/legal/PolicySection';
import { CONTACT_EMAIL } from '@/lib/contact';
import {
    INVESTMENT_DISCLAIMER,
    LEGAL_EFFECTIVE_DATE,
    PRIVACY_DESCRIPTION,
    PRIVACY_FULL_TITLE,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/legal';
import {
    buildBreadcrumbJsonLd,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { JsonLd } from '@/components/ui/JsonLd';

const PAGE_URL = `${SITE_URL}${PRIVACY_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${PRIVACY_TITLE} | ${SITE_NAME}`,
    description: PRIVACY_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
    },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: PRIVACY_TITLE, url: PAGE_URL },
]);

const TOC: readonly TocItem[] = [
    { id: 'intro', label: '1. 총칙' },
    { id: 'collect', label: '2. 수집하는 개인정보 항목 및 수집 방법' },
    { id: 'purpose', label: '3. 개인정보의 수집 및 이용 목적' },
    { id: 'retention', label: '4. 개인정보의 보유 및 이용 기간' },
    { id: 'third-party', label: '5. 개인정보의 제3자 제공' },
    { id: 'transfer', label: '6. 개인정보 처리의 위탁 및 국외 이전' },
    { id: 'cookies', label: '7. 쿠키 및 로컬 스토리지' },
    { id: 'rights', label: '8. 이용자의 권리와 행사 방법' },
    { id: 'security', label: '9. 개인정보의 안전성 확보 조치' },
    { id: 'contact', label: '10. 개인정보 보호책임자 및 문의' },
    { id: 'changes', label: '11. 개인정보처리방침의 변경' },
];

export const metadata: Metadata = {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    robots: {
        index: false,
        follow: true,
    },
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        url: PAGE_URL,
        locale: 'ko_KR',
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: PRIVACY_FULL_TITLE,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const bottomNotice = (
    <div
        role="note"
        aria-label="투자 면책 고지"
        className="border-secondary-800 bg-secondary-900/40 mt-12 rounded-lg border p-5"
    >
        <p className="text-secondary-400 text-xs leading-relaxed sm:text-sm">
            {INVESTMENT_DISCLAIMER} 서비스 이용과 관련한 자세한 조건은&nbsp;
            <Link
                href={TERMS_PATH}
                className="text-primary-400 hover:text-primary-300 transition-colors"
            >
                {TERMS_TITLE}
            </Link>
            을(를) 참고해 주세요.
        </p>
    </div>
);

export default function PrivacyPage() {
    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <LegalPageShell
                breadcrumbTitle={PRIVACY_TITLE}
                eyebrow="PRIVACY POLICY"
                title={PRIVACY_TITLE}
                intro={`${SITE_NAME}(이하 "운영자")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하기 위하여 노력하고 있습니다. 운영자는 개인정보처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.`}
                effectiveDate={LEGAL_EFFECTIVE_DATE}
                toc={TOC}
                bottomNotice={bottomNotice}
            >
                <PolicySection id="intro" title="1. 총칙">
                    <p>
                        {SITE_NAME}은(는) 미국 주식 시장의 기술적 분석을
                        제공하는 무료 웹 서비스입니다. 운영자는 비회원도 모든
                        기본 기능을 그대로 이용할 수 있도록 설계하였으며, 회원
                        가입은 옵션입니다. 회원에 한해 등급(tier) 기반의 추가
                        혜택이 제공되며, 그 과정에서 식별 가능한 최소한의 정보가
                        수집됩니다.
                    </p>
                    <p>
                        본 개인정보처리방침은 운영자가 제공하는 웹 서비스(이하
                        &quot;서비스&quot;)에 적용되며, 비회원·회원 각각에게
                        수집되는 정보와 그 처리에 관한 사항을 설명합니다.
                    </p>
                </PolicySection>

                <PolicySection
                    id="collect"
                    title="2. 수집하는 개인정보 항목 및 수집 방법"
                >
                    <p>
                        <strong className="text-secondary-200">비회원</strong>의
                        경우, 이용자 식별을 위한 이름·이메일·전화번호 등
                        개인정보를 직접 수집하지 않습니다. 다만, 서비스 운영 및
                        보안을 위해 아래와 같은 정보가 자동으로 생성·수집됩니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            접속 로그: IP 주소, 요청 URL, HTTP 상태 코드,
                            User-Agent, 접속 일시
                        </li>
                        <li>
                            쿠키 및 로컬 스토리지에 저장되는 사용자 환경
                            설정(차트 설정, 선택한 보조지표 등)
                        </li>
                        <li>
                            오류 제보 기능을 이용자가 직접 사용할 경우, 이용자가
                            자발적으로 제공하는 이메일 주소 및 문의 내용
                        </li>
                        <li>
                            AI 질문 횟수 제한(Rate Limiting): IP 주소를 SHA-256
                            해시로 변환하여 원본 IP를 복원할 수 없는 형태로
                            저장. 24시간 후 자동 삭제되며, 다른 개인정보와
                            결합하지 않습니다.
                        </li>
                    </ul>
                    <p className="mt-4">
                        <strong className="text-secondary-200">회원</strong>
                        가입을 선택한 경우, 회원 식별·인증을 위해 아래 정보가
                        추가로 수집됩니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>이메일 주소(필수)</li>
                        <li>
                            비밀번호: 평문은 저장되지 않으며, bcrypt 해시
                            형태로만 보관됩니다.
                        </li>
                        <li>표시 이름(선택)</li>
                        <li>
                            소셜 로그인을 이용한 경우, 해당 OAuth 제공자의 계정
                            식별자(provider account id)와 프로필 이미지
                            URL(선택)
                        </li>
                        <li>
                            인증 세션 토큰: HttpOnly 쿠키에 저장되며, 서버에서
                            세션 만료 검증에 사용됩니다.
                        </li>
                        <li>
                            회원 등급(tier): 무료(free) / 멤버(member) /
                            프로(pro) 중 하나
                        </li>
                    </ul>
                    <p>
                        수집 방법: 비회원 정보는 서비스에 접속·이용할 때
                        자동으로 수집되며, 회원 정보는 회원이
                        회원가입·로그인·소셜 로그인 절차에서 직접 입력하거나
                        OAuth 제공자로부터 본인 동의에 근거해 전달받은
                        항목입니다.
                    </p>
                </PolicySection>

                <PolicySection
                    id="purpose"
                    title="3. 개인정보의 수집 및 이용 목적"
                >
                    <p>
                        운영자는 수집한 정보를 다음의 목적으로만 이용하며, 다른
                        목적으로 이용하지 않습니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            서비스 제공 및 운영: 차트 데이터 조회, AI 기술적
                            분석 결과 제공
                        </li>
                        <li>
                            회원 식별 및 인증, 회원 등급(tier)에 따른 기능 제공
                        </li>
                        <li>
                            서비스 품질 개선: 접속 통계 분석, 오류 추적 및 재현
                        </li>
                        <li>
                            보안 및 부정 이용 방지: 비정상적 접근의 탐지 및
                            차단, 계정 도용 방지
                        </li>
                        <li>이용자 문의에 대한 응답 및 오류 제보 처리</li>
                    </ul>
                </PolicySection>

                <PolicySection
                    id="retention"
                    title="4. 개인정보의 보유 및 이용 기간"
                >
                    <p>
                        운영자는 수집한 정보를 다음 기간 동안 보관한 후 지체
                        없이 파기합니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            접속 로그: 수집일로부터 최대 3개월 (서비스 안정성 및
                            장애 대응 목적)
                        </li>
                        <li>
                            오류 제보 관련 이메일 및 문의 내용: 처리 완료 후 1년
                        </li>
                        <li>
                            쿠키 및 로컬 스토리지: 이용자가 직접 브라우저 설정을
                            통해 삭제할 때까지
                        </li>
                        <li>
                            회원 정보(이메일·비밀번호 해시·표시 이름·OAuth 연결
                            정보·등급): 회원 탈퇴 시 지체 없이 파기. 단 관련
                            법령에 보존 의무가 있는 경우 해당 기간까지 보관
                        </li>
                        <li>
                            인증 세션: 발급일로부터 최대 30일, 또는
                            로그아웃·세션 만료 시 즉시 폐기
                        </li>
                    </ul>
                    <p>
                        관련 법령에 따라 보존할 필요가 있는 경우, 해당 법령이
                        정한 기간 동안 보관합니다.
                    </p>
                </PolicySection>

                <PolicySection
                    id="third-party"
                    title="5. 개인정보의 제3자 제공"
                >
                    <p>
                        운영자는 이용자의 개인정보를 원칙적으로 외부에 제공하지
                        않습니다. 다만, 다음의 경우에는 예외적으로 제공될 수
                        있습니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>이용자가 사전에 동의한 경우</li>
                        <li>
                            법령의 규정에 따르거나, 수사 목적으로 법령에 정해진
                            절차와 방법에 따라 수사기관의 요구가 있는 경우
                        </li>
                    </ul>
                </PolicySection>

                <PolicySection
                    id="transfer"
                    title="6. 개인정보 처리의 위탁 및 국외 이전"
                >
                    <p>
                        운영자는 서비스 운영을 위해 다음과 같은 글로벌 인프라
                        제공 업체의 서비스를 이용하고 있으며, 이에 따라 이용자의
                        접속 정보 등 일부 정보가 국외로 이전될 수 있습니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            <strong className="text-secondary-200">
                                Vercel Inc.
                            </strong>
                            &nbsp;(미국): 웹 서비스 호스팅 및 서버리스 컴퓨팅
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Alpaca Securities LLC
                            </strong>
                            &nbsp;(미국): 미국 주식 시세 및 차트 데이터 조회
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Anthropic, PBC
                            </strong>
                            &nbsp;(미국): AI 기반 기술적 분석 생성 (Claude API)
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Google LLC
                            </strong>
                            &nbsp;(미국): AI 채팅 응답 생성 (Gemini API)
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Upstash, Inc.
                            </strong>
                            &nbsp;(미국): 분석 결과 캐시 및 AI 질문 횟수 제한
                            (Redis)
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Neon, Inc.
                            </strong>
                            &nbsp;(미국): 회원 계정·세션·등급 정보의 PostgreSQL
                            데이터베이스 저장
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Google LLC
                            </strong>
                            &nbsp;(미국): Google 계정으로 소셜 로그인을 선택한
                            경우의 OAuth 인증 위탁
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Kakao Corp.
                            </strong>
                            &nbsp;(대한민국): 카카오 계정으로 소셜 로그인을
                            선택한 경우의 OAuth 인증 위탁
                        </li>
                        <li>
                            <strong className="text-secondary-200">
                                Apple Inc.
                            </strong>
                            &nbsp;(미국): Apple 계정으로 소셜 로그인을 선택한
                            경우의 OAuth 인증 위탁
                        </li>
                    </ul>
                    <p>
                        상기 업체로 이전되는 정보에는 이용자가 입력한 종목 티커,
                        요청 일시, 서비스 접속에 따른 IP 주소 등이 포함될 수
                        있으며, 운영자는 해당 정보가 서비스 제공 목적 외로
                        사용되지 않도록 각 업체의 개인정보 보호 정책을 확인하고
                        계약상 의무를 부과하고 있습니다.
                    </p>
                </PolicySection>

                <PolicySection id="cookies" title="7. 쿠키 및 로컬 스토리지">
                    <p>
                        운영자는 이용자의 편의를 위해 브라우저의 쿠키와 로컬
                        스토리지를 사용합니다. 쿠키와 로컬 스토리지에는 차트
                        설정, 선택한 보조지표, 분석 패널 상태 등 서비스 환경
                        설정 정보가 저장됩니다.
                    </p>
                    <p>
                        회원이 로그인한 경우, 운영자는 인증 세션 식별을 위해
                        다음과 같은 보안 쿠키를 추가로 사용합니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            <strong className="text-secondary-200">
                                siglens_session
                            </strong>
                            : 인증 세션 토큰. HttpOnly · SameSite=Lax · 운영
                            환경에서는 Secure 플래그가 적용되며, 만료 기간은
                            최대 30일입니다. 자바스크립트로 접근할 수 없습니다.
                        </li>
                    </ul>
                    <p>
                        이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나
                        저장된 데이터를 언제든지 삭제할 수 있습니다. 인증 쿠키를
                        삭제하면 자동으로 로그아웃되며, 그 외 쿠키 저장을 거부할
                        경우 일부 서비스 기능 이용에 제약이 발생할 수 있습니다.
                    </p>
                </PolicySection>

                <PolicySection id="rights" title="8. 이용자의 권리와 행사 방법">
                    <p>
                        이용자는 개인정보 보호법에 따라 운영자가 처리하는 본인의
                        개인정보에 대하여 열람, 정정·삭제, 처리정지를 요구할
                        권리가 있습니다.
                    </p>
                    <p>
                        비회원의 경우 개인 식별 정보의 수집 자체를 최소화하고
                        있으므로 별도로 저장된 개인정보가 없는 경우 본 권리의
                        행사 대상이 되는 정보가 존재하지 않을 수 있습니다.
                        회원의 경우 회원 탈퇴를 통해 저장된 회원 정보 일체의
                        삭제를 요청할 수 있으며, 회원 탈퇴 절차는 별도 화면을
                        통해 제공될 예정입니다. 그 시점까지는 아래 &quot;10.
                        개인정보 보호책임자 및 문의&quot;의 연락처로 탈퇴를
                        요청해주시면 지체 없이 처리합니다.
                    </p>
                    <p>
                        이용자가 오류 제보를 통해 제공한 문의 내용에 대하여 열람
                        또는 삭제를 원하시는 경우에도 동일한 연락처로 요청하실
                        수 있습니다.
                    </p>
                </PolicySection>

                <PolicySection
                    id="security"
                    title="9. 개인정보의 안전성 확보 조치"
                >
                    <p>
                        운영자는 이용자의 정보를 안전하게 처리하기 위해 다음과
                        같은 조치를 취하고 있습니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>모든 통신 구간에 HTTPS(TLS) 암호화 적용</li>
                        <li>
                            외부 API 키 및 비밀 정보를 환경 변수로 분리하여 관리
                        </li>
                        <li>접속 기록의 정기적 검토 및 비정상 접근 차단</li>
                        <li>서버 접근 권한의 최소화와 정기적 점검</li>
                    </ul>
                </PolicySection>

                <PolicySection
                    id="contact"
                    title="10. 개인정보 보호책임자 및 문의"
                >
                    <p>
                        운영자는 이용자의 개인정보 보호 관련 문의를 처리하기
                        위해 아래와 같이 연락 창구를 두고 있습니다.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            이메일:&nbsp;
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="text-primary-400 hover:text-primary-300 font-mono transition-colors"
                            >
                                {CONTACT_EMAIL}
                            </a>
                        </li>
                    </ul>
                    <p>
                        개인정보 침해에 대한 신고나 상담이 필요한 경우에는
                        개인정보보호위원회, 개인정보침해신고센터, 대검찰청,
                        경찰청 등 관계기관에 문의하시기 바랍니다.
                    </p>
                </PolicySection>

                <PolicySection id="changes" title="11. 개인정보처리방침의 변경">
                    <p>
                        본 개인정보처리방침은 관련 법령의 변경이나 서비스의
                        변경에 따라 수정될 수 있으며, 변경이 있을 경우 변경
                        사항의 시행 전 서비스 공지 또는 본 페이지를 통해
                        고지합니다.
                    </p>
                    <p className="text-secondary-500 text-xs">
                        시행일: {LEGAL_EFFECTIVE_DATE}
                    </p>
                </PolicySection>
            </LegalPageShell>
        </>
    );
}
