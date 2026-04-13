# Changelog

## [0.8.6](https://github.com/y0ngha/siglens/compare/v0.8.5...v0.8.6) (2026-04-13)


### Features

* 비용 최적화를 위해 gemini를 사용할 때 무료버전 > 유료버전 순으로 사용하도록 처리 ([a84f04b](https://github.com/y0ngha/siglens/commit/a84f04ba4a0c788ec38a7b3dda8d788488797ac3))

## [0.8.5](https://github.com/y0ngha/siglens/compare/v0.8.4...v0.8.5) (2026-04-13)


### Features

* 지수백오프 적용 및 gemini ai 모델 fallback model 추가 ([795858d](https://github.com/y0ngha/siglens/commit/795858d57e7215116a66398ea4eef275dde8ba60))

## [0.8.4](https://github.com/y0ngha/siglens/compare/v0.8.3...v0.8.4) (2026-04-13)


### Bug Fixes

* 매직넘버 100을 PRICE_DECIMAL_FACTOR 상수로 추출 및 배열 접근 시 non-null assertion 추가 ([1c18416](https://github.com/y0ngha/siglens/commit/1c184160aa712076da35057a2259e043b9d3af81))
* 서포트 레벨 내림차순 정렬 (현재가 가까운 순서대로 표시) ([00618b1](https://github.com/y0ngha/siglens/commit/00618b15a703bd9d3be94835fe93d96131dfbb28))
* 툴팁 위치 계산 및 접근성 개선 (viewport 경계 체크, aria-describedby 추가, 초기 깜빡임 제거, React key에 index 추가) ([4c7fde9](https://github.com/y0ngha/siglens/commit/4c7fde9bb4bddbec97c2550da014293cea5f9e8c))


### Features

* 서포트/레지스턴스 키레벨 밀집도 기반 클러스터링 ([eb17ee7](https://github.com/y0ngha/siglens/commit/eb17ee77162bb373d95629d33b26152f3b2eaad6))
* 프로그레스 돌아갈 때 분석버튼 못누르도록 수정 ([a01d10c](https://github.com/y0ngha/siglens/commit/a01d10c050bf954fb2bae134baa541fab75b71d6))

## [0.8.3](https://github.com/y0ngha/siglens/compare/v0.8.2...v0.8.3) (2026-04-13)


### Features

* 모바일 사용성 개선 ([9ff8af4](https://github.com/y0ngha/siglens/commit/9ff8af4744e06968bf75a52982367814160d5e5e))

## [0.8.2](https://github.com/y0ngha/siglens/compare/v0.8.1...v0.8.2) (2026-04-12)

## [0.8.1](https://github.com/y0ngha/siglens/compare/v0.8.0...v0.8.1) (2026-04-12)


### Bug Fixes

* AnalysisProgress 상태를 ChartContent로 lift-up하여 모바일 remount 초기화 수정 ([a4d5a36](https://github.com/y0ngha/siglens/commit/a4d5a360f8fb1d8b99f5de91767a8bd7376b9468))
* Upstash 직렬화 문제 해결 및 쿨다운 로직 수정 ([3ab7336](https://github.com/y0ngha/siglens/commit/3ab7336826f095266624bc3049449a6fa06ebe86))


### Features

* Add trend direction badge to indicator signals and clarify strength labels ([0d4ae9b](https://github.com/y0ngha/siglens/commit/0d4ae9be97de212c80ad9601ec60d9fc6505b7c7))
* AI API 재시도 로직 및 에러 처리 개선 ([06b76f1](https://github.com/y0ngha/siglens/commit/06b76f12374dcc421596832955ab74629a88dfc1))
* Cloud Run worker 배포환경 조성 ([534c8f3](https://github.com/y0ngha/siglens/commit/534c8f36e4af210b558a10a21ca12979252dcbf2))
* tip 내용 수정 ([6812ae3](https://github.com/y0ngha/siglens/commit/6812ae34c933fb3f7a9df3e658dde1d2178e835c))

# [0.8.0](https://github.com/y0ngha/siglens/compare/v0.7.0...v0.8.0) (2026-04-12)


### Bug Fixes

* pollAnalysisAction parseJsonResponse try-catch 추가 및 테스트 케이스 추가 ([cf1e64c](https://github.com/y0ngha/siglens/commit/cf1e64cfae370dd06a9fc8d36588d08b05554778))
* PR 코멘트 반영 - import/first 위반 해결 및 as-cast 주석 추가 ([eae0ae8](https://github.com/y0ngha/siglens/commit/eae0ae88215e92c596c8430d4205b1d6aa75fd39))
* PR 코멘트 반영 - Promise.all race condition, JSON 파싱, hook 순서, useAnalysis 로직 ([ab38aba](https://github.com/y0ngha/siglens/commit/ab38abaf5e573979a7bfbce99a7849b4218ccd3a))
* PR 코멘트 반영 - skillsDegraded 위치 이동, 환경변수 검증 위치 조정, HTTP 상수화, 테스트 정리 ([332c226](https://github.com/y0ngha/siglens/commit/332c2261b688df7a1f95680fa6cbc60d9803dcc6))
* 아키텍처 위반 - SubmitAnalysisResult/PollAnalysisResult 도메인 타입으로 이동 ([a25e4b2](https://github.com/y0ngha/siglens/commit/a25e4b2124881b19b9afa15af2c85de8558cdd50))


### Features

* Gemini 분석을 Cloud Run 워커로 분리 - 외부 작업 큐 및 Redis 폴링 도입 ([a236e58](https://github.com/y0ngha/siglens/commit/a236e589accf6ca438f9d96668944a50fac32968)), closes [#291](https://github.com/y0ngha/siglens/issues/291)
* Worker /analyze 엔드포인트 및 submitAnalysisAction에 X-Worker-Secret 인증 추가 ([6f8e49c](https://github.com/y0ngha/siglens/commit/6f8e49c654a238b36b6a79b8f8b68dea4bbb6fc2))
* worker에서 Claude/Gemini AI provider 지원 ([cc4b667](https://github.com/y0ngha/siglens/commit/cc4b667b1974c52cd0417ad1d7d2848c40efbe0d))
* 분석 진행 UI 개선 - 팁 자동순환, 애니메이션, 15분 대기시간 확대 ([61d2cc8](https://github.com/y0ngha/siglens/commit/61d2cc8cd54c6e8dcbfc61aa49daccff54c33181))

# [0.7.0](https://github.com/y0ngha/siglens/compare/v0.6.1...v0.7.0) (2026-04-12)


### Bug Fixes

* buySellVolume 필드 추가, 차트 성능 최적화 ([f0c3437](https://github.com/y0ngha/siglens/commit/f0c34378765baea5f4b9fe4371ea2208cf2d492a))
* ChartSkeleton 위치 지정 오류 수정 (VolumeChart relative 추가) ([8b2ff19](https://github.com/y0ngha/siglens/commit/8b2ff198001c27d5299ebc2456468ef92ee9d584))
* classifyPriceZone zone boundary logic 설명 추가 및 테스트 커버리지 강화 ([2d81e68](https://github.com/y0ngha/siglens/commit/2d81e68917ec879ea1be43201e6cec6c95669c6e))
* ESLint violations and missing exports in SMC implementation ([d143ae6](https://github.com/y0ngha/siglens/commit/d143ae679a8d0d09453f07d0f4a739c7307a85f7))
* **home:** apply Gemini review — touch-manipulation, asymmetric padding, remove redundant borders ([1a583ce](https://github.com/y0ngha/siglens/commit/1a583cec5e2501fc1099d87ead182590d709c835))
* HowTo JSON-LD 동기 렌더링으로 SEO 개선 ([f51e6dc](https://github.com/y0ngha/siglens/commit/f51e6dcf63fb9f09f759faf6a94666b6d181abc8))
* **mobile:** 초기 스냅 SNAP_HALF 변경, 분석 중 시트 자동 올림 제거, 거래량 차트 padding 추가 ([6fa0a42](https://github.com/y0ngha/siglens/commit/6fa0a4234666c1c86775bc97733196e090ca63cf))
* overlayLabelUtils 테스트 mock에 신규 지표 필드 추가 ([e6fd6c7](https://github.com/y0ngha/siglens/commit/e6fd6c76d78a80af270543dc598b31f9a03b2d48))
* PR [#272](https://github.com/y0ngha/siglens/issues/272) 리뷰 반영 — countMdFiles 재귀화, 카운트 로직 통일, 테스트 추가 ([0ef4a58](https://github.com/y0ngha/siglens/commit/0ef4a588f65d7dc85d193df61a76a1bc02238159))
* PR [#274](https://github.com/y0ngha/siglens/issues/274) 리뷰 반영 — lastOf 헬퍼 재사용, 명시적 priceScaleId 선언 ([dee5608](https://github.com/y0ngha/siglens/commit/dee560827b759616219f0aaf0a3af0983103a63c))
* PR [#280](https://github.com/y0ngha/siglens/issues/280) 리뷰 반영 — toSorted 적용, max_tokens 양수 검증 복원, 오타 수정 ([9f58f17](https://github.com/y0ngha/siglens/commit/9f58f1787680b5a20dd8ef28758d3e9b5a78feaa))
* PR 코멘트 반영 - JSON 파싱 주석, 순수 함수 패턴, 로직 개선 ([7f4a26a](https://github.com/y0ngha/siglens/commit/7f4a26a65985ca0757e8dded0b38900b8d80090b))
* PR 코멘트 반영 - SMC 도메인 불변성 및 타입 정의 준수 ([de66b47](https://github.com/y0ngha/siglens/commit/de66b47e562f2d44fefebad313af413fcf2e3175))
* PR 코멘트 반영 - 스크립트 안정성 및 규칙 준수 ([e6472ff](https://github.com/y0ngha/siglens/commit/e6472ff492f353e2502ad24085e907a22e753429)), closes [#5](https://github.com/y0ngha/siglens/issues/5)
* **refactor:** useOnClickOutside 통합 및 버그 수정 ([55b2ebb](https://github.com/y0ngha/siglens/commit/55b2ebb4a4801ab8489de9974333fdb3cfdfbfc1))
* Remove blocking awaits from Home() and wrap async operations in Suspense ([4cb3a07](https://github.com/y0ngha/siglens/commit/4cb3a071f6e91117f18ab99dd62446b07f9e9608))
* SEO audit — meta/schema/structure improvements (closes [#282](https://github.com/y0ngha/siglens/issues/282)) ([20ea8f3](https://github.com/y0ngha/siglens/commit/20ea8f3af60ea4c5d57228a3bddb2f7892ed6e13))
* SEO 및 접근성 개선 사항 반영 ([649a119](https://github.com/y0ngha/siglens/commit/649a1190d5ff61f726c37d27f3269095ba2ddb65))
* useFocusTrap 의존성 배열 린트 위반 수정 ([9cdb59f](https://github.com/y0ngha/siglens/commit/9cdb59fea4029ab6821938c5f9a35dd86d114080))
* WAI-ARIA roving tabindex와 컬러 토큰 통합 ([dddd1e0](https://github.com/y0ngha/siglens/commit/dddd1e09fa69a4c076d9a5c5956e984531e85205))
* 개인정보처리방침 및 이용약관 페이지 접근성 및 구조 개선 ([29f370f](https://github.com/y0ngha/siglens/commit/29f370f349e8e67e9ab36d99fd0cabbed828abb0))
* 리뷰 코멘트 반영 — PSARNextStateResult 인터페이스 추출, non-null 단언 교체, 가독성 개선, 테스트 케이스 보강 ([f2b1e81](https://github.com/y0ngha/siglens/commit/f2b1e81d42c775c3fa4fedeffcbe863f7c249578))
* 모바일 바텀시트 차트 렌더링 및 시트 자동 확장 버그 수정 ([863a902](https://github.com/y0ngha/siglens/commit/863a90208cafb1f85e37e597e36b4bc3183b8149))
* 바텀시트 강제 닫기 제거 ([03d030e](https://github.com/y0ngha/siglens/commit/03d030e38cd4eb7e0c8e9a11f3eb964a23265fa4))
* 불필요한 훅 제거 및 바텀시트 높이 CSS 변수 적용 ([e63ef94](https://github.com/y0ngha/siglens/commit/e63ef94724341f8f50f356d8c3a40b85dd75117a))
* 온도/상위P 범위 검증 추가 및 테스트 통합 ([8334b81](https://github.com/y0ngha/siglens/commit/8334b812fbf653128b4b6ed6477af11fc24dc826))
* 전략 스킬 리뷰 코멘트 반영 (mean-reversion, multi-timeframe, wyckoff) ([ab0807d](https://github.com/y0ngha/siglens/commit/ab0807d4334b98cfe0752263c98f40d682c7768d))
* 접근성 개선 - aria-label 제거, aria-hidden 추가, 색상 대비율 수정 ([cec98ce](https://github.com/y0ngha/siglens/commit/cec98cea956ba89ef0ba4f4e238620628c4eab1e))
* 접근성 및 UI/UX 가이드라인 위반 사항 개선 ([106dab8](https://github.com/y0ngha/siglens/commit/106dab8560e4939f24ffbcec62ddac85777c0160))
* 접근성 위반 사항 수정 ([f8b0fd4](https://github.com/y0ngha/siglens/commit/f8b0fd40bbd4ca4a2f2408be36e380fe82c17b63))
* 접근성 위반 사항 수정 (포커스 트랩, 훅 선언 순서) ([861d743](https://github.com/y0ngha/siglens/commit/861d743519ef66e0656d896d4660c93b2ad554df))
* 차트 패턴 스킬 카테고리 및 keyPrices 수정 ([e5c91e7](https://github.com/y0ngha/siglens/commit/e5c91e790d0a62a0fbed48d89b32c5f537592edf))


### Features

* 9종 보조지표 domain 계산 로직 구현 ([a9d31bf](https://github.com/y0ngha/siglens/commit/a9d31bf8c4cf05052363b6722304efbabb6ddea1))
* buy/sell volume chart에 buy/sell labels 추가 ([b2ac419](https://github.com/y0ngha/siglens/commit/b2ac419aed1a36decd1267191ed6ffcdab397e39))
* Buy/Sell Volume 인디케이터 구현 ([26e76a4](https://github.com/y0ngha/siglens/commit/26e76a4198c636d64ba747f80d22167370293cd9))
* Buy/Sell Volume을 기존 Volume 오버레이로 적용 ([8db2197](https://github.com/y0ngha/siglens/commit/8db2197147096671cd944eab8ed7b16ab07b8c2f))
* Candlestick Patterns 스킬 신규 카테고리 추가 ([56dfdf9](https://github.com/y0ngha/siglens/commit/56dfdf94e0d773915c015b407fa05344a811d296))
* EntryRecommendation 진입 추천 여부 추가 ([eed55a6](https://github.com/y0ngha/siglens/commit/eed55a6fc1bc785f30367d3bb7020beec756eec5))
* **home:** Suspense 기반 로딩 및 스켈레톤 추가 ([be6e89b](https://github.com/y0ngha/siglens/commit/be6e89ba4d5125240cc021816e6b8eee1971c7ca))
* HowItWorks 설명 업데이트 ([791bd8f](https://github.com/y0ngha/siglens/commit/791bd8f5381520919fa87d66b326d59e5f1a2ff1))
* Indicators 보조지표 스킬 추가 (ATR, OBV, Parabolic SAR, Williams %R, Supertrend, MFI, Keltner Channel, CMF, Donchian Channel) ([fe53616](https://github.com/y0ngha/siglens/commit/fe53616f18c3af7f48c4f34821dd259968d38b8a))
* JSON-LD HowTo 스키마 추가 ([cba00b9](https://github.com/y0ngha/siglens/commit/cba00b9e4bd1ff0e6e536fcc2e3b8050950baf9a))
* Naver SEO 메타태그 및 설명 개선 ([f595e2e](https://github.com/y0ngha/siglens/commit/f595e2ed2d5f02ea9f9032f9f58d88028786d6ba)), closes [#248](https://github.com/y0ngha/siglens/issues/248) [#249](https://github.com/y0ngha/siglens/issues/249)
* Patterns 차트 패턴 스킬 추가 ([4bd348b](https://github.com/y0ngha/siglens/commit/4bd348bdcecb23f1f858e13998af1171d1fa1e43))
* Privacy Policy / Terms 페이지 추가 (YMYL/E-E-A-T SEO) ([2d9097f](https://github.com/y0ngha/siglens/commit/2d9097f21275c7cc79d8892738bf6266df2114bc))
* **prompt:** SMC 섹션 및 스퀵 모멘텀 강화 추가 ([c2b58ae](https://github.com/y0ngha/siglens/commit/c2b58ae0c22fa9840274d4c48e37ee366d6e7caf))
* section sr-only에 aria-hidden 추가 ([3cb44e7](https://github.com/y0ngha/siglens/commit/3cb44e7608180af5875dd73a8f28a403cff8a22d))
* SEO 개선 - iOS 홈화면 아이콘, HSTS 헤더 설정 ([a5f35b6](https://github.com/y0ngha/siglens/commit/a5f35b6132eea51535a6804907f11c067364c979))
* SMC(Smart Money Concepts) 보조지표 및 Skills 파일 추가 ([2fddd24](https://github.com/y0ngha/siglens/commit/2fddd244504bee9df8a086e74f2b9814535ed908))
* Squeeze Momentum 인디케이터 추가 ([22499c2](https://github.com/y0ngha/siglens/commit/22499c27dbfc97cbae2e0ec6fc7cee03e6bdcc6b))
* Strategies 전략 스킬 추가 (Wyckoff, Divergence, Fibonacci, Breakout, Mean Reversion, Multi-Timeframe) ([aa8e397](https://github.com/y0ngha/siglens/commit/aa8e3971586da746144187ce36209c0cb885f804))
* Support/Resistance 지지/저항 도구 스킬 신규 카테고리 추가 ([698af5e](https://github.com/y0ngha/siglens/commit/698af5ef100c4a85374d90f37e083db4414f2960))
* 공통으로 사용할 useOnClickOutside 작성 ([425472c](https://github.com/y0ngha/siglens/commit/425472c202dd02bca87bc97c8e08551e41dc15d8))
* 마켓 상수 및 타임프레임 검증 추가 ([9896048](https://github.com/y0ngha/siglens/commit/9896048f2c544b450c2c2d285334129256cffbef))
* 모바일 AI 분석 패널 바텀시트 UX 개편 ([ed55533](https://github.com/y0ngha/siglens/commit/ed55533156ad710c207d6eaa5f385b5634a83e67))
* 바텀시트 snap_half 55%로 변경 ([d9a73d0](https://github.com/y0ngha/siglens/commit/d9a73d018a793c48e0354b9de49cccadedef1b43))
* 사이트맵 커버리지 확장 (20개 → 100개+) ([10e3501](https://github.com/y0ngha/siglens/commit/10e350151bba203dc2d1bc52e37c4b7a2d0adcc9))
* 심볼별 OG 이미지 생성 및 크롤러 텍스트 추가 ([46ada9a](https://github.com/y0ngha/siglens/commit/46ada9a8d91cad9ffd7e551014cd280fe1c9e4c5))
* 인기 종목 자동 업데이트 스크립트 추가 ([9f86bcf](https://github.com/y0ngha/siglens/commit/9f86bcf657e44198a3a17180961a3e8303d6c920))
* 카테고리 > 섹터로 명칭 변경 ([3bba12a](https://github.com/y0ngha/siglens/commit/3bba12a8929fe1911ca3373a1adb545b65fc3be5))
* 카테고리별 종목 섹션 추가 ([77c90cf](https://github.com/y0ngha/siglens/commit/77c90cf21eca85e68f1d8e1015aa38100479a8e6))
* 타임프레임 URL 파라미터 검증 및 서버-클라이언트 동기화 ([2725fc2](https://github.com/y0ngha/siglens/commit/2725fc2ea716b5da93dfacbff1db2f34f4f11a3b))


### Performance Improvements

* 차트 라이브러리 dynamic import로 모바일 TTI 개선 ([8987839](https://github.com/y0ngha/siglens/commit/89878390d2ad781432c82fc5690fc4d67ed60a41))

## [0.6.1](https://github.com/y0ngha/siglens/compare/v0.6.0...v0.6.1) (2026-04-10)


### Features

* add contact/error-report dialog to footer and not-found page ([212e8da](https://github.com/y0ngha/siglens/commit/212e8da0f01339d91e1c33aea262354b1bd835a2))
* add notFound routing for invalid/unknown tickers ([7e060fb](https://github.com/y0ngha/siglens/commit/7e060fbe08fd6a73f48efd391c6c4d5a260297c6))
* Assets 저장시 한국어가 있을 경우 365일 저장, 없을 경우 12시간 저장으로 변경 ([9a118a3](https://github.com/y0ngha/siglens/commit/9a118a3390e77f9b749fb565d8d7b4cef4b47868))
* invalid ticker format validation and safe FMP caching ([a09de3c](https://github.com/y0ngha/siglens/commit/a09de3c3e9048118f1478b3e14fcaa0bd8ddf2e3))

# [0.6.0](https://github.com/y0ngha/siglens/compare/v0.5.0...v0.6.0) (2026-04-10)


### Bug Fixes

* Correct action recommendation colors per DESIGN.md ([3d7c9c8](https://github.com/y0ngha/siglens/commit/3d7c9c88010deaf083ec425234752639b8e2e6b3)), closes [#f87171](https://github.com/y0ngha/siglens/issues/f87171) [#ef5350](https://github.com/y0ngha/siglens/issues/ef5350) [#4ade80](https://github.com/y0ngha/siglens/issues/4ade80) [#26a69a](https://github.com/y0ngha/siglens/issues/26a69a)
* SEO 개선 사항 적용 (상수 통일, 스키마 수정, PWA 아이콘) ([960e1f3](https://github.com/y0ngha/siglens/commit/960e1f373b1517ab68f5ae41a125012dc989043a))


### Features

* ActionRecommendation 차트 가격선 오버레이 추가 ([d67c333](https://github.com/y0ngha/siglens/commit/d67c333883c96da65634e0afc7345dfba92469d0))
* Replace fire-and-forget patterns with waitUntil ([0f0b008](https://github.com/y0ngha/siglens/commit/0f0b0089184ba046056f5af8bc6ac34f443688bd))
* SEO 종합 개선 ([5ef8a85](https://github.com/y0ngha/siglens/commit/5ef8a85536137cae26f899584ea0f531e1badefd))
* Set actionPricesVisible default to true, improve styling ([f9c1d51](https://github.com/y0ngha/siglens/commit/f9c1d513a2ef7e16fdc69680ad78b952ba60ea35))

# [0.5.0](https://github.com/y0ngha/siglens/compare/v0.4.0...v0.5.0) (2026-04-09)


### Bug Fixes

* PR [#220](https://github.com/y0ngha/siglens/issues/220) 리뷰 반영 — 프롬프트 필드 목록 동기화, DOMAIN.md 문서 업데이트, 타입 명명화 ([e3c6334](https://github.com/y0ngha/siglens/commit/e3c63345b3b0e9e1df14556beaa4f64dbb892044))
* PR [#222](https://github.com/y0ngha/siglens/issues/222) 리뷰 반영 — dead code 뮤테이션 제거, hasCompanyName 단순화, AssetInfo 타입 배치 개선 ([1d1c9f0](https://github.com/y0ngha/siglens/commit/1d1c9f0167debfd18279891f3efe0a22f6632588))
* PR [#222](https://github.com/y0ngha/siglens/issues/222) 리뷰 반영 — 회사명 표시 버그 수정 및 API 캐시 갱신 ([c226134](https://github.com/y0ngha/siglens/commit/c2261344d21107b4bfe23c24f7d26a2283594476))
* summary 스키마 상세 지시 복원 및 가이드라인 ALL 키워드 유지 ([511c416](https://github.com/y0ngha/siglens/commit/511c4160129c9b07189b760c26941c7aa41797b2))
* TICKER_SEARCH_CACHE_TTL 24h로 복원, assetInfo 옵셔널 체이닝 적용 ([a7e4464](https://github.com/y0ngha/siglens/commit/a7e446442283efa214424f1b2e792a3675161a18))
* 뒤로가기 시 Object is disposed 에러 수정 — chart.remove() 전 구독 해제 ([a5447dd](https://github.com/y0ngha/siglens/commit/a5447dd16d9b32a4ed82dd51f0fe494d9c180c98))
* 심볼 페이지 쿼리 데이터 주입 최적화 및 코드 중복 제거 ([6a538cf](https://github.com/y0ngha/siglens/commit/6a538cfb3e0002044007b95b96f6d2ed0a0c322f))
* 심볼 페이지 회사명 중복 표시 방지 ([6b9f8b8](https://github.com/y0ngha/siglens/commit/6b9f8b866f161735b6d6e87927f1065900fdfe92))
* 프롬프트 지시 중복 제거 및 PR [#220](https://github.com/y0ngha/siglens/issues/220) 리뷰 반영 ([16225e2](https://github.com/y0ngha/siglens/commit/16225e2a0fae48d35b6087f617cacb6fbf72a479))


### Features

* AI 분석 Summary 접근성 개선 및 매매 전략(actionRecommendation) 필드 추가 ([#219](https://github.com/y0ngha/siglens/issues/219)) ([e910652](https://github.com/y0ngha/siglens/commit/e91065224151a6a2d6085942b6ec860f6400798e))
* 심볼 페이지 티커에 회사명 표시 ([d433b52](https://github.com/y0ngha/siglens/commit/d433b52517f4164558f0e94f74ebce6ba12704ae))

# [0.4.0](https://github.com/y0ngha/siglens/compare/v0.3.0...v0.4.0) (2026-04-09)


### Bug Fixes

* cache.get() 에러 처리 및 Korean translator 리팩토링 ([4cd311a](https://github.com/y0ngha/siglens/commit/4cd311a425414da4bfa4f89d849e9fea39d4d849))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 3차 반영 ([b2efec0](https://github.com/y0ngha/siglens/commit/b2efec046a17020cbb272089fde43851aab4cf66))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([ae74389](https://github.com/y0ngha/siglens/commit/ae743895e0536a0b16077b7dddb68f1a1f2b622d))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([2aa516c](https://github.com/y0ngha/siglens/commit/2aa516cd1da219a8493580cbfe848afe55ecf693))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([f80d269](https://github.com/y0ngha/siglens/commit/f80d2691e528d07695fbea6abdc1944e17ef3844))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([aa6a4f3](https://github.com/y0ngha/siglens/commit/aa6a4f34dc79aef2aed29f4baec39d2b7e93a28f))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([1f8e99a](https://github.com/y0ngha/siglens/commit/1f8e99aef20e1be393b05fd6b2a24ed5f908d8bf))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([98fab19](https://github.com/y0ngha/siglens/commit/98fab19602229fadf374133ea71dd7eacb04e655))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([4b0e197](https://github.com/y0ngha/siglens/commit/4b0e1970b8870298b04c6ce316b3b207bbd702d3))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 - fetchFmpEndpoint 헬퍼 추출 및 테스트 추가 ([464c8c2](https://github.com/y0ngha/siglens/commit/464c8c24fb894eee7a78584a87455a85f771e34c))
* **search:** PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 2차 반영 ([d4a4aba](https://github.com/y0ngha/siglens/commit/d4a4abae4226fc82f34fed22536f07a900aaf9a3))
* **search:** PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([b90de27](https://github.com/y0ngha/siglens/commit/b90de277bf539caadd30e74b33ec7fdf23604fc8))
* useMemo로 inputClass와 buttonClass 감싸기 ([f1b9ce2](https://github.com/y0ngha/siglens/commit/f1b9ce2513255fc95eb4aec10e40e46c0f664558))
* 재분석 버튼 활성화 및 상태 관리 개선 ([5aef6ee](https://github.com/y0ngha/siglens/commit/5aef6eecf0b61fec6e79439fbc6d0a53da7fabbf))


### Features

* ticker 페이지 로딩 성능 개선 ([e1ae8d1](https://github.com/y0ngha/siglens/commit/e1ae8d1cc100a63b8463f3fe6dc98db445f07067))
* 재분석 버튼 활성화 ([c9b02b9](https://github.com/y0ngha/siglens/commit/c9b02b9edad1377c77c9a325f7f42cf182483a1d))
* 티커 검색 도메인 타입 및 유틸리티 ([1a4f49d](https://github.com/y0ngha/siglens/commit/1a4f49df9edc5d523d8bcd76505f7478f6846b02))
* 티커 검색 인프라 레이어 구현 ([48fd0ce](https://github.com/y0ngha/siglens/commit/48fd0ce364975724456d408eba963aef26d76ae5))
* 티커 검색 캐시 및 쿼리 설정 ([4fcc56c](https://github.com/y0ngha/siglens/commit/4fcc56cf774b24a3dde0e09464bd02a94462dfd6))
* 티커 자동완성 UI 컴포넌트 ([0c77945](https://github.com/y0ngha/siglens/commit/0c77945905669191282f5de2f09a1c8124aa251a))
* 한국어 티커 데이터 동기화 스크립트 ([de6a450](https://github.com/y0ngha/siglens/commit/de6a4508ad6a14d54623a1b6eb7157a661973350))

# [0.3.0](https://github.com/y0ngha/siglens/compare/v0.2.5...v0.3.0) (2026-04-07)


### Features

* 최근 검색한 티커 저장 기능 추가 ([97e2b1c](https://github.com/y0ngha/siglens/commit/97e2b1c2076afcb73635c025f773bd790c941628))

## [0.2.5](https://github.com/y0ngha/siglens/compare/v0.2.4...v0.2.5) (2026-04-07)


### Bug Fixes

* 보조지표 pane 제거 실패 및 label 위치 미갱신 문제 해결 ([512a5fb](https://github.com/y0ngha/siglens/commit/512a5fbdd965b0970d5cbe976052d12ec212a3c9)), closes [#201](https://github.com/y0ngha/siglens/issues/201) [#212](https://github.com/y0ngha/siglens/issues/212)

## [0.2.4](https://github.com/y0ngha/siglens/compare/v0.2.3...v0.2.4) (2026-04-07)


### Bug Fixes

* **deploy:** Vercel ignoreCommand에서 git describe 제거 ([74fc36d](https://github.com/y0ngha/siglens/commit/74fc36dd3965a1cc81edb2f3b846acc6e6a028bd))

## [0.2.3](https://github.com/y0ngha/siglens/compare/v0.2.2...v0.2.3) (2026-04-07)

## [0.2.2](https://github.com/y0ngha/siglens/compare/v0.2.1...v0.2.2) (2026-04-07)


### Bug Fixes

* ai panel 기본 width는 640px로 고정 ([c6d2e59](https://github.com/y0ngha/siglens/commit/c6d2e599c1f5164b674da24c22d3b2d418a69cfd))
* seo site_url 잘못 되어있는 것 수정 ([c4db441](https://github.com/y0ngha/siglens/commit/c4db44149d5dc4478a12f5a268779267de55a7c8))
* 재분석 쿨다운 로직 수정 및 분석시 사용자 안내 추가 ([574d1cf](https://github.com/y0ngha/siglens/commit/574d1cf79b66243b9078bc6d7e30a857cd6e5f4b))

## [0.2.1](https://github.com/y0ngha/siglens/compare/v0.2.0...v0.2.1) (2026-04-07)

# 0.2.0 (2026-04-07)


### Bug Fixes

* address PR review findings on symbol-page hooks and client ([e28928d](https://github.com/y0ngha/siglens/commit/e28928dd80c8331e01a1a38404e08650a8288e10))
* AI 분석 패널 너비 드래그 조절 이슈 수정 ([bfc3a1a](https://github.com/y0ngha/siglens/commit/bfc3a1a3e0d41ad3a56c5a2cc7fab0d1f9d626de))
* AI 분석 패널 너비 조절 안정화 ([70591bf](https://github.com/y0ngha/siglens/commit/70591bf56737f3db1fe704dbadd2c923e52a618a))
* AI 분석 패널 독립 스크롤 영역 분리 - 차트 영역 높이 고정 ([982011f](https://github.com/y0ngha/siglens/commit/982011f02354c201cfc8638f43d767c373a39d5e))
* AI 분석 패널 드래그 기능 안정화 ([b9ef5cc](https://github.com/y0ngha/siglens/commit/b9ef5cc2615ec983379d7ffdc0a69087d626741b))
* AI 분석 패널 확장 시 차트 영역이 같이 움직이는 문제 수정 ([e0308d7](https://github.com/y0ngha/siglens/commit/e0308d7ca30befe82f8b250fcddd3d25718c3928))
* Alpaca getBars API 최신 데이터 반환 로직 수정 ([cea79ae](https://github.com/y0ngha/siglens/commit/cea79aeea09851ebfe2e1abf830ca26408c6a581))
* Alpaca getBars API 최신 데이터 반환 오류 수정 ([f7638aa](https://github.com/y0ngha/siglens/commit/f7638aa32155079d17cba68b3a153d3aa8f7c753))
* Alpaca getBars 최신 데이터 반환 로직 개선 ([bfd1d6c](https://github.com/y0ngha/siglens/commit/bfd1d6cdd297b47508ebc497cd842516b56a0bcb))
* Alpaca getBars 최신 데이터 반환 로직 개선 ([90b4713](https://github.com/y0ngha/siglens/commit/90b471321384696037c2099e165003dcba182e7b))
* Alpaca getBars 최신 데이터 반환 로직 수정 ([6e51102](https://github.com/y0ngha/siglens/commit/6e5110278c3a8e4153d4debeec73197921d12d05))
* Alpaca getBars 최신 데이터 반환하도록 수정 ([ca83405](https://github.com/y0ngha/siglens/commit/ca83405f8cdbec6706bfda446efb1a52aabb839a))
* Alpaca 마켓 데이터 조회 시 null 방어 처리 ([0f50c39](https://github.com/y0ngha/siglens/commit/0f50c3990c711f382ed276194e08c971d7ee9442))
* Alpaca/FMP provider에 start(from) 파라미터 추가로 bars null 반환 문제 해결 ([6336aa0](https://github.com/y0ngha/siglens/commit/6336aa00aed9b53aa39075bd08fff79c5cf37a11))
* AnalysisPanel EyeIcon 복원 및 신뢰도 설정 통합, 캐시 테스트 보강 ([057230e](https://github.com/y0ngha/siglens/commit/057230e049c509ef9078095e0beb32764c4a4e0b))
* AnalysisResponse 타입을 domain으로 이동, 레이어 위반 해소 ([e236d2a](https://github.com/y0ngha/siglens/commit/e236d2a48e8df65aab99758a19670f714d903455))
* any 타입 제거 및 tsconfig baseUrl 추가로 모듈 경로 오류 해결 ([a8a8bd5](https://github.com/y0ngha/siglens/commit/a8a8bd5933b83ac623eed920d0ff2959f984edc7))
* candle-labels 캔들 패턴 라벨 생성 로직 개선 ([19a434f](https://github.com/y0ngha/siglens/commit/19a434fc0e41b6774eaf7ad1786435ce41fe77cd))
* candle-labels 캔들 패턴 라벨 생성 로직 개선 ([294fcaf](https://github.com/y0ngha/siglens/commit/294fcafc6e71d1bd40a53bec130737487baf51c5))
* CCI 계산 로직 및 유틸 함수 수정 ([1577a8c](https://github.com/y0ngha/siglens/commit/1577a8cbd197daaf232f2e53dc0c30b41ad777ba))
* CCI 계산 로직 수정 및 fix-log 정리 ([dc36c27](https://github.com/y0ngha/siglens/commit/dc36c27c79bb1bd5f0197d197fc48f1ffb0dc033))
* CCI 인디케이터 계산 로직 수정 ([c3017f0](https://github.com/y0ngha/siglens/commit/c3017f046510a1bbe81c13407733e6223cb1d87d))
* Claude JSON 마크다운 코드블록 파싱 버그 수정 ([ce104b9](https://github.com/y0ngha/siglens/commit/ce104b9bed48996c2d79ef3b5d0c868ef007a4b1))
* Claude 응답 JSON 파싱 버그 - 마크다운 코드블록 처리 추가 ([f36455e](https://github.com/y0ngha/siglens/commit/f36455ebe5ba5b04104666e623e580f6cd8cfbcd))
* DEFAULT_TIMEFRAME과 DEFAULT_BARS_LIMIT을 domain/constants/market.ts로 이동 ([b6eb080](https://github.com/y0ngha/siglens/commit/b6eb0802b1ae50e8a8cb1093c812871b54f3bc5f))
* DOMAIN.md 삭제된 함수 참조 제거 및 skills EOF 개행 추가 ([35d3aa9](https://github.com/y0ngha/siglens/commit/35d3aa9cfaef7053d084d45520ee60db6fd7de5c))
* DOMAIN.md 잔존 PatternResult/patterns 참조 제거 및 CONVENTIONS.md EOF 규칙 추가 ([c61fffc](https://github.com/y0ngha/siglens/commit/c61fffc583dc99dae5c22d71ed46152c99021990))
* ElliottWave 스킬 및 분석 패널 로직 수정 ([dc507d5](https://github.com/y0ngha/siglens/commit/dc507d54123d8f87ebd41c5201ba760e6d9aed17))
* EMA 기간 선택 시 버튼 크기 자동 증가 문제 수정 ([71dc526](https://github.com/y0ngha/siglens/commit/71dc5269d66501e06947a230b0f01ce489cd5ef5))
* ESLint 오류 및 SymbolSearch Design 위반 수정 ([ee1d82c](https://github.com/y0ngha/siglens/commit/ee1d82c1d7c36d3048a86fa45501ba70fa2c3405))
* FMP provider URL 스펙 준수 및 Daily 타임프레임 분리 ([574bec1](https://github.com/y0ngha/siglens/commit/574bec16ac1e5844351547fbbe4d657ec7cef37b))
* FMP provider 마켓 데이터 API 에러 처리 개선 ([1b51750](https://github.com/y0ngha/siglens/commit/1b517507c2ad60aaef4ca4506eb7f4926dc50612))
* getBars API 최신 데이터 반환 오류 수정 ([60ce65c](https://github.com/y0ngha/siglens/commit/60ce65c29326e53d21d971560bc2135a8be149b4))
* Ichimoku Cloud 타입 오류 및 미사용 코드 정리 ([191f218](https://github.com/y0ngha/siglens/commit/191f218745fbed980e88afce8759205364eb9c81))
* Ichimoku 오버레이 로직 개선 ([5e0591d](https://github.com/y0ngha/siglens/commit/5e0591d2ba1ce9252688a448f0dc2b5895c70b66))
* import/first 규칙 위반 수정 및 CONVENTIONS.md ESLint 섹션 추가 ([d8beca1](https://github.com/y0ngha/siglens/commit/d8beca107a82475ac3c84a37a3af61f8dd138c7d))
* JSON.parse 에러 처리 및 process.env 복원 로직 수정 ([be8f45e](https://github.com/y0ngha/siglens/commit/be8f45e6babcdb4962cdafe7fc9ab30ac9c55a54))
* limit 검증 로직 회귀 ([9d8f46b](https://github.com/y0ngha/siglens/commit/9d8f46b0581f70bc2db1efdf0acd98a8e766b7b6))
* limit 음수 미검증 버그 수정 및 DOMAIN.md 타입 정의 추가 ([6147251](https://github.com/y0ngha/siglens/commit/61472517c6360b4690be9ed835179fbb40ca765e))
* MA/EMA 토글 버튼 크기 통일 및 초기 비활성 처리 ([a2b4989](https://github.com/y0ngha/siglens/commit/a2b49896b46b61431dc0fc1a5e4ea9a19a8fce91))
* MACD firstMacdIdx 일반화 및 calculateEMA 중복 가드 제거 ([3f14819](https://github.com/y0ngha/siglens/commit/3f148194737475ac3cd7ee927dbdc107010db5c4))
* MACD 대순환 분석 Skill 메타데이터 및 피드백 반영 ([fafaed7](https://github.com/y0ngha/siglens/commit/fafaed78a0dccbb3b0e42252af191c0e249f40cb))
* MACD 대순환 분석 스킬 수정 ([bbbda5f](https://github.com/y0ngha/siglens/commit/bbbda5f90e15861f3285563d508c4e7c88c1979d))
* MACD 대순환 분석 스킬 수정 ([33ebe95](https://github.com/y0ngha/siglens/commit/33ebe95728786ee8d57f225e5a1eb7bbdb6d8278))
* overlay legend hook 로직 수정 및 문서 업데이트 ([499173b](https://github.com/y0ngha/siglens/commit/499173b61f4d6865e96e0ec277bb6f266a7bdb86))
* overlay legend 타입 및 유틸 함수 정제 ([9f78509](https://github.com/y0ngha/siglens/commit/9f78509740905e0e868f84e639234dd88d501bc4))
* OverlayLegend 컴포넌트 레이아웃 및 로직 개선 ([19d20bd](https://github.com/y0ngha/siglens/commit/19d20bd332b43a8a6204f16fe8e7709d16cebf58))
* OverlayLegend 컴포넌트 상태 관리 및 테스트 개선 ([e089e18](https://github.com/y0ngha/siglens/commit/e089e187c10fd2ee90b6ff12c198f76ca9af32ce))
* Pane indicator 동적 index 계산 로직 개선 ([02b85c1](https://github.com/y0ngha/siglens/commit/02b85c100c1130d79c2eeaaa251f87b554ef0279))
* Pane Indicator에서 Label이 제대로 표시되지 않음 ([f613ee6](https://github.com/y0ngha/siglens/commit/f613ee68fe156f5a46e5d18cf127c52eb3a90836))
* Pane Indicator에서 Label이 제대로 표시되지 않음 ([f92c877](https://github.com/y0ngha/siglens/commit/f92c877628cc50eeae9073d594f7743fa2b7d197))
* PatternResult 신뢰도 변환 로직 개선 및 패턴 전달 ([4a23d2c](https://github.com/y0ngha/siglens/commit/4a23d2c9f2d88bf76e9ebc42a86d2fc5cc65ae46))
* period <= 0일 때 RangeError 방지 가드 추가 ([19d3dff](https://github.com/y0ngha/siglens/commit/19d3dff414ed328d76f58d19e0927967a3d66062))
* PR [#35](https://github.com/y0ngha/siglens/issues/35) 리뷰 반영 — IndicatorResult 정리 및 테스트 보완 ([d066dce](https://github.com/y0ngha/siglens/commit/d066dce371f331856bcb092ad36df5a82a6b4c3d)), closes [#9](https://github.com/y0ngha/siglens/issues/9)
* PR [#36](https://github.com/y0ngha/siglens/issues/36) 리뷰 반영 — IndicatorResult rsi/vwap 추가 및 테스트 보완 ([6d80042](https://github.com/y0ngha/siglens/commit/6d80042a281a6b7477c168ed695e255fdad2b73b))
* PR [#42](https://github.com/y0ngha/siglens/issues/42) 리뷰 반영 — window 예약어 변수명 수정 및 CONVENTIONS.md 규칙 추가 ([175f2d6](https://github.com/y0ngha/siglens/commit/175f2d6120d296b8be91a243f947e92804ca8374))
* PR [#42](https://github.com/y0ngha/siglens/issues/42) 리뷰 반영 — 불필요한 가드 제거 및 테스트 매직 넘버/누락 케이스 수정 ([cbdba36](https://github.com/y0ngha/siglens/commit/cbdba361ed0e32ef104864ef4726488e7ed4c9df))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 2차 리뷰 코멘트 처리 ([cfbd94a](https://github.com/y0ngha/siglens/commit/cfbd94a36b8910d1655272580f9e92fc70ec4a7b))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 3차 리뷰 코멘트 처리 ([cbfc6ff](https://github.com/y0ngha/siglens/commit/cbfc6ff6caf7a2758cab37902c618cda130a498c))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 4차 리뷰 코멘트 처리 ([4392497](https://github.com/y0ngha/siglens/commit/4392497958101d0e2ab7600b4c76cd9d7245af3c))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 리뷰 코멘트 처리 ([8803fbb](https://github.com/y0ngha/siglens/commit/8803fbb359757302cd3f935165793a08a031abbb))
* PR [#52](https://github.com/y0ngha/siglens/issues/52) 리뷰 코멘트 처리 ([8dcd098](https://github.com/y0ngha/siglens/commit/8dcd0984572425b222f03b80e5db5cb222dbc844))
* PR [#54](https://github.com/y0ngha/siglens/issues/54) 리뷰 코멘트 처리 ([2444b19](https://github.com/y0ngha/siglens/commit/2444b1950d1c22be58962bf5b37f392a180bfb77))
* PR [#55](https://github.com/y0ngha/siglens/issues/55) 리뷰 코멘트 처리 및 자체 리뷰 반영 ([c936c5c](https://github.com/y0ngha/siglens/commit/c936c5c7e174738b21d9b3018c32f1ffb27e9677))
* PR [#56](https://github.com/y0ngha/siglens/issues/56) 리뷰 코멘트 처리 ([3b1dd98](https://github.com/y0ngha/siglens/commit/3b1dd986a793693c3b63439b05933806ba1b0edb))
* PR [#60](https://github.com/y0ngha/siglens/issues/60) 리뷰 코멘트 반영 ([5972b1f](https://github.com/y0ngha/siglens/commit/5972b1fbb0c2fff6092e65764bd9ce65472dafda))
* PR [#60](https://github.com/y0ngha/siglens/issues/60) 리뷰 코멘트 반영 ([425710a](https://github.com/y0ngha/siglens/commit/425710aa87f8166e6edeed471720504f970b62db))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([af2358b](https://github.com/y0ngha/siglens/commit/af2358b8c295d54b6d2373ef80e617f2c430a970))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([bca1bec](https://github.com/y0ngha/siglens/commit/bca1becae9b50e4805f774eb67fe11f43247af90))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([df10d8f](https://github.com/y0ngha/siglens/commit/df10d8f181c364207d68ca7fa73b41d7bd771cc3))
* pre-push에서 필요없는 명령 삭제 ([c9490c7](https://github.com/y0ngha/siglens/commit/c9490c7e1a0e3fa7d4b426adca11141359cf6008))
* prompt.test.ts 테스트 케이스 수정 ([f04f107](https://github.com/y0ngha/siglens/commit/f04f107e4791dd223d1f7b6dfd58acf8e23b0950))
* React key 속성 중복 오류 해결 ([d792d91](https://github.com/y0ngha/siglens/commit/d792d91454020260cf7265fb8f4c5070f8d3f6d5))
* React key 중복 오류 수정 ([e9ce76d](https://github.com/y0ngha/siglens/commit/e9ce76d0abe3bef8474fa3a68f31ee7ffaaa04e8))
* React key 중복 오류 수정 ([1cf454c](https://github.com/y0ngha/siglens/commit/1cf454c431410fa0a7613d4631f28d26bc2f2367))
* React key 중복 오류 수정 및 confidence 타입 개선 ([86ae991](https://github.com/y0ngha/siglens/commit/86ae99191034666459f53179809f7a1d3f1137ab))
* Redis 캐시 설정 및 분석 데이터 반환 로직 개선 ([688b21e](https://github.com/y0ngha/siglens/commit/688b21e847630bc96a3197b1daca6c9c1ec1d84d))
* RSI 리뷰 반영 — 매직 넘버 상수 추출 및 테스트 보강 ([1233bf7](https://github.com/y0ngha/siglens/commit/1233bf712d783e45b3f678313412d4c2832e51b2))
* RSI_PANE_INDEX 2로 변경 ([195c01c](https://github.com/y0ngha/siglens/commit/195c01c55dd726c86218fa8fc80ca84281e87e7a))
* rsi.ts, rsi.test.ts 파일 끝 개행 추가 ([6f9cfec](https://github.com/y0ngha/siglens/commit/6f9cfecd9854b78d16e6c792602d48bf80205f09))
* Signal.type 구체화, KeyLevels interface 분리, 테스트 구조 개선 ([59cafc7](https://github.com/y0ngha/siglens/commit/59cafc7f2cf41e7abf5f54e62c292d1334fc22d3))
* Skill.type 리터럴 타입 좁히기 및 테스트 상수명 명확화 ([eefb7c6](https://github.com/y0ngha/siglens/commit/eefb7c68c64f5a483e72fcce7743d7e201b7b4be))
* snake_case → camelCase, RSI(14) 매직 넘버 제거 ([6a42b25](https://github.com/y0ngha/siglens/commit/6a42b25b8dc2d407d2106e200ba044db10e040a8))
* standalone chart에 맞게 pane을 0으로 설정 ([7363f74](https://github.com/y0ngha/siglens/commit/7363f745d57d8a5592403a5edeaa4c1c56166b13))
* Stochastic 오실레이터 오버플로우 및 성능 개선 ([b63a031](https://github.com/y0ngha/siglens/commit/b63a03140e5a1733278baff3ffac76abd4b56904))
* symbol 페이지 초기 로딩 성능 개선 ([48bc7ce](https://github.com/y0ngha/siglens/commit/48bc7cec7f0fc153a190f62c8d7d651496a6ca77))
* union type alias 분리 및 CONVENTIONS 리터럴 규칙 명확화 ([bd14f18](https://github.com/y0ngha/siglens/commit/bd14f18970ec15ad8ede22a54801d0d8ca4d631b))
* useAnalysis 초기 마운트 시 분석 결과 초기화 로직 수정 ([9099cd4](https://github.com/y0ngha/siglens/commit/9099cd46a129e7da19c8b84d1fcf919994911340))
* useAnalysis 파라미터 주석 추가 및 pr-fix-agent 문서 업데이트 ([a3a79b4](https://github.com/y0ngha/siglens/commit/a3a79b43fdc32e644bc0b4d764010c3a757e213e))
* usePanelResize에 SSR 시 window 접근 가드 추가 ([bf48b1e](https://github.com/y0ngha/siglens/commit/bf48b1e9a966b4e3bea9e72361131b139fe0a9ea))
* Volume Profile 인디케이터 계산 로직 수정 ([c53f6f6](https://github.com/y0ngha/siglens/commit/c53f6f6f22bab18d35949e15e70d630804c1b5a4))
* Volume Profile 인디케이터 계산 로직 수정 ([7565f0b](https://github.com/y0ngha/siglens/commit/7565f0b71d4afe4fc2d36bd704d5b8a089dd54d3))
* Volume Profile 인디케이터 계산 로직 수정 ([7a952ad](https://github.com/y0ngha/siglens/commit/7a952adb6e11648a07f43123653fd6c4838ffaa3))
* Volume Profile 인디케이터 리뷰 코멘트 반영 ([0d6dc5a](https://github.com/y0ngha/siglens/commit/0d6dc5a54d173a66533ccc529f83d2f15a5252ea))
* Volume Profile 인디케이터 오버레이 로직 개선 ([62d39be](https://github.com/y0ngha/siglens/commit/62d39becbfda27c5bfeff03414d802a8d8abb76c))
* Volume Profile 인디케이터 재귀 함수 구조 개선 ([f1f7a55](https://github.com/y0ngha/siglens/commit/f1f7a55368b38bc19841d3cfccdda7313b52b2d5))
* Volume Profile 인디케이터 테스트 커버리지 및 코드 품질 개선 ([35bc200](https://github.com/y0ngha/siglens/commit/35bc2005f85224e12a23b8ebc98010a601c7a238))
* volume-profile 인디케이터 및 테스트 수정 ([8defe64](https://github.com/y0ngha/siglens/commit/8defe640c7b59faf3ec8af4f4b3bc3d90157051c))
* VolumeChart 데이터 클리어 및 SymbolPageClient 렌더링 패턴 개선 ([9dea90d](https://github.com/y0ngha/siglens/commit/9dea90d330f3cf6412ee93ac1e8473c7b38448b9))
* 기본 확장 false, 버튼 크기 유동적으로 변경 ([80f2d8b](https://github.com/y0ngha/siglens/commit/80f2d8bf2782b297063e8bf53070abe1a6268c0a))
* 동부 시간대 DST 변환 로직 수정 ([383cd44](https://github.com/y0ngha/siglens/commit/383cd44bb34bcafe812b78f8ac3de31f17abca64))
* 드래그 제스처 인식 안정화 및 패널 리사이징 로직 개선 ([a4ec980](https://github.com/y0ngha/siglens/commit/a4ec980bd72a588088b797c32299581466cd1496))
* 리뷰 반영 — constants.ts EOF 개행, Wilder 검증 강화, describe 레이블 수정 ([bed8a65](https://github.com/y0ngha/siglens/commit/bed8a65842cdda80039117664c661cedb310e94c))
* 리뷰 반영 — WilderState 외부 이동, Wilder smoothing 테스트 강화, 컨벤션 추가 ([1746cec](https://github.com/y0ngha/siglens/commit/1746cec348524b434aabe67b121ad446684bc3d3))
* 리뷰 코멘트 반영 - 도메인 경계값 추출 및 테스트 구조 정리 ([c8bb39e](https://github.com/y0ngha/siglens/commit/c8bb39eab82aae8ee9fbb9611ef683af38d45f62))
* 리뷰 코멘트 반영 - 타입 안정성 및 환경변수 일관성 개선 ([b6b32ec](https://github.com/y0ngha/siglens/commit/b6b32ec18144aec1ec79e82e1f3fc0118992b328))
* 리뷰 코멘트 반영 완료 ([a92d80f](https://github.com/y0ngha/siglens/commit/a92d80f4f4f50adca5ced7c9e28900f39cf374fe))
* 리뷰 피드백 반영 — 상수 응집도 개선 및 에러 상태 노출 ([b7ab6df](https://github.com/y0ngha/siglens/commit/b7ab6df333e008e49c514f379340db7d54c326bd))
* 매직 넘버를 상수로 교체 및 테스트 describe 이름 수정 ([8176968](https://github.com/y0ngha/siglens/commit/8176968849863858df65ae8e9b03956e5f259dbf))
* 메인 페이지 차트 empty state와 훅 선언 순서 정리 ([6e972b1](https://github.com/y0ngha/siglens/commit/6e972b16e7b72ddb7b7289405f0aefd14c893071))
* 모바일 UI 캐시 메시지 버그 수정 ([be45440](https://github.com/y0ngha/siglens/commit/be454406d3407f21f5de2931885213f8709d7939)), closes [#2](https://github.com/y0ngha/siglens/issues/2) [#3](https://github.com/y0ngha/siglens/issues/3)
* 모바일 UI, 캐시, 메시지 버그 4건 수정 ([34ddfb2](https://github.com/y0ngha/siglens/commit/34ddfb2f45480da386a1e7bd90fddb69f3143224))
* 미감지 스킬 숨기기 로직 개선 ([29bb5cf](https://github.com/y0ngha/siglens/commit/29bb5cfb6195e0d7ac9635b2565f774b1b174024))
* 배포 전 부족한 부분이나, 오류때문에 당장 힘든 부분 임시 비활성처리 ([cc5f6ce](https://github.com/y0ngha/siglens/commit/cc5f6ce81055147b25643f28d3865b26b68fd6f4))
* 보조지표 Pane 첫 번째 토글 시 제거되지 않는 버그 수정 ([c8dbae9](https://github.com/y0ngha/siglens/commit/c8dbae91d9349617b9ee4384c657820a179cf2f3))
* 보조지표 드롭다운 오버플로우 잘림 현상 해결 ([f3957c0](https://github.com/y0ngha/siglens/commit/f3957c05281216d5b1bd6623888c21bb91beff54))
* 보조지표 드롭다운 잘림 버그 수정 ([265fb17](https://github.com/y0ngha/siglens/commit/265fb17ab3ad6c29ad2bfbb7d4b842df6343e84a))
* 보조지표 레이블 렌더링 안정화 ([e8f3a1a](https://github.com/y0ngha/siglens/commit/e8f3a1a5d8052c1427f2107692fe4a634f254bff))
* 보조지표 레이블 렌더링 안정화 ([92d3413](https://github.com/y0ngha/siglens/commit/92d3413416c37739f2a5541a01af15abd9d33d68))
* 보조지표 레이블 렌더링 안정화 ([57aed78](https://github.com/y0ngha/siglens/commit/57aed78acb296621d34a11a1e17f970bb2fbceaa))
* 볼륨 프로필 인디케이터 테스트 및 오버레이 로직 개선 ([4f532ec](https://github.com/y0ngha/siglens/commit/4f532ec766433ad85558753238d77537e4768eb9))
* 분봉 차트 시간 표시 오류 및 ET 룩백 수정 ([77e2c03](https://github.com/y0ngha/siglens/commit/77e2c03330225929907ec801bd38b339874aee85))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([4105b9c](https://github.com/y0ngha/siglens/commit/4105b9cf1428c55fea5afde56cae1797ce0afe39))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([f258803](https://github.com/y0ngha/siglens/commit/f258803ad9b48481c708a2e4fd6e83d92b4c143a))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([479a9ba](https://github.com/y0ngha/siglens/commit/479a9badcdcb6625fdca021a7f22547bb313cf2f))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([114c0a0](https://github.com/y0ngha/siglens/commit/114c0a09b31c760073ed78053c4ebdeb26d5d299))
* 분석 패널 마운트 버그 수정 ([7b9c641](https://github.com/y0ngha/siglens/commit/7b9c641fb0bee8eff363d5c418a75d3a79f95e24))
* 빌드 및 린트 오류 수정 ([36c4969](https://github.com/y0ngha/siglens/commit/36c49690de2858681be54c398d1597d68dcf7a4d))
* 상승/하락 추세선 차트 표시 개선 ([a08a35b](https://github.com/y0ngha/siglens/commit/a08a35bc1efd1280d89ac6ecb463db006304794b))
* 서버 컴포넌트에서 new Date() 사용으로 인한 하이드레이션 경고 해결 ([38a8034](https://github.com/y0ngha/siglens/commit/38a80349f8f39e6ebc6d3143b26bf5600cefa1c3))
* 시간대 포맷 및 Alpaca lookback 계산 개선 ([fb72827](https://github.com/y0ngha/siglens/commit/fb728278931bc5df801772657be2d8e950ae6e14))
* 심볼 페이지 초기 로딩 성능 개선 ([3c720f9](https://github.com/y0ngha/siglens/commit/3c720f9d09d442dfb585210b92aaa42fed703353))
* 엘리어트 파동 스킬 신뢰도 필터링 적용 ([99530a7](https://github.com/y0ngha/siglens/commit/99530a7ae6b1778d69ebef4a1b04748aa82bcbc4))
* 이동평균선 대순환 분석 skill 수정 ([8ac0cf2](https://github.com/y0ngha/siglens/commit/8ac0cf2bdefadd72aa3cc491e89a6abca92bfbac))
* 이치모쿠 클라우드 오버레이 코드 품질 개선 ([eab1619](https://github.com/y0ngha/siglens/commit/eab1619fc845cb20772efec9c8904d2e94b7e271))
* 일목균형표 선행스팬 투영 및 구름 렌더링 수정 ([0647dc0](https://github.com/y0ngha/siglens/commit/0647dc03e9e987249873894b5d54d94885991eec))
* 종목 분석 페이지 안정성 및 에러 처리 개선 ([70bb90e](https://github.com/y0ngha/siglens/commit/70bb90e4a42c4a68038360198c7646b6761d1566))
* 중복 신뢰도 테스트 수정 및 Skill.pattern 미사용 필드 제거 ([4760e9f](https://github.com/y0ngha/siglens/commit/4760e9f63efacfadc053bb218100a83d7f62d5ee))
* 차트 패턴 감지되어도 차트에 표시되지 않는 문제 수정 ([45a0682](https://github.com/y0ngha/siglens/commit/45a0682c83dee75076138186a82dc6c1fd6a9a3c))
* 차트 패턴 오버레이 렌더링 오류 수정 ([fbf2b03](https://github.com/y0ngha/siglens/commit/fbf2b033d4d996912a78c4a36f20c7da9630ec8f))
* 차트 패턴 오버레이 매직 리터럴 및 구조적 문제 해결 ([6df9dc4](https://github.com/y0ngha/siglens/commit/6df9dc42fe70ccaf81cb0bfa40bf3ba3770389e0))
* 차트 패턴 오버레이 버그 수정 ([06330f1](https://github.com/y0ngha/siglens/commit/06330f1feec5689e1a68bc028727ab5d15dcca77))
* 차트 패턴 오버레이 신뢰도 필터링 및 계산 로직 수정 ([55e48ae](https://github.com/y0ngha/siglens/commit/55e48ae7c545a4c16ddf17a22f096f57941ab9e2))
* 차트 패턴 오버레이 표시 버그 수정 ([61635a8](https://github.com/y0ngha/siglens/commit/61635a8ef80bdca53a2135c7fde0914022490e7e))
* 차트 패턴 오버레이 표시 버그 수정 ([838985c](https://github.com/y0ngha/siglens/commit/838985c21091f794e782b2f8759b23bd29dfbe36))
* 차트 패턴 오버레이 표시 버그 수정 ([7d2dc1f](https://github.com/y0ngha/siglens/commit/7d2dc1f260a848442c3f825eb8e603646e5a61ec))
* 차트 패턴 오버레이 표시 버그 수정 ([1829a05](https://github.com/y0ngha/siglens/commit/1829a058d9f05df879e8af43449e36199c8ab8ae))
* 차트 패턴 오버레이 표시 버그 수정 ([5ff9aa7](https://github.com/y0ngha/siglens/commit/5ff9aa7eafdffcf34975641aa3634fddcab408b1))
* 차트 패턴 오버레이 표시 버그 수정 ([98ac851](https://github.com/y0ngha/siglens/commit/98ac8518c77f72c209b9c763993b4d1f8b63b1da))
* 차트 패턴 오버레이 표시 버그 수정 ([738bbad](https://github.com/y0ngha/siglens/commit/738bbadaacf5318245c9f62486338810f023c768))
* 차트 패턴 오버레이 표시 버그 수정 ([14477aa](https://github.com/y0ngha/siglens/commit/14477aa788e5ea9d3078d46400c9e4f7ff941e62))
* 차트 패턴 주요 가격대 텍스트 위치 및 표시 조정 ([88b04d1](https://github.com/y0ngha/siglens/commit/88b04d199be3157ea682f34614af2618fc5fd86f))
* 초기 마운트 시 API 중복 호출 방지 ([e4924df](https://github.com/y0ngha/siglens/commit/e4924dfc3ddbfbe8c83c7b0f6ce10056b499b7c8))
* 초기 페이지 로딩 시 AI 분석 실패하면 자동 재분석 실행 ([9241d3d](https://github.com/y0ngha/siglens/commit/9241d3d7c09bd632e572f2714c5f2ade6b71b937))
* 추세선 오버레이 후킹 로직 단순화 및 색상 문서화 ([5d6ed10](https://github.com/y0ngha/siglens/commit/5d6ed10ea6edae01065788c9606e84d6587ce3f7))
* 추세선 차트 렌더링 및 분석 오류 개선 ([690c7bd](https://github.com/y0ngha/siglens/commit/690c7bd6de3ed749b414fe0a87966ece2e1a8b9d))
* 캔들 트렌드 분석 및 프롬프트 테스트 수정 ([374a525](https://github.com/y0ngha/siglens/commit/374a525babb163702333d6349593834ac30e56d6))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([630c65a](https://github.com/y0ngha/siglens/commit/630c65aa1ee5e8e84cb41d7b6d29bc9fdfc98aeb))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([2d026f1](https://github.com/y0ngha/siglens/commit/2d026f121e2adc2b9ee78ffbacb657aa1137927e))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([8ba820e](https://github.com/y0ngha/siglens/commit/8ba820e8ee588dd4653487f1be2ab602527fbe7e))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([82ee8ed](https://github.com/y0ngha/siglens/commit/82ee8ede1a00bd5540148d40c2b154420dedbb1c))
* 캔들 패턴 감지 오류 및 프롬프트 구조 개선 ([8b837c0](https://github.com/y0ngha/siglens/commit/8b837c0d0556aa9d0c3be04fd9c3c5efb90b0ed9))
* 캔들 패턴 검출 로직 최적화 및 정확도 개선 ([f81954c](https://github.com/y0ngha/siglens/commit/f81954ce1423c7a63ee17a848396bca8e86b480a))
* 캔들 패턴 마커 표시 로직 개선 및 정확도 향상 ([e724492](https://github.com/y0ngha/siglens/commit/e7244923c708d7faf6e1c96e2ed5f73123487a24))
* 캔들 패턴 차트 시각화 개선 ([bb48aec](https://github.com/y0ngha/siglens/commit/bb48aece63162db0bf6536a7b06add93548cbe7d))
* 캔들 패턴 차트 표시 로직 개선 ([d885adb](https://github.com/y0ngha/siglens/commit/d885adb152eb22affa1113538383e8cbd43c150a))
* 타임프레임 변경 시 AI 분석 자동 업데이트 - 리뷰 피드백 반영 ([0edb89e](https://github.com/y0ngha/siglens/commit/0edb89e4746985b762048b3de7bd1cb2a8b46c82))
* 타임프레임 변경 시 AI 분석이 자동으로 업데이트되지 않는 버그 수정 ([fc0d227](https://github.com/y0ngha/siglens/commit/fc0d227d6034e96b0e6b108365cd1578036252cb))
* 타임프레임 변경 시 Suspense 경계 내 bars 로드 완료 후 분석 실행 ([6e6ddc3](https://github.com/y0ngha/siglens/commit/6e6ddc374b5a505eda515de76e56fd2f1075ad22))
* 테스트 내 매직 넘버 제거 및 CONVENTIONS.md 패턴 보완 ([e45cfbc](https://github.com/y0ngha/siglens/commit/e45cfbc8352edb88dd72d23d1ad210f8a7ca53bc))
* 테스트 파일 매직 넘버 14 → RSI_DEFAULT_PERIOD 교체 ([17b04a0](https://github.com/y0ngha/siglens/commit/17b04a0c3255bab5604a43fa5f40b326eaa56dc1))
* 패턴 오버레이 데이터 동기화 이펙트 불필요한 가드 제거 ([abc19ee](https://github.com/y0ngha/siglens/commit/abc19eeda5429ba0e53e4911b0f2a2ad7e5db2c9))
* 패턴 오버레이 의존성 정리 및 테스트 리팩토링 ([67d35bf](https://github.com/y0ngha/siglens/commit/67d35bf90d2688f2e991cc5c27c625bfaa4eccd9))
* 패턴 오버레이 주요 가격대 텍스트 렌더링 개선 ([a673f95](https://github.com/y0ngha/siglens/commit/a673f9514c4ddf78371aa07bd855623428dd4454))
* 프로덕션 console.log 제거 및 캐시 체크 로직 통합 ([a327156](https://github.com/y0ngha/siglens/commit/a32715664ffef301964249f9b29eeaaa79054097))
* 프롬프트 스키마 누락 필드 추가 및 에러 로깅 개선 ([d346575](https://github.com/y0ngha/siglens/commit/d346575170bcfa9a4eb264575d6bdac63bfcd4af))
* 프롬프트 스키마 누락 필드 추가 및 에러 로깅 개선 ([2de3576](https://github.com/y0ngha/siglens/commit/2de3576ffd0c233d49b77a9d8e4ca8e11d6623c2))
* 핵심 레벨 오버레이 로직 최적화 ([77c589f](https://github.com/y0ngha/siglens/commit/77c589fbed1252d137ea3f06141fcd8b55421f18))
* 핵심 레벨 차트 렌더링 및 패널 레이아웃 개선 ([4ae6f3e](https://github.com/y0ngha/siglens/commit/4ae6f3e1f5fc51d32012466adeceba5ea0807385))
* 핵심 레벨 차트 오버레이 렌더링 최적화 ([8a36e55](https://github.com/y0ngha/siglens/commit/8a36e55f3d3a15d2ec293595175ec273cf9fd23b))


### Features

* /api/bars Route Handler 구현 및 SIGLENS_API.md 추가 ([ea40805](https://github.com/y0ngha/siglens/commit/ea40805dc806333c7341ca9479c9932b61e77d72))
* 6개 패턴 Skills 파일에 category 및 display 필드 추가 ([a42e3bf](https://github.com/y0ngha/siglens/commit/a42e3bfe6136a11c950013afe13f06fa80336343))
* AI 분석 패널 기본 크기를 화면 너비의 1/3으로 확대 ([398d2ec](https://github.com/y0ngha/siglens/commit/398d2ecfdba2f79b49e30553685ddcf94670ba05))
* AI 분석 패널 너비 드래그 조절 ([9c4403c](https://github.com/y0ngha/siglens/commit/9c4403c335733f49a5d8957a13a52a39f250a779))
* AI 분석 패널 컴포넌트 구현 ([2b45e84](https://github.com/y0ngha/siglens/commit/2b45e84e5d89a61201346f1efaa7a2eeb1686242))
* AI 분석 패널에서 미감지 캔들 패턴 숨기기 ([15bfd0f](https://github.com/y0ngha/siglens/commit/15bfd0fa023f6fc88e160cfd1cf5fd09b31a111d))
* AI 분석 프롬프트에 Stochastic RSI 포함 ([5bf3b56](https://github.com/y0ngha/siglens/commit/5bf3b56e5fa5a20366ff7a5f0a104f59042988bc))
* AI 분석 프롬프트에 Stochastic 포함 ([c21abbf](https://github.com/y0ngha/siglens/commit/c21abbf0be2eee4469b0b32f20405a12bd653afd))
* AI 프롬프트 구성 로직 구현 ([#18](https://github.com/y0ngha/siglens/issues/18)) ([975b06a](https://github.com/y0ngha/siglens/commit/975b06a33a2756ecc522969728464e19017e0186))
* AIProvider 인터페이스 및 AnalysisResponse 타입 정의 ([b493e5b](https://github.com/y0ngha/siglens/commit/b493e5bf7726451a71853b12b7758753e96c0787))
* AlpacaProvider 구현 (data.alpaca.markets) ([0136cf9](https://github.com/y0ngha/siglens/commit/0136cf951cc911d0ed3cfa4e1277e608c9f4a929))
* AnalysisPanel 아코디언 토글 UI 구현 ([f998abb](https://github.com/y0ngha/siglens/commit/f998abb4d8b91f49367c57d806115c0ec43a80d1))
* AnalysisPanel에 근거 포함 지지/저항, 가격 목표 섹션 추가 ([7446e28](https://github.com/y0ngha/siglens/commit/7446e2870bb81475519389bdb156576f975db1af))
* AnalysisPanel에 신뢰도 배지 표시 ([769b3fd](https://github.com/y0ngha/siglens/commit/769b3fdcbbe9f340f445c63f76d17b4b0410fe9e))
* AnalysisResponse에 candlePatterns 필드 추가 및 UI 렌더링 ([ad32673](https://github.com/y0ngha/siglens/commit/ad326738ce5b80832d572aa6c9ba35cfbdf16485))
* analyzeAction에 Redis 캐싱 적용 ([f167f63](https://github.com/y0ngha/siglens/commit/f167f6388c3ae38be41fa113a553af0918a87c1b))
* CCI (Commodity Channel Index) 인디케이터 구현 ([bcdbaf9](https://github.com/y0ngha/siglens/commit/bcdbaf9003f9901b3548eac67beb53c79b566a51))
* CCI 색상 상수 추가 ([0b5d6b6](https://github.com/y0ngha/siglens/commit/0b5d6b6ab3fad0188eb5dfcd4da2990ca14e6e96))
* CCI 인디케이터 타입 및 상수 추가 ([4dd9b38](https://github.com/y0ngha/siglens/commit/4dd9b381ab8ab93777ef8124106f81d26919c4de))
* CCI 인디케이터를 AI 분석 프롬프트에 포함 ([7aac250](https://github.com/y0ngha/siglens/commit/7aac2501659a1e66a4e2a297ef4e3d1c25135e3f))
* CCI 인디케이터를 차트 UI에 통합 ([3032505](https://github.com/y0ngha/siglens/commit/3032505a1569e79fb61adce4b581ec98223eb14c))
* CCI 차트 훅 구현 ([782137f](https://github.com/y0ngha/siglens/commit/782137f2f124c6313a599e98581f2e10dcc73329))
* ClaudeProvider 구현 ([47a3348](https://github.com/y0ngha/siglens/commit/47a33480ad9793a2d1598dbbdf1c3fcce928fc9d))
* createMarketDataProvider 팩토리 함수 구현 ([ea79255](https://github.com/y0ngha/siglens/commit/ea79255e74a4326006b91b3f7375b9f247329a09))
* DMI 인디케이터 구현 ([#14](https://github.com/y0ngha/siglens/issues/14)) ([b57acf6](https://github.com/y0ngha/siglens/commit/b57acf6ad0e33bfb858f2b33e9239909411579b6))
* DMI 차트 훅 구현 ([aa936fc](https://github.com/y0ngha/siglens/commit/aa936fc9b1ed0350d6e71f8a126edaa418242edf))
* EMA 인디케이터 구현 ([38e753c](https://github.com/y0ngha/siglens/commit/38e753c9fdae4671a6f7eaeec40a255a6c75ce98))
* FmpProvider 클래스 구현 ([14a3bca](https://github.com/y0ngha/siglens/commit/14a3bcae002275a00aa3cf5213771d9f97c15335))
* Gemini AI 프로바이더 지원 추가 ([232dde7](https://github.com/y0ngha/siglens/commit/232dde7602689f09f7b80fbf2823246b61abd389))
* Ichimoku Cloud UI 및 분석 통합 ([e091134](https://github.com/y0ngha/siglens/commit/e09113473b7e802cd1723d7a495acc608cfb46ae))
* Ichimoku Cloud 인디케이터 구현 ([7bb9a01](https://github.com/y0ngha/siglens/commit/7bb9a011e50432cf21bfb794db2e940294ed97e2))
* JSON-LD XSS 방지를 위해 특수문자 이스케이프 처리 ([57a55bb](https://github.com/y0ngha/siglens/commit/57a55bb37ea0a12a616bee28fd023ca8d13933b9))
* KeyLevels/PriceTargets 타입 확장 및 AI 프롬프트 분석 가이드라인 추가 ([860391e](https://github.com/y0ngha/siglens/commit/860391ead84c19b7a3768ebb8bde1427246f89bc))
* layout.tsx에 ReactQueryProvider 추가 ([2900183](https://github.com/y0ngha/siglens/commit/290018317fa28c0d18b2248faf40c9d611ac0d4b))
* lineWidth를 훅 파라미터로 분리 ([bf7995a](https://github.com/y0ngha/siglens/commit/bf7995a96605e2ba7e2f16e0c95d91021c633add))
* MA 이동평균선 기간 추가 (5, 60, 120, 200일) 및 프롬프트 지표값 누락 수정 ([c8198bc](https://github.com/y0ngha/siglens/commit/c8198bcd27187e657a80b80af8072b3a911f1a5a)), closes [#145](https://github.com/y0ngha/siglens/issues/145) [#149](https://github.com/y0ngha/siglens/issues/149)
* MA 인디케이터 구현 ([20d46b5](https://github.com/y0ngha/siglens/commit/20d46b5a8e32e4215e634b36a0f8f709056bf887))
* MACD 대순환 분석 Skill 작성 ([40b078c](https://github.com/y0ngha/siglens/commit/40b078c2ba6c8ab2388e7737e19c831ba28b09a9))
* MACD 인디케이터 구현 ([fc825b3](https://github.com/y0ngha/siglens/commit/fc825b3ab2dff2b9e4215b98430dde8e54339341))
* MACD 차트 훅 구현 ([#28](https://github.com/y0ngha/siglens/issues/28)) ([3b4fa5b](https://github.com/y0ngha/siglens/commit/3b4fa5bbdaf9f57e978fa7a467963cf60601df47))
* MarketDataProvider 인터페이스 추가 ([34d8a8e](https://github.com/y0ngha/siglens/commit/34d8a8eaa5f4bf51a5fee52335544fc5529bde10))
* PatternResult 변환 및 patterns prop 전달 ([02fe904](https://github.com/y0ngha/siglens/commit/02fe9049ce004adf69ac899724728205a6f74c7c))
* PatternResult 변환 및 patterns prop 전달 ([a23c0a3](https://github.com/y0ngha/siglens/commit/a23c0a3ae21c579d3d292a7b3c97b412b5756cac))
* patternSummaries에 Skills 전용 지시 추가 ([0644fec](https://github.com/y0ngha/siglens/commit/0644fec86ceaddf3a51617f75a4abf7fdfd54db3))
* React Query API 레이어 구현 (barsApi, analysisApi, queryKeys) ([c97e931](https://github.com/y0ngha/siglens/commit/c97e9312a863ab976af4cdf03013c09910dd20cb))
* Redis 기반 AI 분석 결과 캐싱 인프라 구현 ([6138c31](https://github.com/y0ngha/siglens/commit/6138c3199ea5ab49b230a3724057fd16b48f5818))
* RSI 인디케이터 구현 ([a50c315](https://github.com/y0ngha/siglens/commit/a50c31587fd5743586f1b9029b4aca346db468a0))
* RSI 차트 훅 구현 ([91ade04](https://github.com/y0ngha/siglens/commit/91ade045f76363c9c60cc4b154de5c3f940fd97b))
* SEO 최적화 ([4b583b9](https://github.com/y0ngha/siglens/commit/4b583b9274ed303143ca7a9c45157daca8463c23))
* Skill 도메인 타입 확장 (SkillCategory, keyPrices, timeRange) ([3605589](https://github.com/y0ngha/siglens/commit/360558994abfd15c2ed2def481a3c3deeb3ba5f1))
* Skills 통합 기능 테스트 및 도메인 명세 추가 ([bbd172d](https://github.com/y0ngha/siglens/commit/bbd172d7c94c4d8cd63c7bd205c45e230b2f3144))
* Stochastic RSI 인디케이터 구현 ([6afaea2](https://github.com/y0ngha/siglens/commit/6afaea23e0b1f5786397f81ca7504319d7f11a9a))
* Stochastic RSI 지표 상수 및 내보내기 추가 ([105cd2c](https://github.com/y0ngha/siglens/commit/105cd2ce81c69b0f327f08a28b5d53a565505b85))
* Stochastic RSI 차트 UI 및 훅 구현 ([27cfea0](https://github.com/y0ngha/siglens/commit/27cfea0b68a22444eba4c9da3a1334fdda2867a2))
* Stochastic RSI 타입 및 색상 추가 ([4dc3627](https://github.com/y0ngha/siglens/commit/4dc3627ce793234b45d4bfed5ceba44775633d7e))
* Stochastic 오실레이터 구현 ([da299cd](https://github.com/y0ngha/siglens/commit/da299cdb79852868bcd98df0b5092187cc55ca07))
* Stochastic 차트 UI 및 훅 구현 ([f102b1f](https://github.com/y0ngha/siglens/commit/f102b1ff718943ddda781f9dcd3892002a52b2e2))
* StockChart 컴포넌트 구현 ([#23](https://github.com/y0ngha/siglens/issues/23)) ([6b4fd37](https://github.com/y0ngha/siglens/commit/6b4fd3732cf1bbe7c7ead6ee81289c67b55e9100))
* TIMEFRAME_LOOKBACK_DAYS 상수 추가 ([32f05a0](https://github.com/y0ngha/siglens/commit/32f05a08ea1ee615ac9ff28403d4e6536c783a0b))
* useAnalysis 훅 캐시 지원 추가 ([6ca777d](https://github.com/y0ngha/siglens/commit/6ca777da9b681ae9cc3587c8192fa0ea9cacda49))
* useBollingerOverlay 커스텀 훅 구현 ([#26](https://github.com/y0ngha/siglens/issues/26)) ([473fa45](https://github.com/y0ngha/siglens/commit/473fa45fe3a068c59b05b9418852997b229ee13a))
* useBollingerOverlay 훅 사용 추가 ([df7f350](https://github.com/y0ngha/siglens/commit/df7f3504e002662bdc7ba63126f6658aa4190bcd))
* useMAOverlay / useEMAOverlay 커스텀 훅 구현 ([#25](https://github.com/y0ngha/siglens/issues/25)) ([0410aba](https://github.com/y0ngha/siglens/commit/0410abafad25d6571f36eaaf4c24237d9f47c7f6))
* Volume Profile (VP) 인디케이터 구현 ([f85b80d](https://github.com/y0ngha/siglens/commit/f85b80d8d554169bacdf0bfbdbdbd83d1d77c656))
* VolumeChart 컴포넌트 구현 ([#24](https://github.com/y0ngha/siglens/issues/24)) ([ddaaf50](https://github.com/y0ngha/siglens/commit/ddaaf50190a31a3eb2c7ecea89721156b6e3dc4e)), closes [#26a69a80](https://github.com/y0ngha/siglens/issues/26a69a80) [#ef535080](https://github.com/y0ngha/siglens/issues/ef535080)
* VP 오버레이 및 차트 컴포넌트 통합 ([b0ebf8c](https://github.com/y0ngha/siglens/commit/b0ebf8c0295461fba85070ab2f1bfeb9eb76e91f))
* VP 인디케이터 타입 및 상수 추가 ([f17f445](https://github.com/y0ngha/siglens/commit/f17f445d9395a5a91ead9f67252207af537acddb))
* VWAP 인디케이터 구현 ([#15](https://github.com/y0ngha/siglens/issues/15)) ([7ff6b3f](https://github.com/y0ngha/siglens/commit/7ff6b3f9505cfa942eb76aab62d263744d93df93))
* 개발환경에서는 캐시 사용 안하도록 처리 ([9bbaae9](https://github.com/y0ngha/siglens/commit/9bbaae9dbe6c4471ecc91c9fc6daaac7eb2fa1e1))
* 도메인 공통 타입 정의 ([#5](https://github.com/y0ngha/siglens/issues/5)) ([0cc8a4b](https://github.com/y0ngha/siglens/commit/0cc8a4b2944843e194db4e7027828db52310a498))
* 메인 페이지 구현 ([b1a4f2d](https://github.com/y0ngha/siglens/commit/b1a4f2d6dc05cbee4ae6424cc8b27cb645325bd0))
* 메인 페이지 구현 ([7896415](https://github.com/y0ngha/siglens/commit/789641527751478654f3127973d3030417ba1e9e))
* 메인 페이지 구현 ([2d954a5](https://github.com/y0ngha/siglens/commit/2d954a5bfe28f0a8c3958cd65e1c78df2aae7f94))
* 메인 페이지 리디자인 및 AI 브랜딩 변경 ([2489f01](https://github.com/y0ngha/siglens/commit/2489f01197293e2999b2926eb5e8472139e8f897))
* 미감지된 스킬(패턴) AI 분석 패널에서 숨기기 ([d33fd25](https://github.com/y0ngha/siglens/commit/d33fd257c3756f3ad4089f324fb5378d7ad7eb71))
* 보조지표 13종 시그널 해석 skills 파일 추가 ([db6567c](https://github.com/y0ngha/siglens/commit/db6567cfc5c9a7f2dbe87a05f45db105d2280c26))
* 보조지표 indicator skills 시스템 구현 ([94102a8](https://github.com/y0ngha/siglens/commit/94102a87c44633c3bda5ef6981a0ac7dec3e2dcb))
* 보조지표 show/hide 토글 UI 개선 및 훅 분리 ([3b8f717](https://github.com/y0ngha/siglens/commit/3b8f7178a6163118a7ddc0de57ecdd1aa0c7e15b))
* 보조지표 Show/Hide 토글 UI 구현 ([fdb96a2](https://github.com/y0ngha/siglens/commit/fdb96a2ebc5ae1332de7ab9165142f1974a2612c))
* 보조지표 레이블 표시 ([3d4eb96](https://github.com/y0ngha/siglens/commit/3d4eb965c4e408cd0aa223439886ba59b0d9688e))
* 보조지표 툴바 접기/펼치기 기능 구현 ([b863b83](https://github.com/y0ngha/siglens/commit/b863b8310af9c6b662833ce1cafc13e780382d12))
* 볼린저 밴드 인디케이터 구현 ([#13](https://github.com/y0ngha/siglens/issues/13)) ([2a19c06](https://github.com/y0ngha/siglens/commit/2a19c060a9d9e7d9158d879b73172003fd47abd0))
* 분석 prompt 진행시 이유와 가격 정렬해서 내보내도록 수정 ([3eee749](https://github.com/y0ngha/siglens/commit/3eee749a13cb04eb4dd0d7fa15f9ed430b167d82))
* 분석 응답에 신뢰도 가중치 추가 및 한국어 패턴명 적용 ([fae6cd5](https://github.com/y0ngha/siglens/commit/fae6cd5551a0fd4b654ebac55effd9d7c7b405f1))
* 분석 프롬프트에 keyPrices, timeRange 스키마 추가 ([c17da11](https://github.com/y0ngha/siglens/commit/c17da1165e7db7b7712ea3da6c2b12357b87197b))
* 신규 지표 및 Skills AI 프롬프트 통합 ([195895f](https://github.com/y0ngha/siglens/commit/195895fe5599391cb606d0e35cdfd8318cbcea6f))
* 신뢰도 배지 및 한국어 패턴명 표시 기능 구현 ([e5978e2](https://github.com/y0ngha/siglens/commit/e5978e22b066f975f60515917545cea1a5cb50af))
* 에러 상태 노출 및 훅 마운트 최적화 ([8814952](https://github.com/y0ngha/siglens/commit/8814952cd9065944663e25267ad8b3ca44b8daac))
* 엘리어트 파동이론 Skill 구현 ([8fd28a9](https://github.com/y0ngha/siglens/commit/8fd28a99475e22c5e187c8a330ad2905173e871f))
* 이동평균선 대순환 분석 Skill 작성 ([ceebeab](https://github.com/y0ngha/siglens/commit/ceebeab61d5da0b715c8f39e26da9798fe7a7db4))
* 인디케이터 통합 calculateIndicators 함수 구현 ([d10b765](https://github.com/y0ngha/siglens/commit/d10b76559bd5d27d22f270f7f72d9224a3c92b5b))
* 종목 검색 컴포넌트 구현 ([2909f5d](https://github.com/y0ngha/siglens/commit/2909f5de8ea233f9f54b6c5aaeb91cc11ef6aafe))
* 중첩 YAML 파싱 및 display 필드 지원 (FileSkillsLoader) ([b25adb0](https://github.com/y0ngha/siglens/commit/b25adb01cf7de1b0e3a7264da76ff7c85aac4476))
* 차트 시간축 포맷팅 및 ET 타임존 지원 추가 ([b389437](https://github.com/y0ngha/siglens/commit/b389437f8c25c4b912b25f95bd83a0e864187d8c))
* 차트 오버레이 범례 컴포넌트 및 유틸 구현 ([53790c3](https://github.com/y0ngha/siglens/commit/53790c3d006cb5c0c83c89335361c8e213460a06))
* 차트 컬러 상수 및 기간별 컬러 반환 함수 정의 ([95f1980](https://github.com/y0ngha/siglens/commit/95f1980213a03529ae0c428366537413068409ee)), closes [#8](https://github.com/y0ngha/siglens/issues/8)
* 차트 패턴 감지 시 주요 가격대 텍스트 표시 ([ad65f2c](https://github.com/y0ngha/siglens/commit/ad65f2cdeb54861097d63c7d5e8f1fbd175a2ca8))
* 차트에 핵심 레벨 오버레이 표시 기능 추가 ([2646373](https://github.com/y0ngha/siglens/commit/2646373c25773440cd625367022e78aac07e527d))
* 추세선 분석 도메인 로직 구현 ([61b0705](https://github.com/y0ngha/siglens/commit/61b07054d1ad4a9e0cddb9ff61aaff17d6978276))
* 추세선 차트 오버레이 및 UI 컴포넌트 구현 ([aff0a1b](https://github.com/y0ngha/siglens/commit/aff0a1b71d7e32d2f6e2a69cdd27756539d8dce2))
* 캔들 패턴 감지 및 AI 프롬프트 강화 ([2463db8](https://github.com/y0ngha/siglens/commit/2463db8b1c8a4abe8a1dce4aba5d4b73b2f52fb7))
* 캔들 패턴 감지 시 차트에 시각적 표시 추가 ([48391b1](https://github.com/y0ngha/siglens/commit/48391b1b5dfa2fbc59d9e340af4a44e2116e24af))
* 캔들 패턴 차트 시각적 표시 기능 구현 ([2279daa](https://github.com/y0ngha/siglens/commit/2279daacc40653e3b4e50865aff5714b9f2af8a5))
* 타임프레임 셀렉터 컴포넌트 구현 ([c901a1e](https://github.com/y0ngha/siglens/commit/c901a1e649032ad2061a17a82a7dbc11d37f7786))
* 패턴 감지 스텁 및 skills 파일 추가 ([#17](https://github.com/y0ngha/siglens/issues/17)) ([e87242a](https://github.com/y0ngha/siglens/commit/e87242aed53c77b324805d8cbf5de791c2ae5182))
* 패턴 감지 전문 구현 — 거래량·캔들스틱 분석 통합 ([fa1012a](https://github.com/y0ngha/siglens/commit/fa1012abf2491889f86a3b2665eac1380dc69a4d))
* 패턴 및 기술 분석 렌더링 설정 타입 추가 ([9b3947d](https://github.com/y0ngha/siglens/commit/9b3947d73ebf8fb3c17b85558261829e254bcd1f))
* 패턴 오버레이 렌더링 (usePatternOverlay 훅) ([d9f982e](https://github.com/y0ngha/siglens/commit/d9f982eae188da24527390f9cfb8e41a431c3981))
* 핵심 레벨 검증 로직 구현 ([3853b96](https://github.com/y0ngha/siglens/commit/3853b964bbca3201c5635892bf0710573cf3a771))


### Performance Improvements

* reduce 누산기에서 allStates 전체 배열 누적 제거 ([b946597](https://github.com/y0ngha/siglens/commit/b946597830e25feaf654d3d3275c0fb087efe11b))


### Reverts

* Revert "chore: fix-log.md 정리" ([9f46b2e](https://github.com/y0ngha/siglens/commit/9f46b2ea250e235ada82bb76ff0773af1868c656))
* Revert "chore: fix-log.md 정리" ([208f929](https://github.com/y0ngha/siglens/commit/208f9296ba000ff8b0ab0bab10049f1f7d04d5bd))
* prompt.test.ts 롤백 (사람 관여해서 잘못됨) ([b2d382c](https://github.com/y0ngha/siglens/commit/b2d382cab20fb2fc85bbf852fac4b74b51475afe))
