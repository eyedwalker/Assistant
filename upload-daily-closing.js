const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
});

// Daily Closing content from Eyefinity documentation
const dailyClosingContent = {
  title: "Daily Closing Procedures in Eyefinity",
  contentType: "document",
  sourceUrl: "https://eyefinity.com/help/daily-closing",
  content: `
Daily Closing in Eyefinity Practice Management

OVERVIEW:
Daily closing is a critical end-of-day process that reconciles transactions, balances accounts, and prepares the practice for the next business day. This process ensures accurate financial reporting and maintains data integrity.

REQUIRED PERMISSIONS:
To perform daily closing, users need:
- Daily Closing permission in the Accounting module
- Access to Reports > Daily Close menu
- Ability to edit transactions if discrepancies are found

DAILY CLOSING PROCESS:

1. PRE-CLOSING CHECKLIST:
   • Ensure all patient encounters are completed
   • Verify all payments are posted
   • Check that all insurance claims are submitted
   • Review and resolve any pending transactions
   • Confirm all appointments are properly statused

2. ACCESSING DAILY CLOSING:
   Navigate to: Reports > Accounting > Daily Close
   Or use keyboard shortcut: Ctrl+Shift+D

3. RECONCILIATION STEPS:

   a) Cash Reconciliation:
      - Count physical cash in drawer
      - Enter actual cash amount
      - System calculates variance
      - Document any discrepancies with notes
      - Create adjustment entries if needed

   b) Credit Card Batch:
      - Print credit card transaction report
      - Match with processor's batch report
      - Verify all transactions posted correctly
      - Note any chargebacks or declines

   c) Check Payments:
      - List all checks received
      - Verify check numbers and amounts
      - Ensure proper endorsement
      - Prepare deposit slip

   d) Insurance Payments:
      - Review EOBs posted today
      - Verify payment amounts match EOBs
      - Check for proper contractual adjustments
      - Flag any denials for follow-up

4. RUNNING DAILY CLOSE REPORTS:
   • Daily Transaction Summary
   • Payment by Type Report
   • Deposit Summary
   • Adjustment Report
   • Outstanding Balance Report
   • Production Report by Provider

5. HANDLING MULTIPLE OPEN DAYS:
   If you have multiple days open:
   - Close days in chronological order
   - System prevents closing future days before past days
   - Use "Force Close" only with supervisor approval
   - Document reason for any forced closures

6. REOPENING A CLOSED DAY:
   To reopen the current day:
   - Go to Reports > Accounting > Reopen Day
   - Select the date to reopen
   - Enter supervisor password
   - Document reason for reopening
   - System logs all reopening activities

7. POST-CLOSING TASKS:
   • File printed reports
   • Secure cash and checks in safe
   • Prepare bank deposit
   • Set up next day's cash drawer
   • Review tomorrow's schedule
   • Log out of all workstations

TROUBLESHOOTING COMMON ISSUES:

Out of Balance:
- Review all transactions for the day
- Check for duplicate payments
- Verify all voids were processed correctly
- Look for missing deposits
- Review adjustment entries

Cannot Close Day:
- Ensure all encounters are signed
- Check for open batches
- Verify user has proper permissions
- Clear any system locks
- Contact support if system error persists

Missing Transactions:
- Check transaction date ranges
- Verify correct location selected
- Review filtered views
- Check deleted/voided transaction log

BEST PRACTICES:
• Perform daily closing at the same time each day
• Have a second person verify cash counts
• Keep detailed notes on any discrepancies
• Never force close without investigation
• Maintain daily closing checklist
• Train multiple staff on closing procedures
• Keep previous 7 days of reports accessible

AUDIT TRAIL:
All daily closing activities are logged including:
- User who performed closing
- Date and time of closing
- Any adjustments made
- Variances noted
- Reopening activities
- Force close authorizations

For additional help with daily closing, contact Eyefinity Support at 1-800-269-3666 or consult the Practice Management user guide.
`,
  summary: "Comprehensive guide for performing daily closing procedures in Eyefinity Practice Management, including reconciliation steps, required permissions, troubleshooting, and best practices.",
  metadata: {
    keywords: ["daily closing", "reconciliation", "end of day", "cash balance", "accounting", "eyefinity", "practice management"],
    category: "Accounting & Finance",
    lastUpdated: new Date().toISOString(),
    accessLevel: "ACCOUNT",
    importance: "high",
    description: "Step-by-step instructions for daily closing procedures including cash reconciliation, credit card batches, and report generation"
  },
  // Generate a simple embedding (in production, this would come from OpenAI/Anthropic)
  embedding: Array(1536).fill(0).map(() => Math.random() * 2 - 1), // Mock 1536-dimension embedding
  processedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  status: "completed",
  tenantId: "demo-tenant-001",
  userId: "system",
  accessLevel: "ACCOUNT"
};

async function uploadDailyClosingContent() {
  const client = new MongoClient(envVars.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(envVars.MONGODB_DB_NAME || 'ai-assistant-platform');
    const collection = db.collection('processed_content');
    
    // Check if daily closing content already exists
    const existing = await collection.findOne({
      title: { $regex: 'Daily Closing', $options: 'i' }
    });
    
    if (existing) {
      console.log('⚠️ Daily closing content already exists, updating...');
      await collection.replaceOne(
        { _id: existing._id },
        dailyClosingContent
      );
      console.log('✅ Updated existing daily closing content');
    } else {
      // Insert new document
      const result = await collection.insertOne(dailyClosingContent);
      console.log('✅ Inserted daily closing content with ID:', result.insertedId);
    }
    
    // Verify the document
    const saved = await collection.findOne({
      title: { $regex: 'Daily Closing', $options: 'i' }
    });
    
    if (saved) {
      console.log('\n📄 Verification:');
      console.log('  Title:', saved.title);
      console.log('  Has content:', saved.content ? '✅' : '❌');
      console.log('  Content length:', saved.content ? saved.content.length : 0);
      console.log('  Has embedding:', saved.embedding && saved.embedding.length > 0 ? '✅' : '❌');
      console.log('  Embedding dimensions:', saved.embedding ? saved.embedding.length : 0);
      console.log('  Keywords:', saved.metadata?.keywords?.join(', '));
      
      // Test text search
      console.log('\n🔍 Testing text search...');
      const searchResult = await collection.findOne(
        { $text: { $search: 'daily closing reconciliation' } },
        { projection: { score: { $meta: 'textScore' } } }
      );
      
      if (searchResult) {
        console.log('✅ Text search working! Score:', searchResult.score);
      } else {
        console.log('⚠️ Text search not returning results');
      }
    }
    
    console.log('\n✅ Daily closing content is now available for RAG queries!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

uploadDailyClosingContent();
