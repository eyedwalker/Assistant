#!/usr/bin/env node

// Upload comprehensive eyecare content to S3 Knowledge Base bucket
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class ContentUploader {
  constructor(bucketName) {
    this.bucketName = bucketName || 'eyecare-video-knowledge-130799455554';
    this.region = 'us-east-1';
    this.s3 = new S3Client({ region: this.region });
  }

  async uploadAllContent() {
    console.log(`🚀 Uploading comprehensive eyecare content to S3 bucket: ${this.bucketName}`);
    console.log('=' .repeat(70));

    const contentFiles = [
      {
        local: 'content/eyecare-fundamentals.txt',
        s3Key: 'training/eyecare-fundamentals/knowledge.txt',
        category: 'Fundamentals',
        type: 'Educational Material'
      },
      {
        local: 'content/contact-lens-management.txt', 
        s3Key: 'training/contact-lens-management/knowledge.txt',
        category: 'Contact Lenses',
        type: 'Training Material'
      },
      {
        local: 'content/eyefinity-practice-management.txt',
        s3Key: 'training/eyefinity-system/knowledge.txt', 
        category: 'Practice Management',
        type: 'Software Training'
      },
      {
        local: 'content/frame-dispensing-guide.txt',
        s3Key: 'training/frame-dispensing/knowledge.txt',
        category: 'Frame Dispensing', 
        type: 'Professional Training'
      },
      {
        local: 'content/vsp-insurance-processing.txt',
        s3Key: 'training/vsp-insurance/knowledge.txt',
        category: 'Insurance Processing',
        type: 'Insurance Training'  
      },
      {
        local: 'sample-video-knowledge.txt',
        s3Key: 'videos/PM-WN-1051/knowledge.txt',
        category: 'Patient Management',
        type: 'Video Training'
      }
    ];

    let successCount = 0;
    let totalFiles = contentFiles.length;

    for (const file of contentFiles) {
      try {
        await this.uploadFile(file);
        successCount++;
        console.log(`✅ Uploaded: ${file.s3Key}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.local}:`, error.message);
      }
    }

    console.log('=' .repeat(70));
    console.log(`📊 Upload Summary: ${successCount}/${totalFiles} files uploaded successfully`);
    
    // List uploaded content
    await this.listUploadedContent();
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Create Knowledge Base in AWS Console');
    console.log(`2. Point data source to: s3://${this.bucketName}/`);
    console.log('3. Set up auto-sync for real-time processing');
    console.log('4. Test with queries like "How do I fit contact lenses?" or "What is VSP processing?"');
  }

  async uploadFile(fileConfig) {
    const { local, s3Key, category, type } = fileConfig;
    
    if (!fs.existsSync(local)) {
      throw new Error(`Local file not found: ${local}`);
    }

    const content = fs.readFileSync(local, 'utf8');
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: 'text/plain',
      Metadata: {
        category: category,
        contentType: type,
        uploadedAt: new Date().toISOString(),
        source: 'eyecare-ai-training-content'
      }
    };

    await this.s3.send(new PutObjectCommand(uploadParams));
  }

  async listUploadedContent() {
    try {
      console.log('\n📋 Uploaded Content Structure:');
      console.log('-' .repeat(50));
      
      const response = await this.s3.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: ''
      }));

      if (response.Contents && response.Contents.length > 0) {
        response.Contents.forEach(obj => {
          const size = (obj.Size / 1024).toFixed(1);
          console.log(`📄 ${obj.Key} (${size} KB)`);
        });
        
        console.log(`\n📈 Total: ${response.Contents.length} files, ${(response.Contents.reduce((sum, obj) => sum + obj.Size, 0) / 1024).toFixed(1)} KB`);
      } else {
        console.log('No files found in bucket');
      }
    } catch (error) {
      console.error('Error listing bucket contents:', error.message);
    }
  }
}

// Command line usage
if (require.main === module) {
  const bucketName = process.argv[2];
  
  if (!bucketName) {
    console.log('Usage: node upload-content-to-s3.js <bucket-name>');
    console.log('Example: node upload-content-to-s3.js eyecare-video-knowledge-130799455554');
    process.exit(1);
  }

  const uploader = new ContentUploader(bucketName);
  uploader.uploadAllContent().catch(error => {
    console.error('Upload failed:', error);
    process.exit(1);
  });
}

module.exports = { ContentUploader };
