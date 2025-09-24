import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

// Mock database - in production, use actual database
const usageData = new Map()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const usage = usageData.get(userEmail) || generateMockUsageData()

    return NextResponse.json({ usage })
  } catch (error) {
    console.error('Usage GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'record_chat':
        return handleRecordChat(session.user.email, data)
      case 'update_auto_replenish':
        return handleUpdateAutoReplenish(session.user.email, data)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Usage POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateMockUsageData() {
  const currentDate = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentDate)
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toISOString().split('T')[0],
      chats: Math.floor(Math.random() * 80) + 20
    }
  })

  return {
    currentPeriod: {
      totalChats: 1650,
      remainingChats: 350,
      locations: 3,
      periodStart: '2025-08-01',
      periodEnd: '2025-08-31'
    },
    locations: [
      { 
        id: 1, 
        name: 'Main Office', 
        chatsUsed: 750, 
        chatsRemaining: 250, 
        lastActivity: currentDate.toISOString().split('T')[0] 
      },
      { 
        id: 2, 
        name: 'West Side Clinic', 
        chatsUsed: 480, 
        chatsRemaining: 520, 
        lastActivity: currentDate.toISOString().split('T')[0] 
      },
      { 
        id: 3, 
        name: 'Downtown Branch', 
        chatsUsed: 420, 
        chatsRemaining: 580, 
        lastActivity: new Date(currentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      }
    ],
    dailyUsage: last7Days,
    recentPurchases: [
      { date: '2025-08-15', amount: 1000, price: 29, status: 'completed' },
      { date: '2025-07-28', amount: 1000, price: 29, status: 'completed' }
    ],
    autoReplenish: {
      enabled: true,
      threshold: 200,
      amount: 1000
    }
  }
}

async function handleRecordChat(userEmail: string, data: any) {
  const usage = usageData.get(userEmail) || generateMockUsageData()
  const { locationId, chatsUsed = 1 } = data

  // Update location usage
  const location = usage.locations.find((loc: any) => loc.id === locationId)
  if (location) {
    location.chatsUsed += chatsUsed
    location.chatsRemaining -= chatsUsed
    location.lastActivity = new Date().toISOString().split('T')[0]
  }

  // Update daily usage
  const today = new Date().toISOString().split('T')[0]
  const todayUsage = usage.dailyUsage.find((day: any) => day.date === today)
  if (todayUsage) {
    todayUsage.chats += chatsUsed
  } else {
    usage.dailyUsage.push({ date: today, chats: chatsUsed })
    // Keep only last 7 days
    usage.dailyUsage = usage.dailyUsage.slice(-7)
  }

  // Update total usage
  usage.currentPeriod.totalChats += chatsUsed
  usage.currentPeriod.remainingChats -= chatsUsed

  // Check for auto-replenish
  if (usage.autoReplenish?.enabled && usage.currentPeriod.remainingChats <= usage.autoReplenish.threshold) {
    // Trigger auto-replenish
    const replenishAmount = usage.autoReplenish.amount
    const replenishPrice = replenishAmount === 500 ? 15 : replenishAmount === 1000 ? 29 : 55

    usage.currentPeriod.remainingChats += replenishAmount
    usage.recentPurchases.unshift({
      date: new Date().toISOString().split('T')[0],
      amount: replenishAmount,
      price: replenishPrice,
      status: 'auto-replenish'
    })

    // Distribute chats evenly across locations
    const chatsPerLocation = Math.floor(replenishAmount / usage.locations.length)
    usage.locations.forEach((loc: any) => {
      loc.chatsRemaining += chatsPerLocation
    })
  }

  usageData.set(userEmail, usage)

  return NextResponse.json({ 
    success: true, 
    usage,
    message: 'Chat usage recorded successfully'
  })
}

async function handleUpdateAutoReplenish(userEmail: string, data: any) {
  const usage = usageData.get(userEmail) || generateMockUsageData()
  
  usage.autoReplenish = {
    enabled: data.enabled ?? usage.autoReplenish.enabled,
    threshold: data.threshold ?? usage.autoReplenish.threshold,
    amount: data.amount ?? usage.autoReplenish.amount
  }

  usageData.set(userEmail, usage)

  return NextResponse.json({ 
    success: true, 
    autoReplenish: usage.autoReplenish,
    message: 'Auto-replenish settings updated successfully'
  })
}
