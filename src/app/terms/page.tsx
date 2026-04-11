import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { PolicySection, type TocItem } from '@/components/legal/PolicySection';
import { CONTACT_EMAIL } from '@/lib/contact';
import {
    INVESTMENT_DISCLAIMER,
    LEGAL_EFFECTIVE_DATE,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    SITE_NAME,
    SITE_URL,
    TERMS_DESCRIPTION,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/seo';

const PAGE_URL = `${SITE_URL}${TERMS_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${TERMS_TITLE} | ${SITE_NAME}`,
    description: TERMS_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
    },
};

const BREADCRUMB_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: TERMS_TITLE,
            item: PAGE_URL,
        },
    ],
};

const TOC: readonly TocItem[] = [
    { id: 'intro', label: '제1조 목적' },
    { id: 'definitions', label: '제2조 용어의 정의' },
    { id: 'effect', label: '제3조 약관의 효력 및 변경' },
    { id: 'service', label: '제4조 서비스의 제공 및 변경' },
    { id: 'disclaimer', label: '제5조 투자 정보에 관한 면책' },
    { id: 'obligations', label: '제6조 이용자의 의무' },
    { id: 'ip', label: '제7조 지적재산권' },
    { id: 'limitation', label: '제8조 책임의 제한' },
    { id: 'privacy', label: '제9조 개인정보의 보호' },
    { id: 'governing-law', label: '제10조 준거법 및 관할' },
    { id: 'contact', label: '제11조 문의처' },
];

export const metadata: Metadata = {
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title: `${TERMS_TITLE} | ${SITE_NAME}`,
        description: TERMS_DESCRIPTION,
        url: PAGE_URL,
        locale: 'ko_KR',
    },
    twitter: {
        card: 'summary',
        title: `${TERMS_TITLE} | ${SITE_NAME}`,
        description: TERMS_DESCRIPTION,
    },
};

