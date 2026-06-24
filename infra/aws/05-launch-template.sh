#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
TAG="${1:?usage: 05-launch-template.sh <image-tag>}"
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameter.Value' --output text)
UD=$(sed "s/__IMAGE_TAG__/$TAG/" "$(dirname "$0")/user-data.sh" | base64)
LTDATA="{\"ImageId\":\"$AMI\",\"InstanceType\":\"$INSTANCE_TYPE\",\"IamInstanceProfile\":{\"Name\":\"$EC2_ROLE\"},\"SecurityGroupIds\":[\"$EC2_SG\"],\"BlockDeviceMappings\":[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}],\"UserData\":\"$UD\",\"TagSpecifications\":[{\"ResourceType\":\"instance\",\"Tags\":[{\"Key\":\"Name\",\"Value\":\"siglens\"}]}]}"
if aws ec2 describe-launch-templates --launch-template-names siglens-lt >/dev/null 2>&1; then
  aws ec2 create-launch-template-version --launch-template-name siglens-lt --version-description "$TAG" --launch-template-data "$LTDATA" --query 'LaunchTemplateVersion.VersionNumber' --output text
  aws ec2 modify-launch-template --launch-template-name siglens-lt --default-version '$Latest' >/dev/null
else
  aws ec2 create-launch-template --launch-template-name siglens-lt --version-description "$TAG" --launch-template-data "$LTDATA" >/dev/null
fi
log "launch template ready @ $TAG (AMI $AMI)"
