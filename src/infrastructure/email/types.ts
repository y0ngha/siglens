// EmailMessage / EmailDispatcher / SendEmailOptions 의 정식 정의는 siglens-core가 가진다.
// consumer 측에서는 코어 export를 그대로 re-export하여 import 경로의 단일성을 유지한다.
export type { EmailDispatcher, EmailMessage } from '@y0ngha/siglens-core';
