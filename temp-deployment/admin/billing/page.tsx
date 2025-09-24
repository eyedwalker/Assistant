'use client'

import React, { useState } from 'react'
import { 
  DollarSign, 
  Users, 
  MessageCircle, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Download, 
  Eye,
  CreditCard,
  FileText,
  Calendar,
  BarChart3
} from 'lucide-react'

const AdminBillingPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d')

  // Mock admin data - in production, fetch from API
  const [adminData] = useState({
    overview: {
      totalRevenue: 45280,
      activeSubscriptions: 156,
      totalChatsUsed: 124500,
      avgRevenuePerUser: 89.50
    },
    customers: [
      {
        id: 'cust_001',
        companyName: 'Vision Care Associates',
        email: 'admin@visioncare.com',
        plan: 'Premium',
        locations: 3,
        status: 'active',
        monthlyRevenue: 147,
        chatsUsed: 2850,
        chatsRemaining: 150,
        nextBilling: '2025-09-15',
        paymentMethod: 'credit-card',
        autoReplenish: true,
        lastLogin: '2025-08-28',
        joinDate: '2024-12-15'
      },
      {
        id: 'cust_002',
        companyName: 'Clear Sight Clinic',
        email: 'billing@clearsight.net',
        plan: 'Basic',
        locations: 1,
        status: 'trial',
        monthlyRevenue: 29,
        chatsUsed: 450,
        chatsRemaining: 550,
        nextBilling: '2025-09-02',
        paymentMethod: 'invoice',
        autoReplenish: false,
        lastLogin: '2025-08-27',
        joinDate: '2025-08-21'
      },
      {
        id: 'cust_003',
        companyName: 'Metro Eye Center',
        email: 'accounts@metroeyecenter.com',
        plan: 'Premium',
        locations: 5,
        status: 'active',
        monthlyRevenue: 245,
        chatsUsed: 4200,
        chatsRemaining: 800,
        nextBilling: '2025-09-10',
        paymentMethod: 'credit-card',
        autoReplenish: true,
        lastLogin: '2025-08-28',
        joinDate: '2024-11-03'
      },
      {
        id: 'cust_004',
        companyName: 'Family Optometry',
        email: 'info@familyoptometry.org',
        plan: 'Basic',
        locations: 2,
        status: 'past_due',
        monthlyRevenue: 58,
        chatsUsed: 1800,
        chatsRemaining: 200,
        nextBilling: '2025-08-25',
        paymentMethod: 'credit-card',
        autoReplenish: false,
        lastLogin: '2025-08-26',
        joinDate: '2025-01-18'
      }
    ],
    monthlyMetrics: [
      { month: 'Mar', revenue: 38500, customers: 142, chats: 98000 },
      { month: 'Apr', revenue: 41200, customers: 148, chats: 105000 },
      { month: 'May', revenue: 43800, customers: 151, chats: 112000 },
      { month: 'Jun', revenue: 45280, customers: 156, chats: 124500 },
      { month: 'Jul', revenue: 47100, customers: 160, chats: 131000 },
      { month: 'Aug', revenue: 49500, customers: 164, chats: 138500 }
    ]
  })

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      trial: 'bg-blue-100 text-blue-800',
      past_due: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`
  }

  const getPlanBadge = (plan: string) => {
    return plan === 'Premium' 
      ? 'bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium'
      : 'bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium'
  }

  const filteredCustomers = adminData.customers.filter(customer => {
    const matchesSearch = customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage Administration</h1>
          <p className="text-gray-600">Monitor customer subscriptions, usage patterns, and revenue metrics</p>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${adminData.overview.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+12.5% from last month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold text-gray-900">{adminData.overview.activeSubscriptions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-blue-600">
              <span>8 new this month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Chats Used</p>
                <p className="text-2xl font-bold text-gray-900">{adminData.overview.totalChatsUsed.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-purple-600">
              <span>This month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Revenue/User</p>
                <p className="text-2xl font-bold text-gray-900">${adminData.overview.avgRevenuePerUser}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-indigo-600">
              <span>Per month</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Revenue Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Revenue & Growth Trends</h3>
            <div className="space-y-4">
              {adminData.monthlyMetrics.map((month, index) => {
                const maxRevenue = Math.max(...adminData.monthlyMetrics.map(m => m.revenue))
                const percentage = (month.revenue / maxRevenue) * 100
                return (
                  <div key={index} className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600 w-8">{month.month}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-8 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="text-xs text-white font-medium">${month.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 w-16">{month.customers} customers</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                <Download className="h-5 w-5 mr-2" />
                Export Revenue Report
              </button>
              <button className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                <FileText className="h-5 w-5 mr-2" />
                Generate Invoices
              </button>
              <button className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                <Users className="h-5 w-5 mr-2" />
                Customer Analytics
              </button>
              <button className="w-full flex items-center justify-center border-2 border-gray-300 hover:border-blue-500 text-gray-700 hover:text-blue-700 font-medium py-3 px-4 rounded-lg transition-colors">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Past Due Alerts
              </button>
            </div>
          </div>
        </div>

        {/* Customer Management */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">Customer Subscriptions</h3>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Customer Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Usage</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Revenue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Next Billing</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{customer.companyName}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                        <div className="text-xs text-gray-400">{customer.locations} locations</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={getPlanBadge(customer.plan)}>{customer.plan}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={getStatusBadge(customer.status)}>
                        {customer.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{customer.chatsUsed.toLocaleString()} used</div>
                        <div className="text-gray-500">{customer.chatsRemaining.toLocaleString()} remaining</div>
                        {customer.autoReplenish && (
                          <div className="text-xs text-blue-600">Auto-replenish ON</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">${customer.monthlyRevenue}/mo</div>
                      <div className="text-xs text-gray-500">
                        {customer.paymentMethod === 'credit-card' ? 
                          <><CreditCard className="inline h-3 w-3 mr-1" />Card</> :
                          <><FileText className="inline h-3 w-3 mr-1" />Invoice</>
                        }
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{customer.nextBilling}</div>
                        <div className="text-xs text-gray-500">
                          Last login: {customer.lastLogin}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button className="text-blue-600 hover:text-blue-800 mr-3">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-800">
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No customers found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminBillingPage
