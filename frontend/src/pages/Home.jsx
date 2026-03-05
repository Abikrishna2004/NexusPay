import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CreditCard, Activity, ArrowRight } from 'lucide-react';

export default function Home({ user, onLogout }) {
    useEffect(() => {
        document.title = 'NexusPay - Next Gen Payments';
    }, []);

    return (
        <div className="container">
            <nav className="navbar animate-fade-in">
                <Link to="/" className="nav-brand">
                    <img src="/logo.jpeg" alt="Logo" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                    NexusPay
                </Link>
                <div className="nav-links">
                    {user ? (
                        <>
                            <Link to="/dashboard" className="btn btn-secondary">Dashboard</Link>
                            <button onClick={onLogout} className="btn btn-primary">Logout</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-secondary">Login</Link>
                            <Link to="/register" className="btn btn-primary" style={{ marginLeft: '10px' }}>Get Started <ArrowRight size={18} /></Link>
                        </>
                    )}
                </div>
            </nav>

            <main style={{ textAlign: 'center', marginTop: '80px' }} className="animate-fade-in">
                <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent)', borderRadius: '30px', marginBottom: '20px', fontWeight: 600 }}>
                    The Future of Payments
                </div>
                <h1 style={{ fontSize: '4.5rem', marginBottom: '20px', maxWidth: '800px', margin: '0 auto' }}>
                    Next-Generation <br /> Credit Card Processing
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '30px auto', lineHeight: '1.6' }}>
                    Secure, seamless, and lightning-fast payment solutions for modern merchants and consumers. Experience banking without boundaries.
                </p>

                <div style={{ marginTop: '40px', gap: '20px', display: 'flex', justifyContent: 'center' }}>
                    <Link to="/register" className="btn btn-primary" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>Open an Account</Link>
                    <a href="#features" className="btn btn-secondary" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>Learn More</a>
                </div>

                <div id="features" className="grid grid-cols-3" style={{ marginTop: '100px', textAlign: 'left' }}>
                    <div className="glass-panel animate-float" style={{ animationDelay: '0s' }}>
                        <div className="stat-icon" style={{ marginBottom: '20px' }}><Shield size={24} /></div>
                        <h3>Bank-Grade Security</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>AES-256 encryption and advanced AI fraud detection keep your money safe 24/7.</p>
                    </div>
                    <div className="glass-panel animate-float" style={{ animationDelay: '1s' }}>
                        <div className="stat-icon" style={{ background: 'rgba(168, 83, 186, 0.1)', color: '#a853ba', marginBottom: '20px' }}><CreditCard size={24} /></div>
                        <h3>Instant Virtual Cards</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Generate secure virtual cards instantly for online shopping and subscriptions.</p>
                    </div>
                    <div className="glass-panel animate-float" style={{ animationDelay: '2s' }}>
                        <div className="stat-icon" style={{ background: 'rgba(46, 213, 115, 0.1)', color: 'var(--success)', marginBottom: '20px' }}><Activity size={24} /></div>
                        <h3>Real-Time Analytics</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Merchants get powerful insights into transaction volumes and customer trends.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
