/**
 * Direct Content Extraction Test
 * Test content extraction directly to debug the issue
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    console.log('🧪 Testing direct content extraction for:', url);

    // Test 1: Simple axios extraction
    let axiosResult = null;
    try {
      const axios = require('axios');
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
        validateStatus: (status: number) => status < 400,
      });
      
      const cheerio = require('cheerio');
      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script, style, nav, header, footer, aside').remove();
      
      const title = $('title').text().trim();
      const bodyText = $('body').text().trim();
      const mainContent = $('main, article, .content, #content').text().trim();
      
      axiosResult = {
        success: true,
        statusCode: response.status,
        title: title,
        bodyTextLength: bodyText.length,
        mainContentLength: mainContent.length,
        bodyPreview: bodyText.substring(0, 200),
        mainPreview: mainContent.substring(0, 200)
      };
      
      console.log('✅ Axios extraction result:', axiosResult);
    } catch (error) {
      axiosResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('❌ Axios extraction failed:', error);
    }

    // Test 2: Test robust-content-extractor
    let robustResult = null;
    try {
      const contentExtractor = (await import('../../../lib/services/robust-content-extractor')).default;
      const result = await contentExtractor.extractContent(url);
      
      robustResult = {
        success: result.success,
        contentLength: result.content?.length || 0,
        title: result.title,
        extractionMethod: result.extractionMethod,
        error: result.error,
        contentPreview: result.content?.substring(0, 200) || 'No content'
      };
      
      console.log('✅ Robust extractor result:', robustResult);
    } catch (error) {
      robustResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('❌ Robust extractor failed:', error);
    }

    return NextResponse.json({
      success: true,
      url: url,
      tests: {
        axios: axiosResult,
        robustExtractor: robustResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Content extraction test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
