/**
 * Bulk Training Ingestion API
 * Processes multiple URLs to train the AI on comprehensive Eyefinity content
 */

import { NextRequest, NextResponse } from 'next/server';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';

// Comprehensive Eyefinity training URLs
const EYEFINITY_TRAINING_URLS = [
  // Core Administration
  'https://help.eyefinity.com/epm/Content/HowCanWeHelp.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/NavigatingFO.htm',
  'https://help.eyefinity.com/epm/Content/Administration/NavigatingAdmin.htm',
  
  // Patient Management
  'https://help.eyefinity.com/epm/Content/FrontOffice/Patients/AddingPatients.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Patients/EditingPatients.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Patients/PatientSearch.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Patients/PatientRecords.htm',
  
  // Scheduling & Appointments
  'https://help.eyefinity.com/epm/Content/FrontOffice/Scheduling/SchedulingOverview.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Scheduling/AddingAppointments.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Scheduling/EditingAppointments.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Scheduling/AppointmentTypes.htm',
  
  // Billing & Claims
  'https://help.eyefinity.com/epm/Content/FrontOffice/Billing/BillingOverview.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Billing/InsuranceClaims.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Billing/PaymentProcessing.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Billing/StatementGeneration.htm',
  
  // Inventory Management
  'https://help.eyefinity.com/epm/Content/FrontOffice/Inventory/InventoryOverview.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Inventory/FrameManagement.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Inventory/LensManagement.htm',
  'https://help.eyefinity.com/epm/Content/FrontOffice/Inventory/OrderManagement.htm',
  
  // Reports & Analytics
  'https://help.eyefinity.com/epm/Content/Administration/Reports/ReportsOverview.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Reports/FinancialReports.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Reports/PatientReports.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Reports/InventoryReports.htm',
  
  // System Administration
  'https://help.eyefinity.com/epm/Content/Administration/Users/UserManagement.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Settings/SystemSettings.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Security/SecuritySettings.htm',
  'https://help.eyefinity.com/epm/Content/Administration/Backup/BackupProcedures.htm'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      urls = EYEFINITY_TRAINING_URLS,
      userId = 'training-admin',
      tenantId = 'demo-tenant',
      batchSize = 5,
      delayMs = 2000
    } = body;

    console.log(`🚀 Starting bulk training ingestion for ${urls.length} URLs`);

    // Initialize managers
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'eyecare-ai'
    );
    
    // Connect to MongoDB
    await mongoAccessor.connect();
    
    const anthropicAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY || ''
    );
    
    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );
    
    const documentManager = new DocumentManager(mongoAccessor, s3Accessor, anthropicAccessor);
    
    // Ensure the user exists
    const existingUsers = await mongoAccessor.find('users', { userId });
    if (!existingUsers || existingUsers.length === 0) {
      await mongoAccessor.create('users', {
        userId,
        tenantId,
        email: `${userId}@eyecare.com`,
        name: userId === 'training-admin' ? 'Training Admin' : userId,
        role: 'admin',
        permissions: ['chat', 'upload', 'analyze'],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Created user: ${userId}`);
    }

    const results = {
      total: urls.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as Array<{url: string; error: string}>,
      processedUrls: [] as Array<{url: string; status: string; jobId?: string; error?: string}>
    };

    // Process URLs in batches to avoid overwhelming the system
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(urls.length/batchSize)}`);

      const batchPromises = batch.map(async (url: string) => {
        try {
          console.log(`🔄 Processing: ${url}`);
          
          const job = await documentManager.processDocument({
            url: url,
            userId,
            tenantId,
            accessLevel: 'COMPANY',
            metadata: {
              source: 'bulk-training',
              title: url.split('/').pop() || 'unknown',
              tags: ['eyefinity-help', 'training-data']
            }
          });

          results.successful++;
          results.processedUrls.push({
            url,
            status: 'success',
            jobId: job.jobId
          });

          console.log(`✅ Successfully processed: ${url}`);
        } catch (error) {
          console.error(`❌ Failed to process ${url}:`, error);
          results.failed++;
          results.errors.push({
            url,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          results.processedUrls.push({
            url,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        
        results.processed++;
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Add delay between batches
      if (i + batchSize < urls.length) {
        console.log(`⏱️ Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`🎉 Bulk training completed: ${results.successful}/${results.total} successful`);

    // Disconnect from MongoDB
    await mongoAccessor.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Bulk training ingestion completed',
      results,
      summary: {
        totalUrls: results.total,
        successfullyProcessed: results.successful,
        failed: results.failed,
        successRate: `${Math.round((results.successful / results.total) * 100)}%`
      }
    });

  } catch (error) {
    console.error('❌ Bulk training ingestion failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Bulk training ingestion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';

    // Get training progress/status
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'eyecare-ai'
    );

    const stats = await mongoAccessor.aggregate('processing_jobs', [
      {
        $match: {
          tenantId,
          'metadata.source': 'bulk-training'
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          urls: { $push: '$metadata.filename' }
        }
      }
    ]);

    const contentStats = await mongoAccessor.aggregate('contents', [
      {
        $match: {
          tenantId,
          'metadata.source': 'bulk-training'
        }
      },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          totalEmbeddings: { $sum: { $cond: [{ $ne: ['$embeddings', null] }, 1, 0] } },
          avgContentLength: { $avg: { $strLenCP: '$content' } }
        }
      }
    ]);

    return NextResponse.json({
      success: true,
      trainingStatus: {
        jobs: stats,
        content: contentStats[0] || { totalContent: 0, totalEmbeddings: 0, avgContentLength: 0 },
        availableUrls: EYEFINITY_TRAINING_URLS.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get training status:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get training status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
