import { useState, useEffect } from 'react';
import { CreditCard, Activity, Users, Shield, Plus, IndianRupee, Bell, RefreshCw, FileText, CheckCircle, XCircle, Menu, X } from 'lucide-react';
import api from '../api';
import { Scanner } from '@yudiel/react-qr-scanner';
import CustomDropdown from '../components/CustomDropdown';

export default function Dashboard({ user, onLogout }) {
    const [profile, setProfile] = useState(null);
    const [cards, setCards] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState(null);
    const [merchants, setMerchants] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('overview'); // overview, cards, pay, users, profile
    const [showCardForm, setShowCardForm] = useState(false);
    const [newCardForm, setNewCardForm] = useState({ type: 'Virtual', limit: 5000 });
    const [paymentForm, setPaymentForm] = useState({ merchant_id: '', amount: '', card_id: '' });
    const [paymentStep, setPaymentStep] = useState(1);
    const [message, setMessage] = useState('');
    const [profileForm, setProfileForm] = useState({ phone: '', address: '', avatar: '' });
    const [paymentMethod, setPaymentMethod] = useState('direct');
    const [paymentIdentifier, setPaymentIdentifier] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [userSearch, setUserSearch] = useState('');

    const loadData = async () => {
        try {
            const res = await api.get('/dashboard/full');
            const data = res.data;
            
            setProfile(data.profile);
            if (data.profile) {
                setProfileForm({ 
                    phone: data.profile.phone || '', 
                    address: data.profile.address || '', 
                    avatar: data.profile.avatar || '' 
                });
            }
            setNotifications(data.notifications || []);

            if (user.role === 'Admin') {
                setStats(data.stats);
                setTransactions(data.transactions || []);
                setAdminUsers(data.users || []);
                setCards(data.cards || []);
            } else if (user.role === 'Customer') {
                setCards(data.cards || []);
                setTransactions(data.transactions || []);
                setMerchants(data.merchants || []);
                if (data.cards?.length > 0) {
                    setPaymentForm(p => ({ ...p, card_id: data.cards[0].id }));
                }
            } else if (user.role === 'Merchant') {
                setTransactions(data.transactions || []);
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                onLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user, view]); // Reload when view changes for freshness

    useEffect(() => {
        document.title = `${view.charAt(0).toUpperCase() + view.slice(1)} - NexusPay Dashboard`;
    }, [view]);

    const handleReadNotifs = async () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications && notifications.filter(n => !n.read).length > 0) {
            await api.put('/notifications');
            loadData();
        }
    };

    const showMsg = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    const handleIssueCard = async (e) => {
        e.preventDefault();
        try {
            await api.post('/cards', { type: newCardForm.type, spending_limit: newCardForm.limit });
            loadData();
            setShowCardForm(false);
            showMsg('Card Allocation Requested Successfully!');
        } catch (e) { showMsg('Failed to issue card.'); }
    };

    const handleRepay = async (cardId, amountOwed) => {
        const repayAmount = prompt(`You have an outstanding borrowed balance of ₹${amountOwed.toFixed(2)}. Enter amount to repay:`, amountOwed);
        if (!repayAmount || isNaN(repayAmount)) return;

        try {
            await api.post(`/cards/${cardId}/repay`, { amount: parseFloat(repayAmount) });
            loadData();
            showMsg('Payment applied successfully! Debt cleared.');
        } catch (e) { showMsg(e.response?.data?.message || 'Repayment failed.'); }
    };

    const handleCardUpdate = async (cardId, action) => {
        try {
            if (action === 'delete') {
                await api.delete(`/cards/${cardId}`);
                showMsg('Card Removed.');
            } else if (action === 'freeze') {
                await api.put(`/cards/${cardId}`, { status: 'Frozen' });
                showMsg('Card Frozen Successfully.');
            } else if (action === 'activate') {
                await api.put(`/cards/${cardId}`, { status: 'Active' });
                showMsg('Card Activated Successfully.');
            }
            loadData();
        } catch (e) { showMsg(e.response?.data?.message || 'Update failed'); }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/transactions', paymentForm);
            showMsg(`Paid ₹${res.data.transaction.amount} successfully!`);
            setPaymentForm(prev => ({ merchant_id: '', amount: '', card_id: prev.card_id, qr_parsed: null }));
            setPaymentIdentifier('');
            setPaymentStep(1);
            loadData();
        } catch (err) {
            showMsg(err.response?.data?.message || 'Payment processing failed.');
        }
    };

    const handleRefund = async (txId) => {
        try {
            const res = await api.post(`/transactions/${txId}/refund`);
            loadData();
            showMsg(res.data.message);
        } catch (err) {
            showMsg(err.response?.data?.message || 'Refund processing failed.');
        }
    };

    const handleUserUpdate = async (userId, data) => {
        try {
            await api.put(`/admin/users/${userId}`, data);
            loadData();
            showMsg('User account updated!');
        } catch (err) { showMsg('Failed to update user.'); }
    };

    const updateProfile = async (e) => {
        e.preventDefault();
        try {
            await api.put('/users/profile', { kyc_document: "uploaded_base64_blob" });
            loadData();
            showMsg("KYC Document Uploaded and under review");
        } catch (e) { showMsg("Profile update failed"); }
    }

    const handleViewUserDetails = async (usr) => {
        setSelectedUser(usr);
        setUserDetails(null);
        setView('user_details');
        try {
            const res = await api.get(`/admin/users/${usr.id}/details`);
            setUserDetails(res.data);
        } catch (e) { showMsg("Failed to load detailed analytics"); }
    }

    const handleProfileSave = async (e) => {
        e.preventDefault();
        try {
            await api.put('/users/profile', profileForm);
            loadData();
            showMsg("Profile details updated securely.");
        } catch (e) { showMsg("Failed to update profile."); }
    }

    const handleAvatarDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 250;
                    const MAX_HEIGHT = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    setProfileForm(prev => ({ ...prev, avatar: dataUrl }));
                    try {
                        await api.put('/users/profile', { avatar: dataUrl });
                        loadData();
                        showMsg("Profile Avatar saved and updated instantly.");
                    } catch (err) {
                        showMsg("Failed to auto-save avatar.");
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    const preventDrag = (e) => e.preventDefault();

    if (loading || !profile) return <div style={{ padding: '40px', textAlign: 'center', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw className="animate-pulse" size={40} color="var(--accent)" /></div>;

    return (
        <div className="dashboard-layout animate-fade-in">
            <div className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{ overflowY: 'auto' }}>
                <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src="/logo.jpeg" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            NexusPay
                        </h2>
                        <div style={{ fontSize: '0.8rem', color: profile.status === 'Active' ? 'var(--success)' : 'var(--danger)', marginTop: '5px' }}>
                            {user.role} | {profile.status}
                        </div>
                    </div>
                    <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <div className="sidebar-links-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>

                    <button className={`sidebar-link ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                        <Activity size={20} /> Overview Hub
                    </button>

                    {user.role === 'Customer' && (
                        <>
                            <button className={`sidebar-link ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                                <CreditCard size={20} /> Wallet & Cards
                            </button>
                            <button className={`sidebar-link ${view === 'pay' ? 'active' : ''}`} onClick={() => setView('pay')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                                <IndianRupee size={20} /> Send Payment
                            </button>
                        </>
                    )}
                    {user.role === 'Admin' && (
                        <>
                            <button className={`sidebar-link ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                                <Users size={20} /> System Users
                            </button>
                            <button className={`sidebar-link ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                                <CreditCard size={20} /> Global Cards
                            </button>
                        </>
                    )}

                    {(user.role === 'Customer' || user.role === 'Admin') && (
                        <button className={`sidebar-link ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                            <FileText size={20} /> {user.role === 'Customer' ? 'Identity & KYC' : 'Profile Settings'}
                        </button>
                    )}

                    {user.role === 'Merchant' && (
                        <button className={`sidebar-link ${view === 'transactions' ? 'active' : ''}`} onClick={() => setView('transactions')} style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', width: '100%' }}>
                            <FileText size={20} /> Invoices & Refunds
                        </button>
                    )}
                </div>
            </div>

            <div className="main-content">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1>{view === 'overview' ? 'Dashboard Overview' : view === 'cards' ? 'Card Operations' : view === 'pay' ? 'Process Secure Payment' : view === 'users' ? 'User Administration' : view === 'transactions' ? 'Transaction Log' : 'Profile Settings'}</h1>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {user.role !== 'Admin' && (
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Available This Month</div>
                                <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                                    ₹{user.role === 'Customer'
                                        ? (cards.filter(c => c.status === 'Active').reduce((sum, card) => sum + card.balance, 0)).toFixed(2)
                                        : profile.balance.toFixed(2)}
                                </span>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', opacity: 0.8 }}>
                                    Next Resupply: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                                </div>
                                {user.role === 'Customer' && (cards.reduce((sum, c) => sum + (c.debt || 0), 0) > 0) && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>
                                        Outstanding Debt: ₹{cards.reduce((sum, c) => sum + (c.debt || 0), 0).toFixed(2)}
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ position: 'relative' }}>
                            <Bell size={24} style={{ color: notifications.filter(n => !n.read).length > 0 ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', marginTop: '5px' }} onClick={handleReadNotifs} />
                            {notifications.filter(n => !n.read).length > 0 && <span style={{ position: 'absolute', top: -0, right: -5, background: 'var(--danger)', color: 'white', fontSize: '10px', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifications.filter(n => !n.read).length}</span>}
                            {showNotifications && (
                                <div className="glass-panel nav-dropdown notif-panel">
                                    <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>System Notifications</div>
                                    {notifications.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications</div> : (
                                        <div style={{ padding: '10px' }}>
                                            {notifications.map(n => (
                                                <div key={n.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: n.type === 'warning' ? 'var(--danger)' : n.type === 'success' ? 'var(--success)' : 'white' }}>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '5px' }}>{new Date(n.date).toLocaleString()}</div>
                                                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{n.message}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '5px 15px', borderRadius: '30px', border: '1px solid var(--border-color)', transition: '0.2s' }}>
                                {profile.avatar ? <img src={profile.avatar} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 30, height: 30, background: 'var(--primary-glow)', borderRadius: '50%' }}></div>}
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{profile.name}</span>
                            </div>
                            {showProfileMenu && (
                                <div className="glass-panel nav-dropdown profile-panel">
                                    {user.role === 'Customer' && (
                                        <>
                                            <button onClick={() => { setView('profile'); setShowProfileMenu(false); }} style={{ width: '100%', padding: '10px 20px', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Profile Details</button>
                                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '5px 0' }}></div>
                                        </>
                                    )}
                                    <button onClick={onLogout} style={{ width: '100%', padding: '10px 20px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Logout Session</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {view === 'overview' && (
                    <>
                        {user.role === 'Admin' && stats && (
                            <div className="grid grid-cols-4" style={{ marginBottom: '40px' }}>
                                <div className="glass-panel">
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Total Processing Vol</div>
                                    <h2>₹{stats.total_revenue_processed.toFixed(2)}</h2>
                                </div>
                                <div className="glass-panel">
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Platform Users</div>
                                    <h2>{stats.total_active_users}</h2>
                                </div>
                                <div className="glass-panel">
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Active Cards</div>
                                    <h2>{stats.total_active_cards}</h2>
                                </div>
                                <div className="glass-panel">
                                    <div style={{ fontSize: '0.9rem', color: 'var(--danger)', marginBottom: '10px' }}>Fraud Flags Today</div>
                                    <h2>{stats.flagged_transactions}</h2>
                                </div>

                                <div className="glass-panel admin-stat-huge" style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px', fontWeight: 600 }}>Total Credit Extended By Platform</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px', flexWrap: 'wrap' }}>
                                        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: 0 }}>₹{stats.total_credit_extended.toFixed(2)}</h2>
                                        <div style={{ color: 'var(--text-muted)', paddingBottom: '6px' }}>Across {stats.total_active_cards} cards</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#ffab00', marginTop: '10px' }}>
                                        Currently Owed by Users: <strong>₹{stats.total_owed_back.toFixed(2)}</strong>
                                    </div>
                                </div>

                                <div className="glass-panel admin-stat-huge" style={{ background: 'rgba(46, 213, 115, 0.05)', border: '1px solid rgba(46, 213, 115, 0.2)' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--success)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px', fontWeight: 600 }}>Money Successfully Recovered</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
                                        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', marginBottom: 0, color: 'var(--success)', wordBreak: 'break-all' }}>₹{stats.total_repaid_historically?.toFixed(2) || '0.00'}</h2>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                                        Total liquid cash users have settled back to NexusPay to clear their debts historically.
                                    </div>
                                </div>
                            </div>
                        )}

                        {user.role === 'Admin' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Platform User Directory</h3>
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid rgba(0, 229, 255, 0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', width: '300px' }}
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-4" style={{ gap: '15px' }}>
                                    {adminUsers.filter(u => u.role !== 'Admin' && (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))).map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => handleViewUserDetails(u)}
                                            style={{ padding: '20px', background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.05)'; e.currentTarget.style.transform = 'none'; }}
                                        >
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginTop: '10px' }}>{u.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email}</div>
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.status === 'Active' ? 'var(--success)' : 'var(--danger)' }}></div>
                                                <span style={{ fontSize: '0.8rem', color: u.status === 'Active' ? 'var(--success)' : 'var(--danger)' }}>{u.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {adminUsers.filter(u => u.role !== 'Admin' && (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))).length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found matching your search.</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0 }}>Recent Activity Feed</h3>
                                </div>
                                <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                                    {transactions.length === 0 ? (
                                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found</div>
                                    ) : (
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>TX Ref</th>
                                                    <th>Type</th>
                                                    <th>Participant</th>
                                                    <th>Amount</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                    {user.role !== 'Customer' && <th>Action</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.slice(0, 10).map(tx => (
                                                    <tr key={tx.id}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.9em', color: 'var(--text-muted)' }}>{tx.id.substring(0, 8).toUpperCase()}</td>
                                                        <td>{tx.type}</td>
                                                        <td>{tx.merchant_id === user.id ? tx.customer_name : tx.merchant_name}</td>
                                                        <td style={{ fontWeight: 600, color: (tx.merchant_id === user.id && tx.type === 'Payment') || (tx.customer_id === user.id && tx.type === 'Refund') ? 'var(--success)' : '#fff' }}>
                                                            {(tx.merchant_id === user.id && tx.type === 'Payment') || (tx.customer_id === user.id && tx.type === 'Refund') ? '+' : '-'}₹{tx.amount.toFixed(2)}
                                                        </td>
                                                        <td>{new Date(tx.date).toLocaleDateString()}</td>
                                                        <td>
                                                            <span className={`badge ${tx.status === 'Completed' ? 'badge-success' : tx.status === 'Flagged' ? 'badge-danger' : 'badge-warning'}`}>{tx.status}</span>
                                                        </td>
                                                        {user.role !== 'Customer' && (
                                                            <td>
                                                                {tx.type === 'Payment' && tx.status === 'Completed' && (
                                                                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleRefund(tx.id)}>Refund</button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2" style={{ marginTop: '40px' }}>
                            <div>
                                <h3>System Notifications</h3>
                                <div className="glass-panel" style={{ marginTop: '20px' }}>
                                    {notifications.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>All caught up!</p> : (
                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {notifications.slice(0, 5).map(n => (
                                                <li key={n.id} style={{ paddingBottom: '15px', borderBottom: '1px solid var(--border-color)', color: n.type === 'warning' ? 'var(--danger)' : n.type === 'success' ? 'var(--success)' : '' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>{new Date(n.date).toLocaleString()}</div>
                                                    {n.message}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {(view === 'cards') && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h3>{user.role === 'Admin' ? 'Global Active Cards' : `Active Cards (${cards.length})`}</h3>
                            {user.role === 'Customer' && <button className="btn btn-primary" onClick={() => setShowCardForm(!showCardForm)}><Plus size={18} /> Request New Card</button>}
                        </div>

                        {showCardForm && (
                            <div className="glass-panel" style={{ marginBottom: '30px' }}>
                                <h3>Apply for Card Allocation</h3>
                                <form onSubmit={handleIssueCard} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginTop: '15px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Card Type</label>
                                        <CustomDropdown
                                            options={[
                                                { value: 'Virtual', label: 'Virtual Card' },
                                                { value: 'Physical', label: 'Physical Card' }
                                            ]}
                                            value={newCardForm.type}
                                            onChange={val => setNewCardForm({ ...newCardForm, type: val })}
                                            placeholder="Select Card Type"
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Requested Credit Limit (INR)</label>
                                        <input type="number" min="100" className="form-control" value={newCardForm.limit} onChange={e => setNewCardForm({ ...newCardForm, limit: Number(e.target.value) })} />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '12px 25px', marginBottom: '15px' }}>Submit Request</button>
                                </form>
                            </div>
                        )}

                        {user.role === 'Admin' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                                {adminUsers.filter(u => cards.some(c => c.user_id === u.id)).map(u => (
                                    <div key={u.id}>
                                        <h4 style={{ color: 'var(--accent)', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                                            <Users size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                                            Cardholder: {u.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 'normal' }}>({u.email})</span>
                                        </h4>
                                        <div className="grid grid-cols-2">
                                            {cards.filter(c => c.user_id === u.id).map(card => {
                                                const amountOwed = card.debt || 0;
                                                return (
                                                    <div key={card.id} className="credit-card" style={{ filter: card.status !== 'Active' ? 'grayscale(1)' : 'none' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                            <div className="card-chip"></div>
                                                            <div className={`badge ${card.status === 'Active' ? 'badge-success' : card.status === 'Pending Approval' ? 'badge-warning' : 'badge-danger'}`}>{card.status}</div>
                                                        </div>
                                                        <div className="card-number">{card.card_number}</div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>Available Credit</div>
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{card.balance.toFixed(2)}</div>
                                                                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>Limit: ₹{card.spending_limit?.toFixed(2)}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', textAlign: 'right' }}>Expires</div>
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'right' }}>{card.expiry}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                            {card.status === 'Pending Approval' && (
                                                                <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'rgba(46,213,115,0.2)', border: 'none', color: 'var(--success)', marginRight: '5px' }} onClick={() => handleCardUpdate(card.id, 'activate')}>Allocate File</button>
                                                            )}
                                                            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'rgba(255,71,87,0.2)', border: 'none', color: 'var(--danger)' }} onClick={() => handleCardUpdate(card.id, 'delete')}>Revoke / Delete</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2">
                                {cards.map(card => {
                                    const amountOwed = card.debt || 0;
                                    return (
                                        <div key={card.id} className="credit-card" style={{ filter: card.status !== 'Active' ? 'grayscale(1)' : 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <div className="card-chip"></div>
                                                <div className={`badge ${card.status === 'Active' ? 'badge-success' : card.status === 'Pending Approval' ? 'badge-warning' : 'badge-danger'}`}>{card.status}</div>
                                            </div>
                                            <div className="card-number">{card.card_number}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>Available Credit</div>
                                                    <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{card.balance.toFixed(2)}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>Limit: ₹{card.spending_limit?.toFixed(2)}</div>
                                                </div>
                                                {card.status === 'Active' && amountOwed > 0 && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <button onClick={() => handleRepay(card.id, amountOwed)} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'rgba(255,171,0,0.2)', color: '#ffab00', border: '1px solid rgba(255,171,0,0.5)' }}>Repay ₹{amountOwed.toFixed(2)}</button>
                                                        {card.repayment_due_date && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '5px', fontWeight: 600 }}>
                                                                Due: {new Date(card.repayment_due_date).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {!(card.status === 'Active' && amountOwed > 0) && (
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', textAlign: 'right' }}>Expires</div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'right' }}>{card.expiry}</div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                {card.status === 'Active' ? (
                                                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'rgba(255,71,87,0.2)', border: 'none', color: 'var(--danger)' }} onClick={() => handleCardUpdate(card.id, 'freeze')}>Freeze Card</button>
                                                ) : card.status === 'Frozen' ? (
                                                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'rgba(46,213,115,0.2)', border: 'none', color: 'var(--success)' }} onClick={() => handleCardUpdate(card.id, 'activate')}>Unfreeze</button>
                                                ) : (
                                                    <div style={{ fontSize: '0.8rem', color: '#ffab00', fontStyle: 'italic', padding: '5px' }}>Waiting on Admin Setup...</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {cards.length === 0 && <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>No cards associated with this query.</div>}
                    </>
                )}

                {view === 'pay' && user.role === 'Customer' && (
                    <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
                        <div className="glass-panel">
                            <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Pay Merchant (Shop, Grocery)</h3>
                            {cards.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '20px' }}>You must mint a card before transacting.</div>
                            ) : (
                                <form onSubmit={(e) => { e.preventDefault(); handlePayment(e); }}>
                                    <div className="form-group">
                                        <label>Payment Method</label>
                                        <CustomDropdown
                                            options={[
                                                { value: 'direct', label: 'Direct Database Transfer' },
                                                { value: 'upi', label: 'UPI ID (e.g. name@bank)' },
                                                { value: 'mobile', label: 'Mobile Number' },
                                                { value: 'qr', label: 'Scan QR Code' }
                                            ]}
                                            value={paymentMethod}
                                            onChange={(val) => {
                                                setPaymentMethod(val);
                                                setPaymentIdentifier('');
                                                setPaymentForm({ merchant_id: '', amount: '', card_id: paymentForm.card_id, qr_parsed: null });
                                                setPaymentStep(1);
                                                if (val === 'qr') showMsg("Initializing Camera for QR Scan...");
                                            }}
                                            placeholder="Select Payment Method"
                                        />
                                    </div>

                                    {paymentStep === 1 ? (
                                        <>

                                            {paymentMethod === 'direct' && (
                                                <div className="form-group">
                                                    <label>Select Recipient Merchant</label>
                                                    <CustomDropdown
                                                        options={[
                                                            { value: '', label: '-- Search Directory --' },
                                                            ...merchants.map(m => ({ value: m.id, label: m.name }))
                                                        ]}
                                                        value={paymentForm.merchant_id}
                                                        onChange={val => setPaymentForm({ ...paymentForm, merchant_id: val })}
                                                        placeholder="-- Search Directory --"
                                                        required
                                                    />
                                                </div>
                                            )}

                                            {paymentMethod === 'mobile' && (
                                                <div className="form-group">
                                                    <label>Enter Beneficiary Mobile Number</label>
                                                    <input type="tel" className="form-control" placeholder="+91 9876543210" required
                                                        value={paymentIdentifier}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPaymentIdentifier(val);
                                                            if (val.replace(/\D/g, '').length >= 10) {
                                                                // Always create a dynamic external vendor for any custom mobile number
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    merchant_id: 'ext_mobile',
                                                                    qr_parsed: { name: `Mobile User (${val})`, upi: val }
                                                                });
                                                            } else {
                                                                setPaymentForm({ ...paymentForm, merchant_id: '', qr_parsed: null });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {paymentMethod === 'upi' && (
                                                <div className="form-group">
                                                    <label>Enter Beneficiary UPI ID</label>
                                                    <input type="text" className="form-control" placeholder="merchant@bank" required
                                                        value={paymentIdentifier}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPaymentIdentifier(val);
                                                            if (val.includes('@') && val.length > 5) {
                                                                // Always create a dynamic external vendor for any custom UPI ID
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    merchant_id: 'ext_upi',
                                                                    qr_parsed: { name: `UPI User (${val.split('@')[0]})`, upi: val }
                                                                });
                                                            } else {
                                                                setPaymentForm({ ...paymentForm, merchant_id: '', qr_parsed: null });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {paymentMethod === 'qr' && (
                                                <div className="form-group">
                                                    <label>Scan Merchant QR Code</label>
                                                    {!paymentForm.qr_parsed ? (
                                                        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '2px solid var(--accent)', marginBottom: '10px', background: '#000' }}>
                                                            <Scanner
                                                                onScan={(rawResult) => {
                                                                    if (rawResult && rawResult.length > 0) {
                                                                        const qrText = typeof rawResult[0]?.rawValue === 'string' ? rawResult[0].rawValue : rawResult[0]?.text || '';
                                                                        if (!qrText) return;

                                                                        let name = "Unknown Vendor Registration";
                                                                        let upi = "external@bank";
                                                                        let amt = paymentForm.amount;

                                                                        if (qrText.startsWith('upi://pay')) {
                                                                            try {
                                                                                const url = new URL(qrText);
                                                                                upi = url.searchParams.get('pa') || upi;
                                                                                if (url.searchParams.get('pn')) name = decodeURIComponent(url.searchParams.get('pn').replace(/\+/g, ' '));
                                                                                if (url.searchParams.get('am')) amt = url.searchParams.get('am');
                                                                            } catch (e) { }
                                                                        } else {
                                                                            name = qrText.slice(0, 25) + (qrText.length > 25 ? "..." : "");
                                                                            upi = "non-upi: " + qrText.slice(0, 15);
                                                                        }

                                                                        // Find a target merchant randomly if we don't have a direct GPay link
                                                                        let march = merchants.find(m => m.name.includes("GPay")) || merchants[0] || { id: "test", name: "Vendor" };

                                                                        setPaymentForm({ ...paymentForm, merchant_id: march.id, amount: amt, qr_parsed: { name, upi } });
                                                                        showMsg("QR Data Extracted Successfully!");
                                                                    }
                                                                }}
                                                                onError={(err) => console.log(err)}
                                                                components={{
                                                                    audio: false,
                                                                    onOff: false,
                                                                    finder: true,
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div style={{ padding: '20px', background: 'rgba(46,213,115,0.2)', color: 'var(--success)', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--success)' }}>
                                                            <CheckCircle size={40} style={{ margin: '0 auto 10px' }} />
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{paymentForm.qr_parsed.name}</div>
                                                            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '10px' }}>{paymentForm.qr_parsed.upi}</div>
                                                            Scan Successful! Ready to pay.
                                                            <div style={{ marginTop: '10px' }}>
                                                                <button type="button" onClick={() => setPaymentForm({ merchant_id: '', amount: '', card_id: paymentForm.card_id, qr_parsed: null })} className="btn btn-secondary" style={{ padding: '5px 15px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}>Scan Again</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {(paymentForm.merchant_id || paymentForm.qr_parsed) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    style={{ width: '100%', marginTop: '20px', padding: '15px' }}
                                                    onClick={() => setPaymentStep(2)}
                                                >Continue to Amount →</button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Paying</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--accent)', marginTop: '5px' }}>
                                                    {paymentForm.qr_parsed ? paymentForm.qr_parsed.name : merchants.find(m => m.id === paymentForm.merchant_id)?.name}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {paymentForm.qr_parsed ? paymentForm.qr_parsed.upi : paymentMethod === 'mobile' ? 'Mobile Link verified' : paymentMethod === 'upi' ? paymentIdentifier : 'NexusPay Secure Direct'}
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Pay Via Card</label>
                                                <CustomDropdown
                                                    options={[
                                                        { value: '', label: '-- Select Card --' },
                                                        ...cards.filter(c => c.status === 'Active').map(c => ({
                                                            value: c.id,
                                                            label: `Card ending in ${c.card_number.slice(-4)} (Avail: ₹${c.balance.toFixed(2)})`
                                                        }))
                                                    ]}
                                                    value={paymentForm.card_id}
                                                    onChange={val => setPaymentForm({ ...paymentForm, card_id: val })}
                                                    placeholder="-- Select Card --"
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Transaction Amount (INR)</label>
                                                <div style={{ position: 'relative' }}>
                                                    <IndianRupee size={18} style={{ position: 'absolute', left: 15, top: 14, color: 'var(--accent)' }} />
                                                    <input type="number" min="0.01" step="0.01" className="form-control" style={{ paddingLeft: '45px', fontSize: '1.2rem', color: 'var(--accent)', fontWeight: 600 }} required placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Send money securely via NexusPay transmission.</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                                <button type="button" className="btn btn-secondary" style={{ width: '30%', padding: '15px' }} onClick={() => setPaymentStep(1)}>Back</button>
                                                <button type="submit" className="btn btn-primary" style={{ width: '70%', padding: '15px', background: 'var(--success)' }}>Authorize ₹{paymentForm.amount || '0.00'}</button>
                                            </div>
                                        </>
                                    )}
                                </form>
                            )}
                        </div>

                        <div className="glass-panel">
                            <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Repay Borrowed Credit Limit</h3>
                            {cards.filter(c => c.status === 'Active' && (c.debt || 0) > 0).length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--success)', padding: '20px' }}>You have no outstanding borrowed amounts!</div>
                            ) : (
                                <div>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center', lineHeight: '1.5' }}>
                                        When you spend on your card, you borrow money. Pay it back within the time limit.
                                    </p>
                                    {cards.filter(c => c.status === 'Active' && (c.debt || 0) > 0).map(card => {
                                        const amountOwed = card.debt || 0;
                                        return (
                                            <div key={card.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', marginBottom: '15px', background: 'rgba(0,0,0,0.2)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                    <strong>Card {card.card_number.slice(-4)}</strong>
                                                    <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.1rem' }}>Owe: ₹{amountOwed.toFixed(2)}</span>
                                                </div>
                                                {card.repayment_due_date && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                                        Due Date Limit: <span style={{ color: '#ffab00', fontWeight: 'bold' }}>{new Date(card.repayment_due_date).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                                <button onClick={() => handleRepay(card.id, amountOwed)} className="btn btn-primary" style={{ width: '100%', fontSize: '0.9rem', padding: '10px', background: 'rgba(255,171,0,0.2)', color: '#ffab00', border: '1px solid rgba(255,171,0,0.5)' }}>Pay Back ₹{amountOwed.toFixed(2)}</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'users' && user.role === 'Admin' && (
                    <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>KYC Check</th>
                                    <th>Status Check</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adminUsers.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.id.substring(0, 6)}..</td>
                                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                                        <td>{u.email}</td>
                                        <td>{u.role}</td>
                                        <td>
                                            <div style={{ width: '150px' }}>
                                                <CustomDropdown
                                                    options={[
                                                        { value: 'Pending', label: 'Pending' },
                                                        { value: 'Under Review', label: 'Under Review' },
                                                        { value: 'Approved', label: 'Approved' },
                                                        { value: 'Rejected', label: 'Rejected' }
                                                    ]}
                                                    value={u.kyc_status || 'Pending'}
                                                    onChange={(val) => handleUserUpdate(u.id, { kyc_status: val })}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ width: '130px' }}>
                                                <CustomDropdown
                                                    options={[
                                                        { value: 'Active', label: 'Active' },
                                                        { value: 'Blocked', label: 'Blocked' }
                                                    ]}
                                                    value={u.status}
                                                    onChange={(val) => handleUserUpdate(u.id, { status: val })}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleViewUserDetails(u)}>View Analytics</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {view === 'user_details' && selectedUser && user.role === 'Admin' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button className="btn btn-secondary" onClick={() => { setView('users'); setSelectedUser(null); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    ← Back
                                </button>
                                <h3 style={{ margin: 0, color: 'var(--accent)' }}>User Analytics Pipeline</h3>
                            </div>
                        </div>

                        <div className="glass-panel animate-fade-in" style={{ position: 'relative' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>{selectedUser.name}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>{selectedUser.email || selectedUser.id}</div>

                            {!userDetails ? (<div style={{ padding: '40px', textAlign: 'center' }}><RefreshCw className="animate-pulse" size={40} color="var(--accent)" /></div>
                            ) : (
                                <div className="grid grid-cols-4" style={{ gap: '20px' }}>
                                    <div style={{ background: 'rgba(0, 229, 255, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Spent Vol.</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>₹{userDetails.total_spent.toFixed(2)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(46, 213, 115, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(46, 213, 115, 0.2)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Returned (Refunds)</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '10px' }}>₹{userDetails.total_refunds.toFixed(2)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(255, 171, 0, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 171, 0, 0.2)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Currently Owed</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ffab00', marginTop: '10px' }}>₹{userDetails.total_owed.toFixed(2)}</div>
                                    </div>
                                    <div style={{ background: 'rgba(168, 83, 186, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(168, 83, 186, 0.2)' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Repaid Historically</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#a853ba', marginTop: '10px' }}>₹{userDetails.total_repaid.toFixed(2)}</div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', background: 'rgba(255, 255, 255, 0.05)', padding: '15px 20px', borderRadius: '8px', display: 'flex', gap: '30px' }}>
                                        <div style={{ fontSize: '0.9rem' }}><strong>Active Cards:</strong> {userDetails.cards}</div>
                                        <div style={{ fontSize: '0.9rem' }}><strong>Total Credit Approved:</strong> ₹{userDetails.total_credit_limit.toFixed(2)}</div>
                                    </div>

                                    {userDetails.history && userDetails.history.length > 0 && (
                                        <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Unified Interaction Feed</h4>
                                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px' }}>
                                                {userDetails.history.map((tx, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx !== userDetails.history.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                                                {tx.type === 'Payment' && tx.customer_id === selectedUser.id ? `Paid to ${tx.merchant_name}` :
                                                                    tx.type === 'Payment' && tx.merchant_id === selectedUser.id ? `Received from ${tx.customer_name}` :
                                                                        tx.type === 'Refund' && tx.customer_id === selectedUser.id ? `Refunded from ${tx.merchant_name}` :
                                                                            tx.type === 'Refund' && tx.merchant_id === selectedUser.id ? `Refunded to ${tx.customer_name}` :
                                                                                tx.action}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{new Date(tx.date).toLocaleString()}</div>
                                                        </div>
                                                        <div style={{
                                                            fontWeight: 'bold', fontSize: '1.1rem', color: tx.type === 'Refund' && tx.customer_id === selectedUser.id ? 'var(--success)' :
                                                                tx.type === 'Payment' && tx.merchant_id === selectedUser.id ? 'var(--success)' :
                                                                    tx.type === 'Repayment' ? 'var(--accent)' : '#fff'
                                                        }}>
                                                            {tx.type === 'Payment' && tx.customer_id === selectedUser.id ? '-' :
                                                                tx.type === 'Refund' && tx.merchant_id === selectedUser.id ? '-' :
                                                                    tx.type === 'Repayment' ? '+' : '+'}
                                                            ₹{tx.amount ? tx.amount.toFixed(2) : parseFloat(tx.details?.match(/₹([\d\.]+)/)?.[1] || 0).toFixed(2)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'profile' && (
                    <div className="grid grid-cols-2">
                        <div className="glass-panel" style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                <h3>Account Information</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ flex: '0 0 auto', width: '120px', height: '120px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid var(--accent)' }}>
                                        {profileForm.avatar || profile.avatar ? (
                                            <img src={profileForm.avatar || profile.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>{profile.name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '250px' }}>
                                        <h2 style={{ marginBottom: '10px' }}>{profile.name} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({profile.username})</span></h2>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '5px' }}><strong>Email:</strong> {profile.email}</div>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '5px' }}><strong>Role:</strong> {profile.role}</div>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '5px' }}><strong>Status:</strong> <span style={{ color: profile.status === 'Active' ? 'var(--success)' : 'var(--danger)' }}>{profile.status}</span></div>
                                        {profile.created_at && <div style={{ color: 'var(--text-muted)' }}><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ marginBottom: '20px' }}>
                            <h3>Update Profile Details</h3>
                            <form onSubmit={handleProfileSave} style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px' }}>
                                <div className="form-group" style={{ flex: '1 1 100%' }}>
                                    <label>Profile Avatar</label>
                                    <div
                                        onDrop={handleAvatarDrop}
                                        onDragOver={preventDrag}
                                        style={{ border: '2px dashed var(--accent)', padding: '20px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }}
                                    >
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>Drag & Drop Image Here</div>
                                        <input type="file" accept="image/*" onChange={handleAvatarDrop} style={{ display: 'none' }} id="avatarUpload" />
                                        <label htmlFor="avatarUpload" className="btn btn-secondary" style={{ padding: '5px 15px', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-block' }}>Select Image File</label>
                                    </div>
                                </div>
                                <div className="form-group" style={{ flex: '1 1 100%' }}>
                                    <label>Phone Number</label>
                                    <input type="text" className="form-control" placeholder="+91..." value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: '1 1 100%' }}>
                                    <label>Physical Address</label>
                                    <textarea className="form-control" placeholder="Enter Full Residential Address..." value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ padding: '10px 30px', width: '100%' }}>Save Details</button>
                            </form>
                        </div>

                        {user.role === 'Customer' && (
                            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                                <h3>Identity Verification (KYC)</h3>
                                <p style={{ marginTop: '15px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                    To unlock higher spending limits and full platform access, federal regulations require us to verify your identity.
                                </p>
                                <div style={{ marginTop: '25px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                                    {profile.kyc_status === 'Approved' ? (
                                        <div style={{ color: 'var(--success)' }}><CheckCircle size={40} style={{ margin: '0 auto 10px' }} /> Identity Fully Verified</div>
                                    ) : profile.kyc_status === 'Under Review' ? (
                                        <div style={{ color: '#ffab00' }}>Documents Under Official Review. Please allow 1-2 BD.</div>
                                    ) : (
                                        <form onSubmit={updateProfile}>
                                            <FileText size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 15px' }} />
                                            <input type="file" required style={{ display: 'block', margin: '0 auto 15px', color: 'var(--text-muted)' }} />
                                            <button type="submit" className="btn btn-primary">Securely Upload Documents</button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
                            <h3>Security Preferences</h3>
                            <div style={{ marginTop: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>Two-Factor Authentication</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Protect account with secondary code</div>
                                </div>
                                <div style={{ width: '50px', height: '26px', background: profile.mfa_enabled ? 'var(--accent)' : 'var(--border-color)', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }} onClick={async () => { await api.put('/users/profile', { mfa_enabled: !profile.mfa_enabled }); loadData(); }}>
                                    <div style={{ width: '22px', height: '22px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: profile.mfa_enabled ? '26px' : '2px', transition: '0.3s' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`toast ${message ? 'show' : ''}`}>
                    {message}
                </div>
            </div>
        </div>
    );
}
