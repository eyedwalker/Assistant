#!/bin/bash
# Create AWS OpenSearch domain for AI Assistant RAG functionality

DOMAIN_NAME="ai-assistant-rag"
REGION="us-east-1"
INSTANCE_TYPE="t3.small.search"
INSTANCE_COUNT=1
VOLUME_SIZE=20

echo "Creating OpenSearch domain: $DOMAIN_NAME"
echo "Region: $REGION"
echo "Instance Type: $INSTANCE_TYPE"
echo "Volume Size: ${VOLUME_SIZE}GB"

aws opensearch create-domain \
  --domain-name $DOMAIN_NAME \
  --engine-version "OpenSearch_2.3" \
  --cluster-config InstanceType=$INSTANCE_TYPE,InstanceCount=$INSTANCE_COUNT \
  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=$VOLUME_SIZE \
  --access-policies '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "*"
        },
        "Action": "es:*",
        "Resource": "arn:aws:es:us-east-1:*:domain/'$DOMAIN_NAME'/*",
        "Condition": {
          "IpAddress": {
            "aws:SourceIp": "0.0.0.0/0"
          }
        }
      }
    ]
  }' \
  --profile 130799455554_VSPPowerUserNonprod \
  --region $REGION

echo "OpenSearch domain creation initiated. This will take 10-15 minutes."
echo "Check status with: aws opensearch describe-domain --domain-name $DOMAIN_NAME --profile 130799455554_VSPPowerUserNonprod"
