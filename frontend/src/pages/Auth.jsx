import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { User, Lock, Mail, CreditCard, Building } from 'lucide-react';

export default function Auth({ onLogin, mode = 'login' }) {
    const isLogin = mode === 'login';
    const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '', role: 'Customer' });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        document.title = isLogin ? 'Login - NexusPay' : 'Register - NexusPay';
        if (location.state?.message) {
            setSuccessMessage(location.state.message);
            window.history.replaceState({}, document.title); // clear state so it doesn't persist on refresh
        }
    }, [isLogin, location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const res = await api.post(endpoint, formData);

            if (isLogin) {
                onLogin(res.data.user, res.data.token);
                navigate('/dashboard');
            } else {
                // Register success, go to login
                navigate('/login', { state: { message: 'Registration successful! Please login.' } });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Make sure processing backend is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} className="animate-fade-in">
            <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '100px', height: '100px', background: 'var(--accent)', filter: 'blur(70px)' }}></div>
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '100px', height: '100px', background: '#a853ba', filter: 'blur(70px)' }}></div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', position: 'relative' }}>
                    <img src="/logo.jpeg" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>

                <h2 style={{ textAlign: 'center', marginBottom: '30px', position: 'relative' }}>
                    {isLogin ? 'Welcome Back' : 'Create an Account'}
                </h2>

                {error && <div style={{ background: 'rgba(255, 71, 87, 0.1)', color: 'var(--danger)', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
                {successMessage && <div style={{ background: 'rgba(46, 213, 115, 0.1)', color: 'var(--success)', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>{successMessage}</div>}

                <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label>Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                                    <input type="text" className="form-control" style={{ paddingLeft: '40px' }} placeholder="John Doe" required={!isLogin}
                                        value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Username</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                                    <input type="text" className="form-control" style={{ paddingLeft: '40px' }} placeholder="johndoe123" required={!isLogin}
                                        value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>{isLogin ? 'Username / Email' : 'Email Address'}</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                            <input type={isLogin ? 'text' : 'email'} className="form-control" style={{ paddingLeft: '40px' }} placeholder={isLogin ? "Username or Email" : "you@example.com"} required
                                value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                            <input type="password" className="form-control" style={{ paddingLeft: '40px' }} placeholder="••••••••" required minLength="6"
                                value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label>Account Type</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="glass-panel"
                                    style={{ padding: '15px', textAlign: 'center', cursor: 'pointer', border: formData.role === 'Customer' ? '1px solid var(--accent)' : '1px solid var(--border-color)', background: formData.role === 'Customer' ? 'rgba(0, 229, 255, 0.1)' : 'transparent' }}
                                    onClick={() => setFormData({ ...formData, role: 'Customer' })}>
                                    <CreditCard size={24} style={{ margin: '0 auto 10px', color: formData.role === 'Customer' ? 'var(--accent)' : 'var(--text-muted)' }} />
                                    <div style={{ fontSize: '0.9rem', color: formData.role === 'Customer' ? '#fff' : 'var(--text-muted)' }}>Customer</div>
                                </div>
                                <div className="glass-panel"
                                    style={{ padding: '15px', textAlign: 'center', cursor: 'pointer', border: formData.role === 'Merchant' ? '1px solid #a853ba' : '1px solid var(--border-color)', background: formData.role === 'Merchant' ? 'rgba(168, 83, 186, 0.1)' : 'transparent' }}
                                    onClick={() => setFormData({ ...formData, role: 'Merchant' })}>
                                    <Building size={24} style={{ margin: '0 auto 10px', color: formData.role === 'Merchant' ? '#a853ba' : 'var(--text-muted)' }} />
                                    <div style={{ fontSize: '0.9rem', color: formData.role === 'Merchant' ? '#fff' : 'var(--text-muted)' }}>Merchant</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setError(''); navigate(isLogin ? '/register' : '/login'); }}>
                        {isLogin ? "Sign up" : "Log in"}
                    </span>
                </div>
            </div>
        </div>
    );
}
