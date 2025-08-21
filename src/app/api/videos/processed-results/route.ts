import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vspProduct = searchParams.get('vspProduct');
    const productFeature = searchParams.get('productFeature');
    const search = searchParams.get('search');

    // Initialize MongoDB connection
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    try {
      // Build query filter
      const filter: any = {
        contentType: 'video',
        processingStatus: 'completed'
      };

      // Add VSP product filter
      if (vspProduct && vspProduct !== '') {
        filter.vspProduct = vspProduct;
      }

      // Add product feature filter
      if (productFeature && productFeature !== '') {
        filter.productFeatures = { $in: [productFeature] };
      }

      // Add search filter
      if (search && search !== '') {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { extractedText: { $regex: search, $options: 'i' } },
          { aiAnalysis: { $regex: search, $options: 'i' } }
        ];
      }

      // Fetch processed videos
      const videos = await mongoAccessor.find('documents', filter, {
        sort: { processedAt: -1 },
        limit: 100
      });

      // Calculate statistics
      const stats = {
        total: videos.length,
        byProduct: {} as Record<string, number>
      };

      // Count videos by product
      videos.forEach((video: any) => {
        const product = video.vspProduct || 'Unknown';
        stats.byProduct[product] = (stats.byProduct[product] || 0) + 1;
      });

      return NextResponse.json({
        success: true,
        videos,
        stats,
        filters: {
          vspProduct,
          productFeature,
          search
        }
      });

    } finally {
      await mongoAccessor.disconnect();
    }

  } catch (error) {
    console.error('Error fetching processed video results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processed videos' },
      { status: 500 }
    );
  }
}
