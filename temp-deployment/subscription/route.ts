import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

// Mock database - in production, use actual database
const subscriptions = new Map()
const usageData = new Map()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const subscription = subscriptions.get(userEmail) || {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      userId: userEmail,
      plan: 'basic',
      locations: 1,
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      chatsIncluded: 1000,
      chatsUsed: 0,
      chatsRemaining: 1000,
      autoReplenish: true,
      replenishThreshold: 200,
      replenishAmount: 1000,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Subscription GET error:', error)
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
      case 'create':
        return handleCreateSubscription(session.user.email, data)
      case 'update':
        return handleUpdateSubscription(session.user.email, data)
      case 'cancel':
        return handleCancelSubscription(session.user.email)
      case 'purchase_chats':
        return handlePurchaseChats(session.user.email, data)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Subscription POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleCreateSubscription(userEmail: string, data: any) {
  const subscription = {
    id: 'sub_' + Math.random().toString(36).substr(2, 9),
    userId: userEmail,
    plan: data.plan || 'basic',
    locations: data.locations || 1,
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    chatsIncluded: (data.locations || 1) * 1000,
    chatsUsed: 0,
    chatsRemaining: (data.locations || 1) * 1000,
    autoReplenish: data.autoReplenish ?? true,
    replenishThreshold: data.replenishThreshold || 200,
    replenishAmount: data.replenishAmount || 1000,
    billingInfo: data.billingInfo,
    paymentMethod: data.paymentMethod,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  subscriptions.set(userEmail, subscription)

  // Initialize usage tracking
  usageData.set(userEmail, {
    dailyUsage: [],
    locationUsage: Array.from({ length: subscription.locations }, (_, i) => ({
      id: i + 1,
      name: `Location ${i + 1}`,
      chatsUsed: 0,
      chatsRemaining: 1000,
      lastActivity: new Date()
    })),
    totalChatsUsed: 0,
    purchases: []
  })

  return NextResponse.json({ 
    success: true, 
    subscription,
    message: 'Subscription created successfully. Your 7-day free trial has started!'
  })
}

async function handleUpdateSubscription(userEmail: string, data: any) {
  const subscription = subscriptions.get(userEmail)
  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const updatedSubscription = {
    ...subscription,
    ...data,
    updatedAt: new Date()
  }

  subscriptions.set(userEmail, updatedSubscription)

  return NextResponse.json({ 
    success: true, 
    subscription: updatedSubscription,
    message: 'Subscription updated successfully'
  })
}

async function handleCancelSubscription(userEmail: string) {
  const subscription = subscriptions.get(userEmail)
  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const updatedSubscription = {
    ...subscription,
    status: 'cancelled',
    cancelledAt: new Date(),
    updatedAt: new Date()
  }

  subscriptions.set(userEmail, updatedSubscription)

  return NextResponse.json({ 
    success: true, 
    subscription: updatedSubscription,
    message: 'Subscription cancelled successfully'
  })
}

async function handlePurchaseChats(userEmail: string, data: any) {
  const subscription = subscriptions.get(userEmail)
  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const { amount, price } = data
  const purchase = {
    id: 'purch_' + Math.random().toString(36).substr(2, 9),
    amount,
    price,
    date: new Date(),
    status: 'completed'
  }

  // Update subscription chat balance
  subscription.chatsRemaining += amount
  subscription.updatedAt = new Date()

  // Add to purchase history
  const usage = usageData.get(userEmail) || { purchases: [] }
  usage.purchases.unshift(purchase)
  usageData.set(userEmail, usage)

  subscriptions.set(userEmail, subscription)

  return NextResponse.json({ 
    success: true, 
    purchase,
    subscription,
    message: `Successfully purchased ${amount.toLocaleString()} chats for $${price}`
  })
}
