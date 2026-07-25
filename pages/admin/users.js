import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AdminLayout from '../../components/AdminLayout'

export default function AdminUsersDesk() {
  const { user, isAdmin } = useAuth()
  const [usersList, setUsersList] = useState([])

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

  return (
    <AdminLayout activePage="users" title="Customer Management">
      <div className="admin-page-container">
        <header className="admin-page-header">
          <div>
            <span className="admin-sub-tag">REGISTERED ACCOUNTS</span>
            <h1 className="admin-page-h1">User Management</h1>
          </div>
        </header>

        <div className="adm-section-card">
          <h3>Customer Roster ({usersList.length})</h3>
          {usersList.length === 0 ? (
            <p className="empty-msg">No users registered yet.</p>
          ) : (
            <div className="user-cards-grid">
              {usersList.map(u => (
                <div key={u.id} className="adm-user-card">
                  <div className="user-card-top">
                    <div className="user-info-meta">
                      <strong>{u.name || 'User'}</strong>
                      <span>{u.email}</span>
                    </div>

                    <span className={`user-role-badge ${u.role === 'admin' ? 'admin' : 'customer'}`}>
                      {u.role || 'customer'}
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
