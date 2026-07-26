import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

export default function AdminUsersDesk() {
  const { user, isAdmin } = useAuth()
  const [usersList, setUsersList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsersList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const handleToggleBlock = async (usr) => {
    try {
      await updateDoc(doc(db, 'users', usr.id), { isBlocked: !usr.isBlocked })
    } catch (e) {
      alert('Error updating block status: ' + e.message)
    }
  }

  const handleToggleAdminRole = async (usr) => {
    const newRole = usr.role === 'admin' ? 'customer' : 'admin'
    try {
      await updateDoc(doc(db, 'users', usr.id), { role: newRole })
    } catch (e) {
      alert('Error updating role: ' + e.message)
    }
  }

  if (!user || !isAdmin) return null

  // Filter users by search and role
  const filteredUsers = usersList.filter(u => {
    if (roleFilter !== 'all') {
      if (roleFilter === 'admin' && u.role !== 'admin') return false
      if (roleFilter === 'customer' && u.role === 'admin') return false
      if (roleFilter === 'blocked' && !u.isBlocked) return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = (u.name || '').toLowerCase().includes(q)
      const emailMatch = (u.email || '').toLowerCase().includes(q)
      const phoneMatch = (u.phone || '').toLowerCase().includes(q)
      return nameMatch || emailMatch || phoneMatch
    }
    return true
  })

  const adminCount = usersList.filter(u => u.role === 'admin').length
  const blockedCount = usersList.filter(u => u.isBlocked).length

  return (
    <AdminLayout activePage="users" title="Customer Management">
      <div className="admin-page-container">
        {/* EXECUTIVE CONTROL CARD FOR USER DIRECTORY */}
        <div className="admin-control-hero-card">
          <div className="admin-orders-header">
            <div className="admin-title-area">
              <span className="admin-sync-pill">REGISTERED ACCOUNTS & ROLES</span>
              <h1>User Directory</h1>
            </div>

            {/* Search Input Box */}
            <div className="admin-search-box">
              <span className="admin-search-icon">🔍</span>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search user by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Role & Status Filter Tabs */}
          <div className="status-filter-wrapper-container">
            <div className="status-filter-wrapped" role="tablist">
              <button
                type="button"
                className={`status-counter-btn ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                👥 ALL USERS <span className="status-count-badge">{usersList.length}</span>
              </button>

              <button
                type="button"
                className={`status-counter-btn ${roleFilter === 'admin' ? 'active' : ''}`}
                onClick={() => setRoleFilter('admin')}
              >
                🛡️ ADMINS <span className="status-count-badge">{adminCount}</span>
              </button>

              <button
                type="button"
                className={`status-counter-btn ${roleFilter === 'customer' ? 'active' : ''}`}
                onClick={() => setRoleFilter('customer')}
              >
                🍔 CUSTOMERS <span className="status-count-badge">{usersList.length - adminCount}</span>
              </button>

              <button
                type="button"
                className={`status-counter-btn ${blockedCount > 0 ? 'has-action' : ''} ${roleFilter === 'blocked' ? 'active' : ''}`}
                onClick={() => setRoleFilter('blocked')}
              >
                🔴 BLOCKED <span className="status-count-badge">{blockedCount}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="adm-section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              Showing {filteredUsers.length} of {usersList.length} Accounts
            </h3>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--deep-green)', fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }}
              >
                Clear Search ✕
              </button>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <p className="empty-msg">No matching user accounts found.</p>
          ) : (
            <div className="user-cards-grid">
              {filteredUsers.map(u => (
                <div key={u.id} className="adm-user-card">
                  <div className="user-card-top">
                    <div className="user-info-meta">
                      <strong>{u.name || 'Foodie Customer'}</strong>
                      <span>{u.email}</span>
                      {u.phone && <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>📞 {u.phone}</span>}
                    </div>

                    <span className={`user-role-badge ${u.role === 'admin' ? 'admin' : 'customer'}`}>
                      {u.role === 'admin' ? '🛡️ Admin' : '👤 Customer'}
                    </span>
                  </div>

                  <div className="user-card-bot">
                    <span className={`user-status-text ${u.isBlocked ? 'blocked' : 'active'}`}>
                      {u.isBlocked ? '🔴 Blocked' : '🟢 Active'}
                    </span>

                    <div className="user-action-btns">
                      <button
                        type="button"
                        onClick={() => handleToggleAdminRole(u)}
                        className="user-role-btn"
                      >
                        {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBlock(u)}
                        className={`user-block-btn ${u.isBlocked ? 'unblock' : 'block'}`}
                      >
                        {u.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
