/**
 * S3Accessor - VBD Accessor Layer
 * 
 * Handles all AWS S3 storage operations - stable, technology-specific
 * Provides clean interface for file storage with no business logic
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface S3DownloadResult {
  success: boolean;
  content?: string;
  contentType?: string;
  error?: string;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

export class S3Accessor {
  private s3Client: S3Client;

  constructor(
    private bucketName: string,
    private region: string = 'us-west-2'
  ) {
    // Use credentials from environment - supports both permanent and temporary credentials
    const credentials: any = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    };
    
    // Add session token if available (for temporary credentials)
    if (process.env.AWS_SESSION_TOKEN) {
      credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials
    });
  }

  /**
   * Upload content to S3
   */
  async uploadContent(key: string, content: string, contentType: string = 'text/plain'): Promise<S3UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      });

      await this.s3Client.send(command);

      return {
        success: true,
        key,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown S3 upload error'
      };
    }
  }

  /**
   * Upload file buffer to S3
   */
  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<S3UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      });

      await this.s3Client.send(command);

      return {
        success: true,
        key,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown S3 upload error'
      };
    }
  }

  /**
   * Download content from S3
   */
  async downloadContent(key: string): Promise<S3DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      const content = await response.Body?.transformToString();

      return {
        success: true,
        content,
        contentType: response.ContentType
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown S3 download error'
      };
    }
  }

  /**
   * Get presigned URL for secure access
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      return null;
    }
  }

  /**
   * Get presigned upload URL
   */
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned upload URL:', error);
      return null;
    }
  }

  /**
   * Delete object from S3
   */
  async deleteObject(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Failed to delete S3 object:', error);
      return false;
    }
  }

  /**
   * Delete file from S3 (alias for deleteObject for compatibility)
   */
  async deleteFile(key: string): Promise<boolean> {
    return await this.deleteObject(key);
  }

  /**
   * Check if object exists
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get object metadata
   */
  async getObjectInfo(key: string): Promise<S3ObjectInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List objects with prefix
   */
  async listObjects(prefix: string, maxKeys: number = 1000): Promise<S3ObjectInfo[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const response = await this.s3Client.send(command);
      
      return (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        contentType: undefined // Not available in list operation
      }));
    } catch (error) {
      console.error('Failed to list S3 objects:', error);
      return [];
    }
  }

  /**
   * Get total storage usage for a prefix (tenant)
   */
  async getStorageUsage(prefix: string): Promise<{ totalSize: number; objectCount: number }> {
    try {
      const objects = await this.listObjects(prefix);
      
      return {
        totalSize: objects.reduce((sum, obj) => sum + obj.size, 0),
        objectCount: objects.length
      };
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      return { totalSize: 0, objectCount: 0 };
    }
  }

  /**
   * Copy object to new location
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        Key: destinationKey,
        CopySource: `${this.bucketName}/${sourceKey}`,
        ServerSideEncryption: 'AES256'
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Failed to copy S3 object:', error);
      return false;
    }
  }

  /**
   * Batch delete objects
   */
  async deleteObjects(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    // Process in batches of 1000 (S3 limit)
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      for (const key of batch) {
        const success = await this.deleteObject(key);
        if (success) {
          deleted.push(key);
        } else {
          failed.push(key);
        }
      }
    }

    return { deleted, failed };
  }

  /**
   * Generate unique key with tenant prefix
   */
  generateKey(tenantId: string, category: string, filename?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const extension = filename ? filename.split('.').pop() : 'txt';
    
    return `${tenantId}/${category}/${timestamp}-${random}.${extension}`;
  }

  /**
   * Validate key format for security
   */
  isValidKey(key: string): boolean {
    // Prevent path traversal and ensure proper format
    const validKeyPattern = /^[a-zA-Z0-9\-_\/\.]+$/;
    return validKeyPattern.test(key) && !key.includes('..') && !key.startsWith('/');
  }
}
