import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AccessLevel } from '@/types';

class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }

    if (!process.env.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME environment variable not set');
    }

    this.bucketName = process.env.S3_BUCKET_NAME;
    
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Generate S3 key with access level prefix for security
   */
  private generateS3Key(
    fileName: string, 
    accessLevel: AccessLevel, 
    accessId: string,
    fileType: string = 'document'
  ): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `${accessLevel}/${accessId}/${fileType}/${timestamp}_${sanitizedFileName}`;
  }

  /**
   * Upload file content to S3
   */
  async uploadFile(
    content: Buffer | string,
    fileName: string,
    contentType: string,
    accessLevel: AccessLevel,
    accessId: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    try {
      const s3Key = this.generateS3Key(fileName, accessLevel, accessId);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: content,
        ContentType: contentType,
        Metadata: {
          ...metadata,
          accessLevel,
          accessId,
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      });

      await this.client.send(command);
      return s3Key;
    } catch (error) {
      console.error('Failed to upload file to S3:', error);
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload screenshot to S3
   */
  async uploadScreenshot(
    imageBuffer: Buffer,
    documentId: string,
    accessLevel: AccessLevel,
    accessId: string
  ): Promise<string> {
    const fileName = `${documentId}_screenshot.png`;
    return this.uploadFile(
      imageBuffer,
      fileName,
      'image/png',
      accessLevel,
      accessId,
      { documentId, type: 'screenshot' }
    );
  }

  /**
   * Get file from S3
   */
  async getFile(s3Key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('File not found or empty');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to get file from S3:', error);
      throw new Error(`S3 download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file as text content
   */
  async getFileAsText(s3Key: string): Promise<string> {
    const buffer = await this.getFile(s3Key);
    return buffer.toString('utf-8');
  }

  /**
   * Generate presigned URL for file access
   */
  async getPresignedUrl(
    s3Key: string, 
    expiresIn: number = 3600,
    operation: 'get' | 'put' = 'get'
  ): Promise<string> {
    try {
      const command = operation === 'get' 
        ? new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key })
        : new PutObjectCommand({ Bucket: this.bucketName, Key: s3Key });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error(`Presigned URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Failed to delete file from S3:', error);
      return false;
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(s3Key: string): Promise<Record<string, any> | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.client.send(command);
      
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
        etag: response.ETag,
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(
    prefix: string,
    maxKeys: number = 1000
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      
      return (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    } catch (error) {
      console.error('Failed to list files from S3:', error);
      throw new Error(`S3 list failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage usage for access level
   */
  async getStorageUsage(accessLevel: AccessLevel, accessId: string): Promise<number> {
    try {
      const prefix = `${accessLevel}/${accessId}/`;
      const files = await this.listFiles(prefix);
      
      return files.reduce((total, file) => total + file.size, 0);
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return 0;
    }
  }

  /**
   * Validate access to S3 key based on user permissions
   */
  validateAccess(
    s3Key: string,
    userAccessLevel: AccessLevel,
    userAccessId: string
  ): boolean {
    const keyParts = s3Key.split('/');
    
    if (keyParts.length < 2) {
      return false;
    }

    const fileAccessLevel = keyParts[0] as AccessLevel;
    const fileAccessId = keyParts[1];

    // Public files are accessible to everyone
    if (fileAccessLevel === AccessLevel.PUBLIC) {
      return true;
    }

    // Check if user has access to this specific resource
    return fileAccessLevel === userAccessLevel && fileAccessId === userAccessId;
  }

  /**
   * Health check for S3 service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 health check failed:', error);
      return false;
    }
  }

  /**
   * Clean up old files (for maintenance)
   */
  async cleanupOldFiles(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const allFiles = await this.listFiles('');
      const oldFiles = allFiles.filter(file => file.lastModified < cutoffDate);

      let deletedCount = 0;
      for (const file of oldFiles) {
        const success = await this.deleteFile(file.key);
        if (success) {
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old files from S3`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();
export default s3Service;
