import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ContactLensInfo {
  brand: string;
  product: string;
  baseCurve?: string;
  diameter?: string;
  sphere?: string;
  cylinder?: string;
  axis?: string;
  add?: string;
  quantity?: number;
  currentPrice?: number;
}

interface PriceSearchResult {
  retailer: string;
  productName: string;
  price: number;
  url: string;
  inStock: boolean;
  shipping?: number;
  totalPrice?: number;
}

class PriceComparisonService {
  private searchProviders = [
    'https://api.serpapi.com/search', // Google Shopping API
    'https://api.rainforestapi.com/request' // Amazon Product API
  ];

  async searchContactLensPrices(lens: ContactLensInfo): Promise<PriceSearchResult[]> {
    const results: PriceSearchResult[] = [];
    
    // Build search query
    const searchQuery = `${lens.brand} ${lens.product} contact lenses ${lens.baseCurve ? `BC ${lens.baseCurve}` : ''} ${lens.diameter ? `DIA ${lens.diameter}` : ''}`.trim();
    
    // Search Google Shopping
    if (process.env.SERPAPI_KEY) {
      const googleResults = await this.searchGoogleShopping(searchQuery);
      results.push(...googleResults);
    }

    // Search major contact lens retailers
    const retailers = [
      { name: '1-800 Contacts', domain: '1800contacts.com' },
      { name: 'LensDirect', domain: 'lensdirect.com' },
      { name: 'ContactsDirect', domain: 'contactsdirect.com' },
      { name: 'Walgreens', domain: 'walgreens.com' },
      { name: 'CVS', domain: 'cvs.com' },
      { name: 'Costco', domain: 'costco.com' },
      { name: 'Lens.com', domain: 'lens.com' },
      { name: 'OptiContacts', domain: 'opticontacts.com' }
    ];

    // Web scraping simulation (in production, use actual APIs or scraping)
    for (const retailer of retailers) {
      const result = await this.searchRetailer(retailer, searchQuery, lens);
      if (result) {
        results.push(result);
      }
    }

    // Sort by total price
    return results.sort((a, b) => {
      const priceA = a.totalPrice || a.price;
      const priceB = b.totalPrice || b.price;
      return priceA - priceB;
    });
  }

  private async searchGoogleShopping(query: string): Promise<PriceSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        tbm: 'shop',
        api_key: process.env.SERPAPI_KEY || '',
        location: 'United States',
        hl: 'en',
        gl: 'us',
        num: '20'
      });

      const response = await fetch(`https://serpapi.com/search?${params}`);
      const data = await response.json();

      if (!data.shopping_results) return [];

      // Whitelist of legitimate contact lens retailers
      const trustedRetailers = [
        '1-800contacts.com',
        'lensdirect.com',
        'contactlensking.com',
        'discountcontacts.com',
        'coastal.com',
        'warbyparker.com',
        'cvs.com',
        'walgreens.com',
        'walmart.com',
        'target.com',
        'costco.com',
        'samsclub.com',
        'contactlens.com',
        'opticontacts.com',
        'lensabl.com',
        'hubblecontacts.com'
      ].map(domain => domain.toLowerCase());

      // Additional trusted retailers that commonly sell contact lenses
      const additionalTrusted = [
        'amazon',
        'lens.com',
        'lenscrafters',
        'pearlevision',
        'visionworks',
        'eyebuydirect',
        'framesdirect'
      ];

      return data.shopping_results
        .filter((item: any) => {
          const source = (item.source || '').toLowerCase();
          const link = (item.link || '').toLowerCase();
          
          // Check if retailer is in trusted list
          const isTrustedDomain = trustedRetailers.some(domain => 
            source.includes(domain.replace('.com', '')) || 
            link.includes(domain)
          );
          
          const isAdditionalTrusted = additionalTrusted.some(name => 
            source.includes(name) || link.includes(name)
          );
          
          // Filter out obvious non-contact lens retailers
          const excludeKeywords = [
            'gopopstation',
            'joylot',
            'klenspop',
            'lenzo',
            'tinnitus',
            'hearing',
            'audio',
            'electronics',
            'games',
            'toys'
          ];
          
          const hasExcludedKeywords = excludeKeywords.some(keyword => 
            source.includes(keyword) || 
            (item.title || '').toLowerCase().includes(keyword)
          );
          
          // Must be trusted retailer AND not have excluded keywords
          return (isTrustedDomain || isAdditionalTrusted) && !hasExcludedKeywords;
        })
        .map((item: any) => ({
          retailer: item.source,
          productName: item.title,
          price: parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0'),
          url: item.link || item.product_link || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.title)}`,
          inStock: !item.out_of_stock,
          shipping: item.delivery?.price ? parseFloat(item.delivery.price.replace(/[^0-9.]/g, '')) : 0,
          totalPrice: parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0') + 
                     (item.delivery?.price ? parseFloat(item.delivery.price.replace(/[^0-9.]/g, '')) : 0)
        }));
    } catch (error) {
      console.error('Google Shopping search error:', error);
      return [];
    }
  }

  private async searchRetailer(retailer: { name: string; domain: string }, query: string, lens: ContactLensInfo): Promise<PriceSearchResult | null> {
    // In production, implement actual web scraping or API calls
    // For now, return simulated data based on typical pricing
    const basePrice = lens.currentPrice || 40;
    const variance = Math.random() * 20 - 10; // -10 to +10 variance
    const price = Math.max(basePrice + variance, 15); // Minimum $15
    
    return {
      retailer: retailer.name,
      productName: `${lens.brand} ${lens.product}`,
      price: Math.round(price * 100) / 100,
      url: `https://${retailer.domain}/search?q=${encodeURIComponent(query)}`,
      inStock: Math.random() > 0.2, // 80% chance in stock
      shipping: Math.random() > 0.5 ? 0 : 7.99,
      totalPrice: Math.round((price + (Math.random() > 0.5 ? 0 : 7.99)) * 100) / 100
    };
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (skip in development for extension testing)
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - Please log in' },
          { status: 401 }
        );
      }
    }

    const lensInfo: ContactLensInfo = await request.json();
    
    const priceService = new PriceComparisonService();
    const priceResults = await priceService.searchContactLensPrices(lensInfo);

    // Calculate savings and format results
    const currentTotal = lensInfo.currentPrice || 0;
    const allResults = priceResults.map(result => ({
      ...result,
      savings: Number((currentTotal - result.price).toFixed(2)),
      totalPrice: result.totalPrice || result.price + (result.shipping || 0)
    }));
    
    const recommendations = allResults
      .sort((a, b) => a.totalPrice - b.totalPrice)
      .slice(0, 5);
    
    const betterDeals = allResults.filter(r => r.totalPrice < currentTotal);
    
    const responseData = {
      success: true,
      query: lensInfo,
      recommendations,
      summary: {
        betterDealsFound: betterDeals.length,
        bestPrice: recommendations[0]?.price || currentTotal,
        bestTotalPrice: recommendations[0]?.totalPrice || currentTotal,
        maxSavings: betterDeals.length > 0 ? 
          Number((currentTotal - Math.min(...betterDeals.map(d => d.totalPrice))).toFixed(2)) : 0
      }
    };
    
    // Create response with CORS headers
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Price matching error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch price comparisons' },
      { status: 500 }
    );
    
    // Add CORS headers to error response
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorResponse;
  }
}
