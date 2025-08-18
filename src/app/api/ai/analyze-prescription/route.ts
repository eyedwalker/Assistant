import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prescription, context } = await req.json();
    
    console.log('AI analyzing prescription:', prescription);
    
    // Generate AI recommendations based on prescription
    const recommendations = [];
    
    if (prescription.sphere) {
      const sphereValue = parseFloat(prescription.sphere);
      
      // Recommend lens types based on prescription strength
      if (Math.abs(sphereValue) <= 2.0) {
        recommendations.push({
          title: '📦 Daily Disposables Recommended',
          description: 'For mild prescriptions, daily lenses offer convenience and hygiene. Consider Acuvue Oasys 1-Day or Dailies Total1.'
        });
      } else if (Math.abs(sphereValue) <= 4.0) {
        recommendations.push({
          title: '📅 Monthly Lenses Suggested',
          description: 'Monthly lenses like Acuvue Oasys or Biofinity offer better value for moderate prescriptions.'
        });
      } else {
        recommendations.push({
          title: '⚡ Extended Wear Options',
          description: 'For stronger prescriptions, consider Air Optix Night & Day or PureVision2 for extended wear comfort.'
        });
      }
    }
    
    // Add base curve and diameter recommendations
    if (prescription.baseCurve && prescription.diameter) {
      recommendations.push({
        title: '✅ Compatible Brands',
        description: `Lenses with BC ${prescription.baseCurve} and DIA ${prescription.diameter} include: Acuvue Oasys, Biofinity, Air Optix Plus HydraGlyde.`
      });
    }
    
    // Add price-saving tips
    recommendations.push({
      title: '💰 Save with Bulk Orders',
      description: 'Consider buying 6 or 12-month supplies for discounts up to 20%. Check rebate programs from manufacturers.'
    });
    
    return NextResponse.json({
      success: true,
      message: `Found ${recommendations.length} recommendations for your prescription`,
      recommendations,
      prescription
    });
    
  } catch (error) {
    console.error('Error analyzing prescription:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze prescription',
        recommendations: []
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
