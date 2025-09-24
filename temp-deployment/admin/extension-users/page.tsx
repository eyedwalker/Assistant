'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ExtensionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  extensionActivatedAt: string;
  lastLogin?: string;
  accessCode?: string;
}

export default function ExtensionUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<ExtensionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserAccessCode, setNewUserAccessCode] = useState('BETA2024');
  const [addingUser, setAddingUser] = useState(false);

  // Admin emails who can access this page
  const ADMIN_EMAILS = ['admin@vsp.com', 'daviwa2@vsp.com'];

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      router.push('/');
      return;
    }

    fetchUsers();
  }, [session, status]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/extension/users');
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError('Failed to load extension users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail) {
      setError('Email is required');
      return;
    }

    try {
      setAddingUser(true);
      setError('');
      
      const response = await fetch('/api/extension/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          accessCode: newUserAccessCode
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add user');
      }

      // Reset form and refresh list
      setNewUserEmail('');
      setNewUserName('');
      setNewUserAccessCode('BETA2024');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!confirm(`Remove extension access for ${email}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/extension/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Failed to remove user');
      }

      await fetchUsers();
    } catch (err) {
      setError('Failed to remove user');
      console.error(err);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">👥 Extension Users Management</h1>
            <p className="text-gray-600">Manage users who can access the browser extension</p>
          </div>
          <Link
            href="/"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center space-x-2"
          >
            <span>←</span>
            <span>Back to Menu</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Add User Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add Extension User</h2>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Code
              </label>
              <input
                type="text"
                value={newUserAccessCode}
                onChange={(e) => setNewUserAccessCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="BETA2024"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={addingUser}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingUser ? 'Adding...' : 'Add User'}
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">
            Extension Users ({users.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.accessCode || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.extensionActivatedAt 
                      ? new Date(user.extensionActivatedAt).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin 
                      ? new Date(user.lastLogin).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No extension users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Extension Setup Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Add user email to the allowed list above</li>
          <li>Share the access code with the user</li>
          <li>User installs the browser extension</li>
          <li>User clicks extension icon and logs in with email and access code</li>
          <li>Extension will be activated and ready to use</li>
        </ol>
        <p className="mt-4 text-sm text-gray-600">
          <strong>Note:</strong> Users must have the exact email address listed above to access the extension.
        </p>
      </div>
    </div>
  );
}
