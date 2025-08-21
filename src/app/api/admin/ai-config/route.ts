import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

interface AIConfig {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  prioritizeUploadedContent: boolean;
  maxContextLength: number;
  temperature: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET() {
  try {
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    
    await mongoAccessor.connect();
    
    const configs = await mongoAccessor.find('ai_configs', {});
    
    // If no configs exist, create a default one
    if (configs.length === 0) {
      const defaultConfig: AIConfig = {
        id: 'default',
        name: 'Default Eyecare Assistant',
        systemPrompt: `You are an AI assistant specialized in eyecare and optometry for professionals using VSP products like Officemate, Acuity Logic, EPM, and Encompass.

CRITICAL INSTRUCTIONS:
1. ALWAYS prioritize information from uploaded documents and processed videos over general knowledge
2. When answering questions, first search through the provided context from documents and videos
3. If the answer is found in uploaded content, cite the specific source (document title, video name, etc.)
4. Only provide general eyecare knowledge if NO relevant information is found in uploaded content
5. Be explicit about whether your answer comes from uploaded content or general knowledge

Your primary role is to help eyecare professionals with:
- VSP software training (Officemate, Acuity Logic, EPM, Encompass)
- Clinical procedures and best practices
- Billing and claims processes
- Patient management workflows
- Contact lens procedures and fitting

Always provide accurate, professional responses and ask for clarification if questions are unclear.`,
        userPromptTemplate: `Context from uploaded documents and videos:
{context}

User question: {question}

Instructions: Answer based FIRST on the provided context above. If the context contains relevant information, use it and cite the source. If the context doesn't contain relevant information, then provide general eyecare knowledge but clearly state this distinction.`,
        prioritizeUploadedContent: true,
        maxContextLength: 4000,
        temperature: 0.3,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mongoAccessor.create('ai_configs', defaultConfig);
      await mongoAccessor.disconnect();
      
      return NextResponse.json({
        success: true,
        configs: [defaultConfig]
      });
    }
    
    await mongoAccessor.disconnect();
    
    return NextResponse.json({
      success: true,
      configs
    });
    
  } catch (error) {
    console.error('Error fetching AI configs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch AI configurations'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;
    
    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Configuration is required'
      }, { status: 400 });
    }
    
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    
    await mongoAccessor.connect();
    
    // Update the config
    const updatedConfig = {
      ...config,
      updatedAt: new Date()
    };
    
    if (config.id) {
      // Update existing config
      await mongoAccessor.updateWithFilter(
        'ai_configs',
        { id: config.id },
        { $set: updatedConfig }
      );
    } else {
      // Create new config
      updatedConfig.id = `config_${Date.now()}`;
      updatedConfig.createdAt = new Date();
      await mongoAccessor.create('ai_configs', updatedConfig);
    }
    
    // If this config is being set as active, deactivate others
    if (updatedConfig.active) {
      await mongoAccessor.updateManyWithFilter(
        'ai_configs',
        { id: { $ne: updatedConfig.id } },
        { $set: { active: false } }
      );
    }
    
    await mongoAccessor.disconnect();
    
    return NextResponse.json({
      success: true,
      config: updatedConfig
    });
    
  } catch (error) {
    console.error('Error saving AI config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to save AI configuration'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');
    
    if (!configId) {
      return NextResponse.json({
        success: false,
        error: 'Configuration ID is required'
      }, { status: 400 });
    }
    
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    
    await mongoAccessor.connect();
    await mongoAccessor.deleteWithFilter('ai_configs', { id: configId });
    await mongoAccessor.disconnect();
    
    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting AI config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete AI configuration'
    }, { status: 500 });
  }
}
