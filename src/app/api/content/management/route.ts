import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    const userId = session.user.id;
    const tenantId = session.user.accessId || 'default';

    // Fetch all processed content for this user/tenant
    const [documents, videos, webContent] = await Promise.all([
      type === 'all' || type === 'document' 
        ? mongoAccessor.find('documents', { userId, tenantId })
        : [],
      type === 'all' || type === 'video'
        ? mongoAccessor.find('videos', { userId, tenantId })
        : [],
      type === 'all' || type === 'web'
        ? mongoAccessor.find('processed_web_content', { userId, tenantId })
        : []
    ]);

    // Format content with summaries
    const allContent = [
      ...documents.map((item: any) => ({
        id: item._id.toString(),
        type: item.contentType,
        title: item.title || item.filename || item.url || 'Untitled',
        source: item.source || item.url || item.filename,
        processedAt: item.processedAt || item.createdAt,
        lastUpdated: item.updatedAt || item.processedAt,
        status: item.status || 'completed',
        summary: item.aiSummary || item.summary || 'No summary available',
        keyTopics: item.keyTopics || [],
        extractedText: item.extractedText ? 
          (item.extractedText.substring(0, 200) + '...') : null,
        metadata: {
          size: item.size,
          duration: item.duration,
          frameCount: item.frameCount,
          pageCount: item.pageCount,
          wordCount: item.wordCount,
          crawlDepth: item.crawlDepth,
          linkedPages: item.linkedPages
        },
        hasEmbeddings: item.hasEmbeddings || false,
        embeddingCount: item.embeddingCount || 0,
        needsRefresh: false // Will be determined by update check
      })),
      ...videos.map((item: any) => ({
        id: item._id.toString(),
        type: item.contentType,
        title: item.title || item.filename || item.url || 'Untitled',
        source: item.source || item.url || item.filename,
        processedAt: item.processedAt || item.createdAt,
        lastUpdated: item.updatedAt || item.processedAt,
        status: item.status || 'completed',
        summary: item.aiSummary || item.summary || 'No summary available',
        keyTopics: item.keyTopics || [],
        extractedText: item.extractedText ? 
          (item.extractedText.substring(0, 200) + '...') : null,
        metadata: {
          size: item.size,
          duration: item.duration,
          frameCount: item.frameCount,
          pageCount: item.pageCount,
          wordCount: item.wordCount,
          crawlDepth: item.crawlDepth,
          linkedPages: item.linkedPages
        },
        hasEmbeddings: item.hasEmbeddings || false,
        embeddingCount: item.embeddingCount || 0,
        needsRefresh: false // Will be determined by update check
      })),
      ...webContent.map((item: any) => ({
        id: item._id.toString(),
        type: item.contentType,
        title: item.title || item.filename || item.url || 'Untitled',
        source: item.source || item.url || item.filename,
        processedAt: item.processedAt || item.createdAt,
        lastUpdated: item.updatedAt || item.processedAt,
        status: item.status || 'completed',
        summary: item.aiSummary || item.summary || 'No summary available',
        keyTopics: item.keyTopics || [],
        extractedText: item.extractedText ? 
          (item.extractedText.substring(0, 200) + '...') : null,
        metadata: {
          size: item.size,
          duration: item.duration,
          frameCount: item.frameCount,
          pageCount: item.pageCount,
          wordCount: item.wordCount,
          crawlDepth: item.crawlDepth,
          linkedPages: item.linkedPages
        },
        hasEmbeddings: item.hasEmbeddings || false,
        embeddingCount: item.embeddingCount || 0,
        needsRefresh: false // Will be determined by update check
      }))
    ];

    // Check for updates (for URLs)
    const urlContent = allContent.filter(item => item.type === 'web');
    for (const item of urlContent) {
      if (item.source && item.lastUpdated) {
        // Check if content is older than 7 days
        const lastUpdate = new Date(item.lastUpdated);
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        item.needsRefresh = daysSinceUpdate > 7;
      }
    }

    const totalCount = allContent.length;
    const formattedContent = allContent.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      content: formattedContent,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        totalDocuments: allContent.filter(i => i.type === 'document').length,
        totalVideos: allContent.filter(i => i.type === 'video').length,
        totalWebPages: allContent.filter(i => i.type === 'web').length,
        needsRefresh: allContent.filter(i => i.needsRefresh).length
      }
    });

  } catch (error) {
    console.error('Content management error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove content
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contentId } = await request.json();
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID required' }, { status: 400 });
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    // Delete from MongoDB collections
    await Promise.all([
      mongoAccessor.delete('documents', contentId),
      mongoAccessor.delete('videos', contentId),
      mongoAccessor.delete('processed_web_content', contentId),
      // Also delete embeddings
      mongoAccessor.deleteMany('embeddings', { contentId })
    ]);

    return NextResponse.json({ success: true, message: 'Content deleted successfully' });

  } catch (error) {
    console.error('Content deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
