import { NextRequest, NextResponse } from 'next/server';
import { TrainingManager } from '@/lib/managers/TrainingManager';
import { CertificationManager } from '@/lib/managers/CertificationManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function POST(request: NextRequest) {
  try {
    console.log('🎓 Starting training system demonstration...');

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'ai-assistant'
    );
    
    // Test connection first
    await mongoAccessor.connect();
    console.log('✅ MongoDB connected successfully');
    
    // Get available processed content from the RAG system
    const availableContent = await mongoAccessor.find('contents', {
      tenantId: 'demo-tenant'
    });

    console.log(`📚 Found ${availableContent.length} processed documents for training generation`);

    // For demo purposes, create mock training modules if no content exists
    if (availableContent.length === 0) {
      console.log('📝 No processed content found, creating demo training modules...');
      
      const demoModules = [
        {
          id: 'demo-admin-001',
          title: 'Eyefinity Administration Fundamentals',
          category: 'Practice Management',
          difficulty: 'intermediate',
          estimatedDuration: 45,
          description: 'Learn essential practice management and administrative procedures for Eyefinity systems.',
          status: 'active',
          createdAt: new Date()
        },
        {
          id: 'demo-front-office-001',
          title: 'Front Office Operations Excellence',
          category: 'Patient Care',
          difficulty: 'beginner',
          estimatedDuration: 30,
          description: 'Master front office procedures and patient management workflows.',
          status: 'active',
          createdAt: new Date()
        }
      ];

      // Store demo modules in database
      console.log('💾 Storing demo modules in database...');
      for (const module of demoModules) {
        try {
          console.log(`💾 Storing module: ${module.title}`);
          const result = await mongoAccessor.create('training_modules', {
            ...module,
            tenantId: 'demo-tenant',
            userId: 'demo-user'
          });
          console.log(`✅ Stored module with ID: ${result}`);
        } catch (error) {
          console.error(`❌ Failed to store module ${module.title}:`, error);
        }
      }

      await mongoAccessor.disconnect();

      return NextResponse.json({
        success: true,
        message: 'Demo training modules created successfully',
        summary: {
          successfulModules: demoModules.length,
          failedModules: 0,
          totalProcessed: demoModules.length
        },
        modules: demoModules
      });
    }

    // Group content by category for different training modules
    const administrationContent = availableContent.filter((doc: any) => 
      doc.title?.toLowerCase().includes('administration') ||
      doc.content?.toLowerCase().includes('administration')
    );

    const frontOfficeContent = availableContent.filter((doc: any) => 
      doc.title?.toLowerCase().includes('front office') ||
      doc.content?.toLowerCase().includes('front office')
    );

    // Create training modules from existing content
    const modules = [];
    
    if (administrationContent.length > 0) {
      console.log('🏢 Creating Administration training module...');
      const adminModule = {
        id: 'content-admin-001',
        title: 'Eyefinity Administration Fundamentals',
        category: 'Practice Management',
        difficulty: 'intermediate',
        estimatedDuration: 45,
        description: `Learn essential practice management and administrative procedures based on ${administrationContent.length} processed documents.`,
        status: 'active',
        sourceDocuments: administrationContent.length,
        createdAt: new Date()
      };
      
      await mongoAccessor.create('training_modules', {
        ...adminModule,
        tenantId: 'demo-tenant',
        userId: 'demo-user'
      });
      
      modules.push(adminModule);
    }

    if (frontOfficeContent.length > 0) {
      console.log('🏪 Creating Front Office training module...');
      const frontOfficeModule = {
        id: 'content-front-office-001',
        title: 'Front Office Operations Excellence',
        category: 'Patient Care',
        difficulty: 'beginner',
        estimatedDuration: 30,
        description: `Master front office procedures based on ${frontOfficeContent.length} processed documents.`,
        status: 'active',
        sourceDocuments: frontOfficeContent.length,
        createdAt: new Date()
      };
      
      await mongoAccessor.create('training_modules', {
        ...frontOfficeModule,
        tenantId: 'demo-tenant',
        userId: 'demo-user'
      });
      
      modules.push(frontOfficeModule);
    }

    // Create general module from remaining content
    const remainingContent = availableContent.filter((doc: any) => 
      !administrationContent.includes(doc) && !frontOfficeContent.includes(doc)
    );
    
    if (remainingContent.length > 0) {
      console.log('📚 Creating General training module...');
      const generalModule = {
        id: 'content-general-001',
        title: 'Eyecare Practice Essentials',
        category: 'General Knowledge',
        difficulty: 'beginner',
        estimatedDuration: 25,
        description: `Essential eyecare practice knowledge based on ${remainingContent.length} processed documents.`,
        status: 'active',
        sourceDocuments: remainingContent.length,
        createdAt: new Date()
      };
      
      await mongoAccessor.create('training_modules', {
        ...generalModule,
        tenantId: 'demo-tenant',
        userId: 'demo-user'
      });
      
      modules.push(generalModule);
    }

    await mongoAccessor.disconnect();

    console.log(`✅ Generated ${modules.length} training modules successfully`);

    return NextResponse.json({
      success: true,
      message: `Generated ${modules.length} training modules from processed content`,
      summary: {
        totalDocuments: availableContent.length,
        administrationDocuments: administrationContent.length,
        successfulModules: modules.length,
        failedModules: 0,
        totalProcessed: modules.length
      },
      modules: modules
    });

  } catch (error) {
    console.error('❌ Training system demo failed:', error);
    return NextResponse.json({
      error: 'Training system demo failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      const mongoAccessor = new MongoDBAccessor(
        process.env.MONGODB_URI || 'mongodb://localhost:27017',
        process.env.MONGODB_DB || 'ai-assistant'
      );
      
      // Get training system status
      const modules = await mongoAccessor.find('training_modules', { tenantId: 'demo-tenant' });
      const assessments = await mongoAccessor.find('assessments', { tenantId: 'demo-tenant' });
      const certifications = await mongoAccessor.find('certifications', { tenantId: 'demo-tenant' });
      const progress = await mongoAccessor.find('user_progress', { tenantId: 'demo-tenant' });

      return NextResponse.json({
        success: true,
        status: {
          trainingModules: modules.length,
          assessments: assessments.length,
          certifications: certifications.length,
          activeProgress: progress.length,
          systemReady: true
        },
        modules: modules.map(m => ({
          id: m.id || m._id?.toString(),
          title: m.title,
          category: m.category,
          difficulty: m.difficulty,
          estimatedDuration: m.estimatedDuration,
          isActive: m.isActive
        }))
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Use ?action=status'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error getting training system status:', error);
    return NextResponse.json({
      error: 'Failed to get training system status'
    }, { status: 500 });
  }
}
