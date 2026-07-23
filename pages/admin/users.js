import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'

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

  if (!user || !isAdmin) return <div style={{ padding: '60px', textAlign: 'center' }}>Admin access required. <Link href="/admin">Go to Portal</Link></div>

  return (
    <>
      <Head><title>User Management | Biriyani Station Admin</title></Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5f0' }}>
        <aside style={{ width: '260px', background: '#092419', color: '#ffffff', padding: '32px 20px', position: 'sticky', top: 0, height: '100vh' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: '#ffffff', marginBottom: '24px' }}>Admin Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href="/admin" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>📊 Dashboard</Link>
            <Link href="/admin/orders" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🛵 Orders Desk</Link>
            <Link href="/admin/menu" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🍲 Menu Items</Link>
            <Link href="/admin/coupons" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>🏷️ Coupons</Link>
            <Link href="/admin/users" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--yellow)', color: 'var(--ink)', fontWeight: 800, textDecoration: 'none' }}>👥 Users ({usersList.length})</Link>
            <Link href="/admin/settings" style={{ padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>⚙️ Settings</Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: '40px' }}>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '2.4rem', fontWeight: 900, marginBottom: '24px' }}>User Management</h1>

          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '1px solid rgba(13,90,58,0.1)' }}>
            {usersList.length === 0 ? <p style={{ color: 'var(--muted)' }}>No users registered yet.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #eee', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px' }}>USER</th>
                    <th style={{ padding: '12px' }}>EMAIL</th>
                    <th style={{ padding: '12px' }}>ROLE</th>
                    <th style={{ padding: '12px' }}>STATUS</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px', fontWeight: 800 }}>{u.name || 'User'}</td>
                      <td style={{ padding: '12px' }}>{u.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: u.role === 'admin' ? 'var(--yellow)' : '#eee', color: 'var(--ink)', fontWeight: 800, fontSize: '0.75rem' }}>
                          {u.role || 'customer'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: u.isBlocked ? '#dc2626' : 'var(--deep-green)', fontWeight: 800 }}>
                          {u.isBlocked ? '🔴 Blocked' : '🟢 Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button onClick={() => handleToggleAdminRole(u)} style={{ background: 'none', border: 'none', color: 'var(--deep-green)', fontWeight: 800, cursor: 'pointer', marginRight: '12px' }}>
                          {u.role === 'admin' ? 'Demote to Customer' : 'Promote to Admin'}
                        </button>
                        <button onClick={() => handleToggleBlock(u)} style={{ background: 'none', border: 'none', color: u.isBlocked ? 'var(--deep-green)' : '#dc2626', fontWeight: 800, cursor: 'pointer' }}>
                          {u.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
