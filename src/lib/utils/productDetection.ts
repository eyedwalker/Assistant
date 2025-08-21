// Product detection patterns for VSP eyecare software
// Based on working standalone script logic

export const PRODUCT_PATTERNS = {
  'Officemate': ['officemate', 'office mate', 'om '],
  'Acuity Logic': ['acuity logic', 'acuity', 'al '],
  'EPM': ['epm', 'encompass practice management', 'practice management'],
  'Encompass': ['encompass', 'encompass ehr', 'ehr'],
  'EHR': [' ehr ', 'electronic health record', 'eyefinity ehr'],
  'Practice Management': ['practice management', ' pm ', 'front office', 'scheduling'],
  'Analytics & Insights': ['analytics', 'insights', 'reporting', 'dashboard'],
  'Contact Lens': ['contact lens', 'cl ', 'specialty lens'],
  'Billing': ['billing', 'claims', 'insurance', 'vsp'],
  'Training': ['training', 'learning', 'course', 'tutorial']
};

export function detectProduct(title: string, description: string = '', transcript: string = ''): string {
  const text = `${title} ${description} ${transcript}`.toLowerCase();
  const matches: Record<string, number> = {};
  
  for (const [product, patterns] of Object.entries(PRODUCT_PATTERNS)) {
    matches[product] = patterns.some(pattern => text.includes(pattern)) ? 1 : 0;
  }
  
  // Find primary product (highest match)
  const primaryProduct = Object.entries(matches)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])[0];
    
  return primaryProduct ? primaryProduct[0] : 'General';
}

export function getTopicAnalysis(videos: any[]): Record<string, number> {
  const topics = new Map<string, number>();
  
  videos.forEach(video => {
    if (video.aiAnalysis) {
      // Extract topics from titles
      const title = video.title.toLowerCase();
      if (title.includes('ehr')) topics.set('EHR Systems', (topics.get('EHR Systems') || 0) + 1);
      if (title.includes('practice management') || title.includes('pm')) topics.set('Practice Management', (topics.get('Practice Management') || 0) + 1);
      if (title.includes('contact lens') || title.includes('cl')) topics.set('Contact Lens', (topics.get('Contact Lens') || 0) + 1);
      if (title.includes('analytics') || title.includes('insights')) topics.set('Analytics & Insights', (topics.get('Analytics & Insights') || 0) + 1);
      if (title.includes('billing') || title.includes('claim')) topics.set('Billing & Claims', (topics.get('Billing & Claims') || 0) + 1);
      if (title.includes('patient')) topics.set('Patient Management', (topics.get('Patient Management') || 0) + 1);
      if (title.includes('vsp')) topics.set('VSP Integration', (topics.get('VSP Integration') || 0) + 1);
    }
  });
  
  return Object.fromEntries(topics);
}
