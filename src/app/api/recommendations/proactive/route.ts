import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { VideoSearchEngine } from '@/lib/engines/VideoSearchEngine';

const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

const anthropicAccessor = new AnthropicAccessor({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022'
});

const videoSearchEngine = new VideoSearchEngine(mongoAccessor);

export async function POST(request: NextRequest) {
  try {
    await mongoAccessor.connect();
    
    const { pageContext, userPreferences } = await request.json();
    
    if (!pageContext) {
      return NextResponse.json({ error: 'Page context is required' }, { status: 400 });
    }

    console.log('🎯 Analyzing page context for proactive recommendations:', pageContext);

    // Analyze the page context to determine relevant training topics
    const contextAnalysisPrompt = `
Analyze this page context and determine what VSP training content would be most relevant and helpful:

Page Context:
- URL: ${pageContext.url || 'Not provided'}
- Page Title: ${pageContext.title || 'Not provided'}
- Page Type: ${pageContext.pageType || 'Not provided'}
- Current Activity: ${pageContext.activity || 'Not provided'}
- User Role: ${pageContext.userRole || 'Not provided'}
- Product Context: ${pageContext.product || 'Not provided'}

Based on this context, suggest 2-3 specific training topics that would be immediately useful. Focus on:
1. Direct relevance to current task/page
2. VSP product knowledge gaps
3. Workflow optimization opportunities

Respond with just the training topics as a JSON array of strings, like:
["topic1", "topic2", "topic3"]

Examples:
- If viewing contact lens orders: ["Contact Lens Ordering", "Inventory Management", "Patient Communication"]
- If in practice management software: ["Appointment Scheduling", "Insurance Processing", "Patient Records"]
- If viewing frame catalogs: ["Frame Selection", "Lens Recommendations", "Patient Fitting"]
`;

    const topicsResponse = await anthropicAccessor.generateContent(contextAnalysisPrompt);
    
    let suggestedTopics: string[] = [];
    try {
      // Try to parse the JSON response
      const cleanResponse = topicsResponse.replace(/```json|```/g, '').trim();
      suggestedTopics = JSON.parse(cleanResponse);
    } catch (error) {
      // Fallback: extract topics manually if JSON parsing fails
      const topicMatches = topicsResponse.match(/"([^"]+)"/g);
      suggestedTopics = topicMatches ? topicMatches.map(m => m.replace(/"/g, '')) : ['General Training'];
    }

    // Search for relevant videos for each topic
    const recommendations = [];
    
    for (const topic of suggestedTopics.slice(0, 3)) { // Limit to 3 topics
      console.log(`🔍 Searching videos for topic: ${topic}`);
      
      const relevantVideos = await videoSearchEngine.searchVideos(
        topic,
        pageContext,
        2 // Get top 2 videos per topic
      );

      if (relevantVideos.length > 0) {
        recommendations.push({
          topic,
          reason: `Based on your current ${pageContext.pageType || 'page'}, this training would be immediately useful`,
          videos: relevantVideos.map(video => ({
            id: video.id,
            title: video.name,
            link: video.link,
            thumbnail: video.thumbnail,
            duration: Math.round(video.duration / 60) + ' min',
            summary: video.aiSummary,
            relevanceScore: Math.round(video.relevanceScore * 100) + '%',
            vspProduct: video.vspProduct,
            difficulty: video.learningContent?.difficultyLevel || 'Intermediate'
          }))
        });
      }
    }

    // Generate contextual explanation
    const explanationPrompt = `
Based on the user's current context, explain why these training recommendations are relevant:

Page Context: ${JSON.stringify(pageContext)}
Recommended Topics: ${suggestedTopics.join(', ')}

Provide a brief, friendly explanation (1-2 sentences) of why these specific trainings would help them right now.
`;

    const explanation = await anthropicAccessor.generateContent(explanationPrompt);

    return NextResponse.json({
      success: true,
      recommendations,
      explanation: explanation.trim(),
      suggestedTopics,
      contextAnalysis: {
        pageType: pageContext.pageType,
        relevantProducts: extractRelevantProducts(pageContext),
        priority: calculatePriority(pageContext, recommendations.length)
      },
      metadata: {
        totalVideos: recommendations.reduce((sum, rec) => sum + rec.videos.length, 0),
        analysisTimestamp: new Date().toISOString(),
        contextScore: Math.min(100, recommendations.length * 25) // Simple scoring
      }
    });

  } catch (error) {
    console.error('❌ Proactive recommendation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations'
      },
      { status: 500 }
    );
  }
}

function extractRelevantProducts(pageContext: any): string[] {
  const products = [];
  const context = JSON.stringify(pageContext).toLowerCase();
  
  if (context.includes('contact') || context.includes('lens')) products.push('VSP Vision Care');
  if (context.includes('appointment') || context.includes('schedule')) products.push('Eyefinity Practice Management');
  if (context.includes('inventory') || context.includes('order')) products.push('Officemate');
  if (context.includes('patient') || context.includes('record')) products.push('RevolutionEHR');
  if (context.includes('frame') || context.includes('optical')) products.push('VSP Optics');
  
  return products.length > 0 ? products : ['General'];
}

function calculatePriority(pageContext: any, recommendationCount: number): 'high' | 'medium' | 'low' {
  if (recommendationCount === 0) return 'low';
  
  // High priority for specific product pages or error contexts
  if (pageContext.pageType?.includes('error') || 
      pageContext.activity?.includes('problem') ||
      pageContext.url?.includes('help')) {
    return 'high';
  }
  
  // Medium priority for product-specific pages
  if (pageContext.product || 
      pageContext.pageType?.includes('product') ||
      recommendationCount >= 2) {
    return 'medium';
  }
  
  return 'low';
}
