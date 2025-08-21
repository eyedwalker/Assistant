# AWS Bedrock Security & Governance Strategy

## 🔐 AWS Bedrock Overview
AWS Bedrock provides enterprise-grade security for AI/LLM operations with built-in governance, compliance, and control features.


```

### **With AWS Bedrock**
```javascript
// Bedrock with full security controls
const response = await bedrockClient.invokeModel({
  modelId: 'anthropic.claude-3-sonnet',
  contentType: 'application/json',
  body: JSON.stringify({
    messages: [{ role: 'user', content: userInput }],
    guardrails: { id: 'healthcare-guardrail' }
  })
});
```

## 🛡️ Security Features

### **1. Model Access Control**
```typescript
// IAM policy for model access
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::123456:role/AIAssistantRole" },
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:*:*:model/anthropic.claude-3*",
    "Condition": {
      "StringEquals": {
        "bedrock:GuardrailId": "healthcare-guardrail"
      }
    }
  }]
}
```

### **2. Guardrails for Healthcare**
```javascript
// Create healthcare-specific guardrail
const guardrail = await bedrock.createGuardrail({
  name: 'healthcare-phi-protection',
  description: 'Protects PHI and ensures HIPAA compliance',
  
  // Content filters
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SENSITIVE_INFORMATION',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH'
      }
    ]
  },
  
  // Sensitive information filters
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'SSN', action: 'BLOCK' },
      { type: 'MEDICAL_RECORD_NUMBER', action: 'BLOCK' },
      { type: 'HEALTH_INSURANCE_ID', action: 'ANONYMIZE' },
      { type: 'PATIENT_NAME', action: 'ANONYMIZE' }
    ],
    regexesConfig: [
      {
        name: 'MedicalRecordPattern',
        pattern: 'MRN[0-9]{6,12}',
        action: 'BLOCK'
      }
    ]
  },
  
  // Topic filters
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'MedicalDiagnosis',
        definition: 'Prevent AI from making medical diagnoses',
        examples: ['You have diabetes', 'This indicates cancer'],
        type: 'DENY'
      }
    ]
  }
});
```

### **3. Data Residency & Encryption**
```javascript
// Configure data residency
const bedrockConfig = {
  region: 'us-east-1', // HIPAA-compliant region
  encryption: {
    kmsKeyId: 'arn:aws:kms:us-east-1:123456:key/abc-def',
    encryptionInTransit: true,
    encryptionAtRest: true
  },
  dataResidency: {
    enforceUSOnly: true,
    blockCrossRegionAccess: true
  }
};
```

## 📊 Audit & Compliance

### **1. CloudTrail Integration**
```javascript
// All Bedrock API calls are automatically logged
{
  "eventName": "InvokeModel",
  "userIdentity": {
    "principalId": "AIDAI23HXD2O5V6EXAMPLE",
    "accountId": "123456789012"
  },
  "requestParameters": {
    "modelId": "anthropic.claude-3-sonnet",
    "guardrailId": "healthcare-guardrail"
  },
  "responseElements": {
    "tokenCount": 245,
    "guardrailIntervention": false
  }
}
```

### **2. Model Usage Analytics**
```javascript
// Track usage per tenant/user
const usageMetrics = await cloudWatch.getMetricStatistics({
  Namespace: 'AWS/Bedrock',
  MetricName: 'ModelInvocations',
  Dimensions: [
    { Name: 'TenantId', Value: tenantId },
    { Name: 'UserId', Value: userId }
  ],
  StartTime: startDate,
  EndTime: endDate,
  Statistics: ['Sum', 'Average']
});
```

### **3. Cost Controls**
```javascript
// Set spending limits per tenant
const budget = await budgets.createBudget({
  Budget: {
    BudgetName: `bedrock-tenant-${tenantId}`,
    BudgetLimit: { Amount: '1000', Unit: 'USD' },
    BudgetType: 'COST',
    CostFilters: {
      Service: ['Amazon Bedrock'],
      TagKeyValue: [`tenant:${tenantId}`]
    }
  },
  NotificationsWithSubscribers: [{
    Notification: {
      NotificationType: 'ACTUAL',
      ComparisonOperator: 'GREATER_THAN',
      Threshold: 80
    }
  }]
});
```

## 🏥 Healthcare-Specific Controls

### **1. PHI Detection & Handling**
```javascript
class BedrockHealthcareClient {
  async processWithPHIProtection(input: string) {
    // Pre-process: Detect and mask PHI
    const phiDetection = await comprehendMedical.detectPHI({
      Text: input
    });
    
    const maskedInput = this.maskPHI(input, phiDetection.Entities);
    
    // Process with Bedrock
    const response = await bedrock.invokeModel({
      modelId: 'anthropic.claude-3-sonnet',
      body: {
        messages: [{ content: maskedInput }],
        guardrails: { id: 'healthcare-guardrail' }
      }
    });
    
    // Audit log
    await this.auditLog({
      action: 'PHI_PROCESSED',
      phiDetected: phiDetection.Entities.length > 0,
      userId,
      timestamp: new Date()
    });
    
    return response;
  }
}
```

### **2. Role-Based Model Access**
```javascript
// Different models for different roles
const modelAccessPolicy = {
  'admin': ['anthropic.claude-3-opus', 'anthropic.claude-3-sonnet'],
  'doctor': ['anthropic.claude-3-sonnet', 'ai21.j2-ultra'],
  'staff': ['anthropic.claude-3-haiku'],
  'patient': ['anthropic.claude-instant']
};

