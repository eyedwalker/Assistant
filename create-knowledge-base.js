#!/usr/bin/env node

// Automated AWS Knowledge Base Creation Script
// Handles the complete setup process with error handling

const { 
  BedrockAgentClient, 
  CreateKnowledgeBaseCommand,
  CreateDataSourceCommand,
  GetKnowledgeBaseCommand,
  StartIngestionJobCommand
} = require('@aws-sdk/client-bedrock-agent');

const { 
  OpenSearchServerlessClient,
  CreateCollectionCommand,
  CreateSecurityPolicyCommand,
  CreateAccessPolicyCommand
} = require('@aws-sdk/client-opensearchserverless');

const { S3Client, PutObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');
const fs = require('fs');
const path = require('path');

class KnowledgeBaseCreator {
  constructor() {
    this.region = 'us-east-1';
    this.accountId = '130799455554';
    this.bucketName = 'eyecare-video-knowledge-130799455554';
    this.collectionName = 'eyecare-knowledge-collection';
    this.knowledgeBaseName = 'EyecareVideoKnowledgeBase';
    
    // Initialize AWS clients
    this.bedrockAgent = new BedrockAgentClient({ region: this.region });
    this.opensearch = new OpenSearchServerlessClient({ region: this.region });
    this.s3 = new S3Client({ region: this.region });
    this.iam = new IAMClient({ region: this.region });
  }

  async createKnowledgeBase() {
    console.log('🚀 Starting AWS Knowledge Base creation...\n');

    try {
      // Step 1: Verify S3 bucket
      await this.verifyS3Bucket();
      
      // Step 2: Create IAM roles
      const serviceRole = await this.createServiceRole();
      
      // Step 3: Create OpenSearch Serverless collection
      const collectionArn = await this.createOpenSearchCollection();
      
      // Step 4: Create Knowledge Base
      const knowledgeBase = await this.createKnowledgeBaseResource(serviceRole, collectionArn);
      
      // Step 5: Create Data Source
      const dataSource = await this.createDataSource(knowledgeBase.knowledgeBaseId);
      
      // Step 6: Upload sample content
      await this.uploadSampleContent();
      
      // Step 7: Start ingestion
      await this.startIngestion(knowledgeBase.knowledgeBaseId, dataSource.dataSourceId);
      
      // Step 8: Output configuration
      this.outputConfiguration(knowledgeBase, dataSource);
      
      console.log('\n✅ Knowledge Base creation completed successfully!');
      
    } catch (error) {
      console.error('❌ Knowledge Base creation failed:', error.message);
      console.error('Full error:', error);
      process.exit(1);
    }
  }

  async verifyS3Bucket() {
    console.log('📦 Verifying S3 bucket...');
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      console.log(`✅ S3 bucket verified: ${this.bucketName}`);
    } catch (error) {
      throw new Error(`S3 bucket not found: ${this.bucketName}. Please create it first.`);
    }
  }

  async createServiceRole() {
    console.log('🔐 Creating IAM service role...');
    
    const roleName = 'AmazonBedrockExecutionRoleForKnowledgeBase_EyecareVideos';
    
    try {
      // Check if role exists
      await this.iam.send(new GetRoleCommand({ RoleName: roleName }));
      console.log(`✅ Using existing role: ${roleName}`);
      return `arn:aws:iam::${this.accountId}:role/${roleName}`;
    } catch (error) {
      // Role doesn't exist, create it
    }

    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'bedrock.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }
      ]
    };

    try {
      await this.iam.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: 'Service role for Bedrock Knowledge Base - Eyecare Videos'
      }));

      // Attach required policies
      const policies = [
        'arn:aws:iam::aws:policy/AmazonBedrockFullAccess',
        'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'
      ];

      for (const policy of policies) {
        await this.iam.send(new AttachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policy
        }));
      }

      console.log(`✅ Created IAM role: ${roleName}`);
      return `arn:aws:iam::${this.accountId}:role/${roleName}`;
      
    } catch (error) {
      throw new Error(`Failed to create IAM role: ${error.message}`);
    }
  }

  async createOpenSearchCollection() {
    console.log('🔍 Creating OpenSearch Serverless collection...');

    try {
      // Create security policy
      const securityPolicyName = 'eyecare-knowledge-security-policy';
      await this.opensearch.send(new CreateSecurityPolicyCommand({
        name: securityPolicyName,
        type: 'encryption',
        policy: JSON.stringify([{
          Rules: [{ Resource: [`collection/${this.collectionName}`], ResourceType: 'collection' }],
          AWSOwnedKey: true
        }])
      }));

      // Create network policy
      const networkPolicyName = 'eyecare-knowledge-network-policy';
      await this.opensearch.send(new CreateSecurityPolicyCommand({
        name: networkPolicyName,
        type: 'network',
        policy: JSON.stringify([{
          Rules: [{ Resource: [`collection/${this.collectionName}`], ResourceType: 'collection' }],
          AllowFromPublic: true
        }])
      }));

      // Create collection
      const collection = await this.opensearch.send(new CreateCollectionCommand({
        name: this.collectionName,
        type: 'VECTORSEARCH',
        description: 'Vector search collection for eyecare video knowledge'
      }));

      // Create access policy
      const accessPolicyName = 'eyecare-knowledge-access-policy';
      await this.opensearch.send(new CreateAccessPolicyCommand({
        name: accessPolicyName,
        type: 'data',
        policy: JSON.stringify([{
          Rules: [
            {
              Resource: [`collection/${this.collectionName}`],
              Permission: ['aoss:*'],
              ResourceType: 'collection'
            },
            {
              Resource: [`index/${this.collectionName}/*`],
              Permission: ['aoss:*'],
              ResourceType: 'index'
            }
          ],
          Principal: [`arn:aws:iam::${this.accountId}:root`]
        }])
      }));

      console.log(`✅ Created OpenSearch collection: ${this.collectionName}`);
      return collection.createCollectionDetail.arn;
      
    } catch (error) {
      if (error.name === 'ConflictException') {
        console.log(`✅ Using existing OpenSearch collection: ${this.collectionName}`);
        return `arn:aws:aoss:${this.region}:${this.accountId}:collection/${this.collectionName}`;
      }
      throw new Error(`Failed to create OpenSearch collection: ${error.message}`);
    }
  }

  async createKnowledgeBaseResource(serviceRoleArn, collectionArn) {
    console.log('🧠 Creating Knowledge Base...');

    const params = {
      name: this.knowledgeBaseName,
      description: 'Knowledge base for eyecare training videos and documentation',
      roleArn: serviceRoleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 1536
            }
          }
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collectionArn,
          vectorIndexName: 'eyecare-knowledge-index',
          fieldMapping: {
            vectorField: 'eyecare_vector',
            textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
            metadataField: 'AMAZON_BEDROCK_METADATA'
          }
        }
      }
    };

    try {
      const result = await this.bedrockAgent.send(new CreateKnowledgeBaseCommand(params));
      console.log(`✅ Created Knowledge Base: ${result.knowledgeBase.knowledgeBaseId}`);
      return result.knowledgeBase;
    } catch (error) {
      throw new Error(`Failed to create Knowledge Base: ${error.message}`);
    }
  }

  async createDataSource(knowledgeBaseId) {
    console.log('📊 Creating Data Source...');

    const params = {
      knowledgeBaseId: knowledgeBaseId,
      name: 'EyecareS3DataSource',
      description: 'S3 data source for eyecare video knowledge',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: `arn:aws:s3:::${this.bucketName}`,
          inclusionPrefixes: ['videos/']
        }
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 1000,
            overlapPercentage: 20
          }
        }
      }
    };

    try {
      const result = await this.bedrockAgent.send(new CreateDataSourceCommand(params));
      console.log(`✅ Created Data Source: ${result.dataSource.dataSourceId}`);
      return result.dataSource;
    } catch (error) {
      throw new Error(`Failed to create Data Source: ${error.message}`);
    }
  }

  async uploadSampleContent() {
    console.log('📤 Uploading sample content to S3...');

    const sampleFilePath = path.join(__dirname, 'sample-video-knowledge.txt');
    
    if (!fs.existsSync(sampleFilePath)) {
      console.log('⚠️  Sample file not found, skipping upload');
      return;
    }

    const content = fs.readFileSync(sampleFilePath, 'utf8');
    const key = 'videos/PM-WN-1051/knowledge.txt';

    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: 'text/plain',
        Metadata: {
          videoId: 'PM-WN-1051',
          title: 'Patient Management Training',
          category: 'Training',
          uploadedAt: new Date().toISOString()
        }
      }));

      console.log(`✅ Uploaded sample content: s3://${this.bucketName}/${key}`);
    } catch (error) {
      console.log(`⚠️  Failed to upload sample content: ${error.message}`);
    }
  }

  async startIngestion(knowledgeBaseId, dataSourceId) {
    console.log('🔄 Starting ingestion job...');

    try {
      const result = await this.bedrockAgent.send(new StartIngestionJobCommand({
        knowledgeBaseId: knowledgeBaseId,
        dataSourceId: dataSourceId,
        description: 'Initial ingestion of eyecare video knowledge'
      }));

      console.log(`✅ Started ingestion job: ${result.ingestionJob.ingestionJobId}`);
    } catch (error) {
      console.log(`⚠️  Failed to start ingestion: ${error.message}`);
    }
  }

  outputConfiguration(knowledgeBase, dataSource) {
    console.log('\n📋 CONFIGURATION FOR .env FILE:');
    console.log('=' .repeat(50));
    console.log(`AWS_KNOWLEDGE_BASE_ID=${knowledgeBase.knowledgeBaseId}`);
    console.log(`AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID=${dataSource.dataSourceId}`);
    console.log(`AWS_S3_KNOWLEDGE_BUCKET=${this.bucketName}`);
    console.log(`AWS_REGION=${this.region}`);
    console.log('=' .repeat(50));
    
    // Write to a config file
    const configContent = `# AWS Knowledge Base Configuration
# Generated on ${new Date().toISOString()}

AWS_KNOWLEDGE_BASE_ID=${knowledgeBase.knowledgeBaseId}
AWS_KNOWLEDGE_BASE_DATA_SOURCE_ID=${dataSource.dataSourceId}
AWS_S3_KNOWLEDGE_BUCKET=${this.bucketName}
AWS_REGION=${this.region}

# Add these to your .env file
`;

    fs.writeFileSync('.knowledge-base-config', configContent);
    console.log('\n💾 Configuration saved to .knowledge-base-config');
  }
}

// Run the script
if (require.main === module) {
  const creator = new KnowledgeBaseCreator();
  creator.createKnowledgeBase();
}

module.exports = { KnowledgeBaseCreator };
