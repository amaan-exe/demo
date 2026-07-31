import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
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
    getDocs(collection(db, 'users')).then(snap => {
      setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(err => console.warn('Users fetch notice:', err.message))
  }, [user])

  const handleToggleBlock = async (usr) => {
    try {
      const nextBlocked = !usr.isBlocked
      setUsersList(prev => prev.map(u => u.id === usr.id ? { ...u, isBlocked: nextBlocked } : u))
      await updateDoc(doc(db, 'users', usr.id), { isBlocked: nextBlocked })
    } catch (e) {
      alert('Error updating block status: ' + e.message)
    }
  }

  const handleChangeUserRole = async (usr, newRole) => {
    try {
      setUsersList(prev => prev.map(u => u.id === usr.id ? { ...u, role: newRole } : u))
      await updateDoc(doc(db, 'users', usr.id), { role: newRole })
    } catch (e) {
      alert('Error updating role: ' + e.message)
    }
  }

  if (!user || !isAdmin) return null

  // Filter users by search and role
  const filteredUsers = usersList.filter(u => {
    const r = (u.role || 'customer').toLowerCase()
    if (roleFilter !== 'all') {
      if (roleFilter === 'admin' && r !== 'admin') return false
      if (roleFilter === 'staff' && r !== 'staff') return false
      if (roleFilter === 'delivery' && r !== 'delivery') return false
      if (roleFilter === 'customer' && r !== 'customer') return false
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

  const adminCount = usersList.filter(u => (u.role || '').toLowerCase() === 'admin').length
  const staffCount = usersList.filter(u => (u.role || '').toLowerCase() === 'staff').length
  const deliveryCount = usersList.filter(u => (u.role || '').toLowerCase() === 'delivery').length
  const customerCount = usersList.filter(u => !(u.role) || (u.role || '').toLowerCase() === 'customer').length
  const blockedCount = usersList.filter(u => u.isBlocked).length

  return (
    <AdminLayout activePage="users" title="User Management & Roles">
      <div className="admin-page-container">
        {/* EXECUTIVE CONTROL CARD FOR USER DIRECTORY */}
        <div className="admin-control-hero-card">
          <div className="admin-orders-header">
            <div className="admin-title-area">
              <span className="admin-sync-pill">REGISTERED ACCOUNTS & ROLES</span>
              <h1>User & Role Directory</h1>
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
                👥 ALL ({usersList.length})
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
                className={`status-counter-btn ${roleFilter === 'staff' ? 'active' : ''}`}
                onClick={() => setRoleFilter('staff')}
              >
                🍳 KITCHEN STAFF <span className="status-count-badge">{staffCount}</span>
              </button>

              <button
                type="button"
                className={`status-counter-btn ${roleFilter === 'delivery' ? 'active' : ''}`}
                onClick={() => setRoleFilter('delivery')}
              >
                🛵 DELIVERY PARTNERS <span className="status-count-badge">{deliveryCount}</span>
              </button>

              <button
                type="button"
                className={`status-counter-btn ${roleFilter === 'customer' ? 'active' : ''}`}
                onClick={() => setRoleFilter('customer')}
              >
                🍔 CUSTOMERS <span className="status-count-badge">{customerCount}</span>
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
              {filteredUsers.map(u => {
                const currentRole = (u.role || 'customer').toLowerCase()
                return (
                  <div key={u.id} className="adm-user-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                    <div className="user-card-top">
                      <div className="user-info-meta">
                        <strong>{u.name || 'Foodie Customer'}</strong>
                        <span>{u.email}</span>
                        {u.phone && <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>📞 {u.phone}</span>}
                      </div>

                      <span className={`user-role-badge ${currentRole}`}>
                        {currentRole === 'admin' ? '🛡️ Admin' : currentRole === 'staff' ? '🍳 Staff' : currentRole === 'delivery' ? '🛵 Delivery' : '👤 Customer'}
                      </span>
                    </div>

                    {/* Role Dropdown Selector & Status Controls */}
                    <div className="user-card-bot" style={{ flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--muted)' }}>Role:</span>
                        <select
                          value={currentRole}
                          onChange={(e) => handleChangeUserRole(u, e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0,0,0,0.15)',
                            background: '#ffffff',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            color: 'var(--ink)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="customer">👤 Customer</option>
                          <option value="staff">🍳 Staff (Kitchen)</option>
                          <option value="delivery">🛵 Delivery Partner</option>
                          <option value="admin">🛡️ Admin</option>
                        </select>
                      </div>

                      <div className="user-action-btns">
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