async function getModelForUser(userRole: string) {
  const allowedModels = modelAccessPolicy[userRole];
  if (!allowedModels) throw new Error('Unauthorized');
  
  // Return most appropriate model based on task
  return allowedModels[0];
}
```

## 🔄 Migration from Direct Anthropic

### **Step 1: Update AnthropicAccessor**
```typescript
// lib/accessors/BedrockAccessor.ts
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';

export class BedrockAccessor {
  private client: BedrockRuntime;
  private guardrailId: string;
  
  constructor() {
    this.client = new BedrockRuntime({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
    this.guardrailId = process.env.BEDROCK_GUARDRAIL_ID!;
  }
  
  async generateChatResponse(
    message: string, 
    context: string,
    userId: string,
    tenantId: string
  ): Promise<ChatResponse> {
    // Add tenant/user tags for tracking
    const response = await this.client.invokeModel({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        messages: [{
          role: 'user',
          content: `Context: ${context}\n\nQuestion: ${message}`
        }],
        max_tokens: 1000,
        temperature: 0.7,
        system: 'You are an AI assistant for eyecare professionals.'
      }),
      guardrailIdentifier: this.guardrailId,
      guardrailVersion: 'DRAFT',
      trace: {
        enabled: true,
        tags: {
          userId,
          tenantId,
          application: 'ai-assistant'
        }
      }
    });
    
    const result = JSON.parse(new TextDecoder().decode(response.body));
    
    // Log usage for compliance
    await this.logUsage({
      userId,
      tenantId,
      tokens: result.usage.total_tokens,
      model: 'claude-3-sonnet',
      timestamp: new Date()
    });
    
    return {
      message: result.content[0].text,
      confidence: 0.95,
      sources: []
    };
  }
}
```

### **Step 2: Environment Variables**
```bash
# Remove
ANTHROPIC_API_KEY=sk-ant-...

# Add
AWS_BEDROCK_REGION=us-east-1
BEDROCK_GUARDRAIL_ID=healthcare-guardrail-v1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_KMS_KEY_ID=arn:aws:kms:us-east-1:123456:key/...
```

## 💰 Cost Comparison

### **Direct Anthropic API**
- Claude 3 Opus: $15/$75 per million tokens (input/output)
- Claude 3 Sonnet: $3/$15 per million tokens
- No built-in security features
- Manual compliance implementation

### **AWS Bedrock**
- Claude 3 Opus: $15/$75 per million tokens (same pricing)
- Claude 3 Sonnet: $3/$15 per million tokens (same pricing)
- **Additional Benefits**:
  - Built-in guardrails (no extra cost)
  - CloudTrail logging (included)
  - IAM integration (included)
  - KMS encryption (minimal cost)
  - CloudWatch metrics (minimal cost)

**Total Additional Cost**: ~$10-20/month for security features

## ✅ Key Benefits for Healthcare

1. **HIPAA Compliance**
   - BAA available from AWS
   - Automatic PHI detection and masking
   - Audit trails for all AI interactions

2. **Multi-Tenant Isolation**
   - IAM policies per tenant
   - Usage tracking per tenant
   - Cost allocation per tenant

3. **Governance & Control**
   - Prevent medical diagnosis generation
   - Block inappropriate content
   - Control model access by role

4. **Audit & Compliance**
   - Complete audit trail in CloudTrail
   - Usage analytics in CloudWatch
   - Cost tracking in Cost Explorer

5. **Data Security**
   - Encryption with KMS
   - Data residency controls
   - Private endpoint options

## 🚀 Implementation Timeline

### **Week 1: Setup**
- Create Bedrock guardrails
- Configure IAM policies
- Set up CloudTrail logging

### **Week 2: Integration**
- Update BedrockAccessor class
- Test guardrail effectiveness
- Implement usage tracking

### **Week 3: Migration**
- Parallel run with Anthropic
- Compare outputs and costs
- Fine-tune guardrails

### **Week 4: Cutover**
- Switch to Bedrock-only
- Monitor performance
- Document compliance

## 🎯 Recommendation

**Immediate Implementation** - AWS Bedrock provides:
1. Same AI models (Claude) at same price
2. Enterprise security at minimal additional cost
3. HIPAA compliance out-of-the-box
4. Complete audit trail for regulations
5. Protection against PHI leakage

This is a **critical upgrade** for healthcare applications handling sensitive data.