export default function TermsPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c'),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(BREADCRUMB_JSON_LD).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
            <main className="flex flex-1 flex-col items-center px-6 py-12 sm:py-16">
                <article className="w-full max-w-3xl">
                    <LegalBreadcrumb pageTitle={TERMS_TITLE} />

                    <header className="border-secondary-800 border-b pb-8">
                        <p className="text-primary-400 font-mono text-xs tracking-widest uppercase">
                            TERMS OF SERVICE
                        </p>
                        <h1 className="text-secondary-100 mt-3 text-3xl font-bold sm:text-4xl">
                            {TERMS_TITLE}
                        </h1>
                        <p className="text-secondary-400 mt-4 text-sm leading-relaxed sm:text-base">
                            본 약관은 {SITE_NAME}(이하 &quot;운영자&quot;)이
                            제공하는 웹 서비스의 이용 조건 및 운영자와 이용자
                            간의 권리, 의무 및 책임 사항을 규정함을 목적으로
                            합니다. 서비스를 이용하기 전에 본 약관을 주의 깊게
                            읽어 주시기 바랍니다.
                        </p>
                        <p className="text-secondary-500 mt-4 text-xs">
                            시행일: {LEGAL_EFFECTIVE_DATE}
                        </p>
                    </header>

                    <div
                        role="note"
                        aria-label="투자 면책 고지 요약"
                        className="border-ui-danger/30 bg-ui-danger/5 my-8 rounded-lg border p-5"
                    >
                        <p className="text-ui-danger mb-2 text-xs font-semibold tracking-wider uppercase">
                            중요 안내
                        </p>
                        <p className="text-secondary-200 text-sm leading-relaxed sm:text-base">
                            {INVESTMENT_DISCLAIMER}
                        </p>
                        <p className="text-secondary-400 mt-2 text-xs leading-relaxed sm:text-sm">
                            {SITE_NAME}은(는) 투자 자문이나 매매 권유를 제공하지
                            않으며, 제공되는 모든 분석은 통계적·기술적 관점의
                            정보입니다. 자세한 내용은 아래 제5조를 확인해
                            주세요.
                        </p>
                    </div>

                    <nav
                        aria-label="목차"
                        className="border-secondary-800 bg-secondary-900/40 mb-8 rounded-lg border p-5"
                    >
                        <p className="text-secondary-400 mb-3 text-xs font-semibold tracking-wider uppercase">
                            목차
                        </p>
                        <ol className="space-y-2 text-sm">
                            {TOC.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={`#${item.id}`}
                                        className="text-secondary-300 hover:text-primary-400 transition-colors"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <div className="space-y-8">
                        <PolicySection id="intro" title="제1조 (목적)">
                            <p>
                                본 약관은 {SITE_NAME}이(가) 제공하는 미국 주식
                                기술적 분석 웹 서비스(이하 &quot;서비스&quot;)의
                                이용과 관련하여 운영자와 이용자 간의 권리, 의무
                                및 책임 사항, 기타 필요한 사항을 규정함을
                                목적으로 합니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="definitions"
                            title="제2조 (용어의 정의)"
                        >
                            <p>
                                본 약관에서 사용하는 용어의 정의는 다음과
                                같습니다.
                            </p>
                            <ul className="list-disc space-y-1.5 pl-5">
                                <li>
                                    <strong className="text-secondary-200">
                                        서비스
                                    </strong>
                                    : 운영자가 제공하는 미국 주식 차트,
                                    보조지표, AI 기반 기술적 분석 등 {SITE_NAME}
                                    의 모든 웹 기능
                                </li>
                                <li>
                                    <strong className="text-secondary-200">
                                        이용자
                                    </strong>
                                    : 본 약관에 따라 운영자가 제공하는 서비스를
                                    이용하는 모든 자
                                </li>
                                <li>
                                    <strong className="text-secondary-200">
                                        분석 정보
                                    </strong>
                                    : 서비스를 통해 제공되는 차트, 보조지표
                                    수치, 캔들 패턴, AI 분석 결과 등의
                                    기술적·통계적 정보
                                </li>
                            </ul>
                        </PolicySection>

                        <PolicySection
                            id="effect"
                            title="제3조 (약관의 효력 및 변경)"
                        >
                            <p>
                                본 약관은 서비스 화면에 게시하거나 기타의
                                방법으로 이용자에게 공지함으로써 효력이
                                발생합니다.
                            </p>
                            <p>
                                운영자는 필요 시 관련 법령을 위배하지 않는
                                범위에서 본 약관을 개정할 수 있습니다. 약관이
                                개정되는 경우 변경 사항의 적용일과 변경 사유를
                                명시하여 서비스 내 또는 본 페이지를 통해
                                공지합니다.
                            </p>
                            <p>
                                이용자가 변경된 약관에 동의하지 않는 경우 서비스
                                이용을 중단할 수 있으며, 변경된 약관의 적용일
                                이후에도 서비스를 계속 이용하는 경우 변경된
                                약관에 동의한 것으로 간주합니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="service"
                            title="제4조 (서비스의 제공 및 변경)"
                        >
                            <p>
                                운영자는 이용자에게 다음과 같은 서비스를
                                제공합니다.
                            </p>
                            <ul className="list-disc space-y-1.5 pl-5">
                                <li>
                                    미국 주식 종목의 실시간 및 과거 차트 데이터
                                    조회
                                </li>
                                <li>
                                    RSI, MACD, 볼린저밴드 등 보조지표와 캔들
                                    패턴의 자동 계산
                                </li>
                                <li>
                                    AI를 이용한 기술적 분석 요약 및 지지·저항
                                    레벨 추정
                                </li>
                                <li>
                                    기타 운영자가 추가로 개발하거나 제휴를 통해
                                    제공하는 일체의 서비스
                                </li>
                            </ul>
                            <p>
                                운영자는 서비스의 내용, 이용 방법, 이용 시간을
                                변경할 수 있으며, 이 경우 변경 사유 및 변경
                                내용을 서비스 화면에 공지합니다. 운영자는 상당한
                                이유가 있는 경우 서비스를 일시적 또는 영구적으로
                                중단할 수 있습니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="disclaimer"
                            title="제5조 (투자 정보에 관한 면책)"
                        >
                            <p>
                                <strong className="text-secondary-100">
                                    {INVESTMENT_DISCLAIMER}
                                </strong>
                            </p>
                            <ul className="list-disc space-y-1.5 pl-5">
                                <li>
                                    서비스가 제공하는 분석 정보는 과거 시세
                                    데이터에 기반한 통계적·기술적 해석이며, 미래
                                    주가나 수익률을 보장하지 않습니다.
                                </li>
                                <li>
                                    운영자는 「자본시장과 금융투자업에 관한
                                    법률」에 따른 투자자문업자 또는
                                    투자매매업자가 아니며, 서비스는 특정 종목의
                                    매수·매도를 권유하거나 투자 자문을 제공할
                                    목적으로 운영되지 않습니다.
                                </li>
                                <li>
                                    이용자는 투자 판단 및 그 결과에 대한 모든
                                    책임을 스스로 부담하며, 서비스의 정보를
                                    이용함으로써 발생한 손실에 대하여 운영자는
                                    법령에 의해 책임지지 않는 범위에서 어떠한
                                    책임도 지지 않습니다.
                                </li>
                                <li>
                                    시세 데이터에는 지연이나 오류가 포함될 수
                                    있으며, 운영자는 데이터의 정확성·완전성·
                                    적시성을 보증하지 않습니다.
                                </li>
                            </ul>
                            <p>
                                본 조는 관련 법령이 허용하는 최대 범위 내에서
                                적용됩니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="obligations"
                            title="제6조 (이용자의 의무)"
                        >
                            <p>
                                이용자는 다음 각 호의 행위를 하여서는 안 됩니다.
                            </p>
                            <ul className="list-disc space-y-1.5 pl-5">
                                <li>
                                    서비스에 게시된 정보를 무단으로 복제, 배포,
                                    가공하거나 상업적으로 이용하는 행위
                                </li>
                                <li>
                                    서비스의 정상적인 운영을 방해하는
                                    행위(과도한 자동화 요청, 크롤링, 역공학 등)
                                </li>
                                <li>
                                    운영자 또는 제3자의 지적재산권, 기타 권리를
                                    침해하는 행위
                                </li>
                                <li>
                                    법령, 공공질서 또는 미풍양속에 반하는 행위
                                </li>
                            </ul>
                        </PolicySection>

                        <PolicySection id="ip" title="제7조 (지적재산권)">
                            <p>
                                서비스에 포함된 텍스트, 이미지, 소프트웨어,
                                상표, 로고 등 모든 저작물에 관한 저작권 및 기타
                                지적재산권은 운영자 또는 해당 권리자에게
                                귀속됩니다.
                            </p>
                            <p>
                                이용자는 운영자가 명시적으로 허락한 범위
                                내에서만 서비스의 저작물을 이용할 수 있으며,
                                운영자의 사전 서면 동의 없이 이를 복제, 전송,
                                출판, 배포, 방송할 수 없습니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="limitation"
                            title="제8조 (책임의 제한)"
                        >
                            <p>
                                운영자는 천재지변, 전쟁, 기간통신사업자의 서비스
                                중지, 해킹 등 운영자가 통제할 수 없는 사유로
                                서비스를 제공할 수 없는 경우 이로 인한 이용자
                                또는 제3자의 손해에 대하여 책임지지 않습니다.
                            </p>
                            <p>
                                운영자는 서비스의 이용과 관련하여 이용자에게
                                발생한 간접적·특별·결과적 손해, 수익 상실,
                                데이터 손실 등에 대해 관련 법령이 허용하는 범위
                                내에서 책임을 지지 않습니다.
                            </p>
                            <p>
                                운영자는 제3자가 제공하는 시세 데이터, AI 분석
                                결과, 뉴스, 링크 등의 정확성과 신뢰성에 대하여
                                보증하지 않으며, 이에 대한 책임은 해당
                                제공자에게 있습니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="privacy"
                            title="제9조 (개인정보의 보호)"
                        >
                            <p>
                                운영자는 이용자의 개인정보를 중요시하며
                                「개인정보 보호법」 등 관련 법령을 준수하기 위해
                                노력합니다. 운영자가 수집·이용하는 정보와 처리
                                방법에 관한 자세한 내용은&nbsp;
                                <Link
                                    href={PRIVACY_PATH}
                                    className="text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                    {PRIVACY_TITLE}
                                </Link>
                                에서 확인할 수 있습니다.
                            </p>
                        </PolicySection>

                        <PolicySection
                            id="governing-law"
                            title="제10조 (준거법 및 관할)"
                        >
                            <p>
                                본 약관의 해석 및 운영자와 이용자 간의 분쟁에
                                관하여는 대한민국 법령을 준거법으로 합니다.
                            </p>
                            <p>
                                서비스 이용과 관련하여 운영자와 이용자 간에
                                분쟁이 발생한 경우, 양 당사자는 원만한 해결을
                                위해 성실히 협의하며, 협의가 이루어지지 않아
                                소송이 제기될 경우에는 민사소송법에 따른 관할
                                법원을 관할 법원으로 합니다.
                            </p>
                        </PolicySection>

                        <PolicySection id="contact" title="제11조 (문의처)">
                            <p>
                                본 약관 및 서비스 이용에 관한 문의는 다음의
                                연락처로 보내주시기 바랍니다.
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
                            <p className="text-secondary-500 text-xs">
                                시행일: {LEGAL_EFFECTIVE_DATE}
                            </p>
                        </PolicySection>
                    </div>
                </article>
            </main>
            <Footer />
        </>
    );
}
