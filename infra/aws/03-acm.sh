#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
# 기존 인증서 있으면 재사용
CERT_ARN=$(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='siglens.io'].CertificateArn | [0]" --output text 2>/dev/null)
if [ "$CERT_ARN" = "None" ] || [ -z "$CERT_ARN" ]; then
  CERT_ARN=$(aws acm request-certificate --domain-name siglens.io \
    --subject-alternative-names beta.siglens.io www.siglens.io \
    --validation-method DNS --query CertificateArn --output text)
  log "cert requested"
  sleep 6
fi
grep -q '^export CERT_ARN=' "$(dirname "$0")/.ids" 2>/dev/null || echo "export CERT_ARN=$CERT_ARN" >> "$(dirname "$0")/.ids"
log "CERT_ARN=$CERT_ARN"
log "검증 CNAME (CloudFlare에 grey-cloud로 추가):"
aws acm describe-certificate --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[].{domain:DomainName,name:ResourceRecord.Name,value:ResourceRecord.Value}' \
  --output table
