import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import RouteGuard from '../../components/RouteGuard'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../context/AuthContext'

export default function RazorpayPaymentsPage() {
  const { accessToken } = useAuth()
  const [activeTab, setActiveTab] = useState('transactions') // 'transactions' | 'webhooks'

  // Transactions State
  const [transactions, setTransactions] = useState([])
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    pending: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
    totalSuccessfulAmount: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters State
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 })

  // Modal / Detail State
  const [selectedTx, setSelectedTx] = useState(null)
  const [reconciling, setReconciling] = useState(false)
  const [reconcileNotice, setReconcileNotice] = useState('')

  // Webhook Logs State
  const [webhookLogs, setWebhookLogs] = useState([])
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookPage, setWebhookPage] = useState(1)
  const [webhookPagination, setWebhookPagination] = useState({ total: 0, page: 1, pages: 1 })

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        status: statusFilter,
        method: methodFilter,
        sortBy
      })
      const res = await fetch(`/api/admin/payments?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const resText = await res.text()
      let data = {}
      try { data = JSON.parse(resText) } catch (e) { data = { error: `Server error (Status ${res.status})` } }
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payments')

      setTransactions(data.transactions || [])
      setMetrics(data.metrics || metrics)
      setPagination(data.pagination || { total: 0, page: 1, pages: 1 })
    } catch (err) {
      console.error('Fetch payments error:', err)
      setError(err.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, search, statusFilter, methodFilter, sortBy])

  // Fetch Webhook Logs
  const fetchWebhookLogs = useCallback(async () => {
    if (!accessToken) return
    setWebhookLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/webhook-logs?page=${webhookPage}&limit=25`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const resText = await res.text()
      let data = {}
      try { data = JSON.parse(resText) } catch (e) { data = { error: `Server error (Status ${res.status})` } }
      if (!res.ok) throw new Error(data.error || 'Failed to fetch webhook logs')
      setWebhookLogs(data.logs || [])
      setWebhookPagination(data.pagination || { total: 0, page: 1, pages: 1 })
    } catch (err) {
      console.error('Fetch webhooks error:', err)
    } finally {
      setWebhookLoading(false)
    }
  }, [accessToken, webhookPage])

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions()
    } else {
      fetchWebhookLogs()
    }
  }, [activeTab, fetchTransactions, fetchWebhookLogs])

  // Manual Reconciliation Handler
  const handleReconcile = async (tx) => {
    if (!tx || !accessToken) return
    setReconciling(true)
    setReconcileNotice('')
    try {
      const res = await fetch('/api/razorpay/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          internalOrderId: tx.internalOrderId,
          paymentId: tx.paymentId,
          razorpayOrderId: tx.razorpayOrderId
        })
      })
      const resText = await res.text()
      let data = {}
      try { data = JSON.parse(resText) } catch (e) { data = { error: `Server error (Status ${res.status})` } }
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed')

      setReconcileNotice(`✅ Reconciled successfully! Status: ${data.status} (Razorpay: ${data.razorpayStatus})`)
      if (data.transaction) {
        setSelectedTx(data.transaction)
      }
      fetchTransactions()
    } catch (err) {
      setReconcileNotice(`⚠️ Reconciliation Error: ${err.message}`)
    } finally {
      setReconciling(false)
    }
  }

  const renderStatusBadge = (status) => {
    const st = (status || 'PENDING').toUpperCase()
    let bg = '#fef3c7'
    let color = '#b45309'
    let label = '⏳ PENDING'

    if (st === 'DONE' || st === 'CAPTURED' || st === 'PAID') {
      bg = '#e6f4ea'
      color = '#047857'
      label = '✓ DONE'
    } else if (st === 'FAILED') {
      bg = '#fce8e6'
      color = '#dc2626'
      label = '✕ FAILED'
    } else if (st === 'CANCELLED') {
      bg = '#f3f4f6'
      color = '#4b5563'
      label = '🚫 CANCELLED'
    }

    return (
      <span style={{ background: bg, color: color, padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.04em', display: 'inline-block' }}>
        {label}
      </span>
    )
  }

  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminLayout activePage="payments" title="Razorpay Payments">
        <Head>
          <title>Razorpay Payments | Biriyani Station Admin</title>
        </Head>

        <div className="admin-page-container" style={{ paddingBottom: '40px' }}>
          {/* HEADER & METRIC SUMMARY CARDS */}
          <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', color: 'var(--deep-green)', textTransform: 'uppercase' }}>
                  💳 FINANCIAL DESK
                </span>
                <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 900, color: 'var(--ink)', margin: '2px 0 0 0' }}>
                  Razorpay Payments
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--muted)', fontWeight: 600 }}>
                  Real-time transaction tracking, webhooks & automated reconciliation
                </p>
              </div>

              {/* Tab Switcher */}
              <div style={{ display: 'flex', background: '#fafaf5', padding: '4px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === 'transactions' ? 'var(--deep-green)' : 'transparent',
                    color: activeTab === 'transactions' ? '#ffffff' : 'var(--ink)',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💳 Transactions List
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('webhooks')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === 'webhooks' ? 'var(--deep-green)' : 'transparent',
                    color: activeTab === 'webhooks' ? '#ffffff' : 'var(--ink)',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📜 Webhook Logs
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div style={{ borderRadius: '12px', padding: '16px', background: '#fafaf5', border: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>
                  📊 TRANSACTIONS
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--ink)', marginTop: '4px' }}>
                  {metrics.totalTransactions}
                </div>
              </div>

              <div style={{ borderRadius: '12px', padding: '16px', background: '#e6f4ea', border: '1px solid rgba(4,120,87,0.2)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', display: 'block', textTransform: 'uppercase' }}>
                  ✓ DONE
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857', marginTop: '4px' }}>
                  {metrics.done}
                </div>
              </div>

              <div style={{ borderRadius: '12px', padding: '16px', background: '#fef3c7', border: '1px solid rgba(180,83,9,0.2)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#b45309', display: 'block', textTransform: 'uppercase' }}>
                  ⏳ PENDING
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#b45309', marginTop: '4px' }}>
                  {metrics.pending}
                </div>
              </div>

              <div style={{ borderRadius: '12px', padding: '16px', background: '#fce8e6', border: '1px solid rgba(220,38,38,0.2)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', display: 'block', textTransform: 'uppercase' }}>
                  ✕ FAILED
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', marginTop: '4px' }}>
                  {metrics.failed}
                </div>
              </div>

              <div style={{ borderRadius: '12px', padding: '16px', background: 'var(--deep-green)', color: '#ffffff', border: '1px solid var(--deep-green)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', display: 'block', textTransform: 'uppercase' }}>
                  💰 SUCCESSFUL REVENUE
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
                  ₹{metrics.totalSuccessfulAmount}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: TRANSACTIONS LIST */}
          {activeTab === 'transactions' && (
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              
              {/* SEARCH & FILTERS BAR */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ flex: '1 1 240px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search Payment ID, Order ID, Customer Name, Email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 36px',
                      borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.12)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit'
                    }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DONE">✓ Done</option>
                  <option value="PENDING">⏳ Pending</option>
                  <option value="FAILED">✕ Failed</option>
                  <option value="CANCELLED">🚫 Cancelled</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>

                <button
                  type="button"
                  onClick={fetchTransactions}
                  style={{ background: '#fafaf5', border: '1px solid rgba(0,0,0,0.12)', padding: '10px 14px', borderRadius: '12px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  🔄 Refresh
                </button>
              </div>

              {error && (
                <div style={{ background: '#fff5f5', color: '#c53030', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
                  ⚠️ {error}
                </div>
              )}

              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
                  ⏳ Loading payment records...
                </div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
                  No payment transactions matching your search criteria.
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW */}
                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#fafaf5', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th style={{ padding: '12px 16px' }}>Payment ID / Order</th>
                          <th style={{ padding: '12px 16px' }}>Customer</th>
                          <th style={{ padding: '12px 16px' }}>Amount</th>
                          <th style={{ padding: '12px 16px' }}>Method</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                          <th style={{ padding: '12px 16px' }}>Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx._id || tx.internalOrderId} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.15s ease' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <strong style={{ display: 'block', color: 'var(--deep-green)', fontSize: '0.88rem' }}>
                                {tx.paymentId || '—'}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Order: #{tx.internalOrderId}
                              </span>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <strong style={{ display: 'block', color: 'var(--ink)' }}>
                                {tx.customerName || 'Customer'}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {tx.customerPhone || tx.customerEmail || '—'}
                              </span>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <strong style={{ fontSize: '1rem', color: 'var(--ink)' }}>
                                ₹{tx.amount}
                              </strong>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ background: '#f0f4f1', color: '#0d5a3a', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                💳 {tx.paymentMethod || 'RAZORPAY'}
                              </span>
                            </td>

                            <td style={{ padding: '14px 16px' }}>
                              {renderStatusBadge(tx.status)}
                            </td>

                            <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: '0.78rem' }}>
                              {new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>

                            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => { setSelectedTx(tx); setReconcileNotice(''); }}
                                style={{ background: 'var(--deep-green)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                              >
                                Details →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION CONTROLS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Page {pagination.page} of {pagination.pages} ({pagination.total} transactions)
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage(prev => prev - 1)}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: page <= 1 ? '#f3f4f6' : '#ffffff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
                      >
                        ← Prev
                      </button>

                      <button
                        type="button"
                        disabled={page >= pagination.pages}
                        onClick={() => setPage(prev => prev + 1)}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: page >= pagination.pages ? '#f3f4f6' : '#ffffff', cursor: page >= pagination.pages ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.8rem' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: WEBHOOK LOGS */}
          {activeTab === 'webhooks' && (
            <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid rgba(13,90,58,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, fontFamily: '"Playfair Display", serif' }}>
                  Razorpay Webhook Event Audit Logs
                </h3>
                <button
                  type="button"
                  onClick={fetchWebhookLogs}
                  style={{ background: '#fafaf5', border: '1px solid rgba(0,0,0,0.12)', padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  🔄 Refresh Logs
                </button>
              </div>

              {webhookLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
                  ⏳ Fetching webhook event audit logs...
                </div>
              ) : webhookLogs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
                  No webhook events received yet. Point your Razorpay Dashboard Webhook URL to <code>/api/razorpay/webhook</code>.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#fafaf5', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 14px' }}>Event ID</th>
                        <th style={{ padding: '10px 14px' }}>Event Type</th>
                        <th style={{ padding: '10px 14px' }}>Target Order ID</th>
                        <th style={{ padding: '10px 14px' }}>Status</th>
                        <th style={{ padding: '10px 14px' }}>Received At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookLogs.map((log) => (
                        <tr key={log._id || log.eventId} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--deep-green)' }}>
                            {log.eventId}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                            <code>{log.eventType}</code>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {log.internalOrderId ? `#${log.internalOrderId}` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: log.processingStatus === 'PROCESSED' ? '#e6f4ea' : log.processingStatus === 'DUPLICATE' ? '#fef3c7' : '#fce8e6',
                              color: log.processingStatus === 'PROCESSED' ? '#047857' : log.processingStatus === 'DUPLICATE' ? '#b45309' : '#dc2626',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 900
                            }}>
                              {log.processingStatus}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                            {new Date(log.receivedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TRANSACTION DETAIL MODAL */}
          {selectedTx && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
              <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' }}>
                
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', letterSpacing: '0.1em' }}>
                      TRANSACTION DETAILS
                    </span>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--ink)', margin: '2px 0 0 0' }}>
                      #{selectedTx.internalOrderId}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTx(null)}
                    style={{ background: '#f3f4f6', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, fontSize: '1rem' }}
                  >
                    ✕
                  </button>
                </div>

                {reconcileNotice && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '16px', fontWeight: 700 }}>
                    {reconcileNotice}
                  </div>
                )}

                {/* Key Attributes Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ background: '#fafaf5', padding: '12px 14px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 800 }}>AMOUNT</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: 'var(--deep-green)' }}>₹{selectedTx.amount}</p>
                  </div>
                  <div style={{ background: '#fafaf5', padding: '12px 14px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 800 }}>STATUS</span>
                    <div style={{ marginTop: '4px' }}>{renderStatusBadge(selectedTx.status)}</div>
                  </div>
                  <div style={{ background: '#fafaf5', padding: '12px 14px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 800 }}>RAZORPAY STATUS</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.9rem', fontWeight: 800, textTransform: 'capitalize' }}>{selectedTx.razorpayStatus || '—'}</p>
                  </div>
                </div>

                {/* Technical Credentials & Customer Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '14px' }}>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>💳 RAZORPAY IDS</strong>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem' }}>Payment ID: <strong style={{ color: 'var(--deep-green)' }}>{selectedTx.paymentId || 'Pending'}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>Order ID: <strong>{selectedTx.razorpayOrderId || '—'}</strong></p>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '14px' }}>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>👤 CUSTOMER INFO</strong>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 800 }}>{selectedTx.customerName || 'Customer'}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>{selectedTx.customerPhone || selectedTx.customerEmail || 'No contact provided'}</p>
                  </div>
                </div>

                {/* Failure Details (If Failed) */}
                {selectedTx.status === 'FAILED' && (
                  <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', padding: '14px', borderRadius: '14px', marginBottom: '20px' }}>
                    <strong style={{ color: '#c53030', fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>⚠️ FAILURE INFORMATION</strong>
                    <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: '#9b2c2c' }}>Code: <code>{selectedTx.failureCode || 'UNKNOWN'}</code></p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#9b2c2c' }}>Reason: {selectedTx.failureReason || 'Payment failed on gateway or was cancelled by user.'}</p>
                  </div>
                )}

                {/* Event History Timeline */}
                <div style={{ marginBottom: '24px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--ink)', display: 'block', marginBottom: '10px' }}>
                    ⏱️ Chronological Event Timeline
                  </strong>
                  <div style={{ borderLeft: '2px solid rgba(13,90,58,0.2)', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedTx.timeline && selectedTx.timeline.length > 0 ? (
                      selectedTx.timeline.map((evt, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-19px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--deep-green)' }} />
                          <strong style={{ fontSize: '0.8rem', color: 'var(--ink)', display: 'block' }}>{evt.event}</strong>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>{evt.notes}</p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', opacity: 0.8 }}>
                            {new Date(evt.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })} · Source: {evt.source || 'SYSTEM'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>No timeline events recorded yet.</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => handleReconcile(selectedTx)}
                    disabled={reconciling}
                    style={{ background: 'var(--deep-green)', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.84rem', cursor: reconciling ? 'not-allowed' : 'pointer' }}
                  >
                    {reconciling ? '🔄 Reconciling...' : '🔄 Reconcile with Razorpay API'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTx(null)}
                    style={{ background: '#f3f4f6', color: 'var(--ink)', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  )
}
