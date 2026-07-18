'use client';
import { useState } from 'react';

interface UserProfile {
  name: string;
  belt: string;
  club: string;
}

const BELT_OPTIONS = [
  'Sabuk Putih (Kyu 10-9)',
  'Sabuk Kuning (Kyu 8-7)',
  'Sabuk Hijau (Kyu 6-5)',
  'Sabuk Biru (Kyu 4-3)',
  'Sabuk Merah (Kyu 2-1)',
  'Sabuk Hitam Dan 1',
  'Sabuk Hitam Dan 2',
  'Sabuk Hitam Dan 3+',
  'Wasit / Juri Nasional',
  'Wasit / Juri Internasional',
  'Pelatih / Instruktur',
];

export default function LoginPage({ onLogin }: { onLogin: (p: UserProfile) => void }) {
  const [name, setName] = useState('');
  const [belt, setBelt] = useState('');
  const [club, setClub] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nama tidak boleh kosong ya!'); return; }
    if (!belt) { setError('Pilih tingkatan sabuk dulu!'); return; }
    onLogin({ name: name.trim(), belt, club: club.trim() });
  };

  return (
    <>
      <style>{`
        .login-root {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: #0e1621;
          padding: 24px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-y: auto;
        }
        .login-card {
          margin: auto;
          width: 100%;
          max-width: 440px;
          background: #17212b;
          border-radius: 20px;
          padding: 40px 36px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: fadeUp 0.5s ease;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .login-root { padding: 16px 12px; }
          .login-card { padding: 28px 24px; border-radius: 16px; }
          .login-logo .emoji { font-size: 48px; margin-bottom: 8px; }
          .login-logo h1 { font-size: 18px; }
          .login-greeting { font-size: 13px; padding: 12px; margin-bottom: 24px; }
        }
        .login-logo {
          text-align: center;
          margin-bottom: 24px;
        }
        .login-logo .emoji {
          font-size: 56px;
          display: block;
          margin-bottom: 12px;
          animation: pulse 2.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .login-logo h1 {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .login-logo .sub {
          font-size: 13px;
          color: #7ab3ef;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .login-greeting {
          background: rgba(41, 121, 255, 0.08);
          border: 1px solid rgba(41, 121, 255, 0.2);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 28px;
          color: #b0c8e8;
          font-size: 13.5px;
          line-height: 1.65;
          text-align: center;
        }
        .login-greeting strong { color: #7ab3ef; }
        .form-group { margin-bottom: 16px; }
        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #7ab3ef;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }
        .form-input, .form-select {
          width: 100%;
          background: #242f3d;
          border: 1px solid #2b3e50;
          border-radius: 10px;
          padding: 11px 14px;
          color: #fff;
          font-size: 14.5px;
          outline: none;
          transition: border-color 0.2s;
          appearance: none;
          -webkit-appearance: none;
        }
        .form-input::placeholder { color: #4a6278; }
        .form-input:focus, .form-select:focus { border-color: #2979ff; }
        .form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237ab3ef' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
        .form-select option { background: #17212b; }
        .form-error {
          color: #ef5350;
          font-size: 12.5px;
          margin-top: 12px;
          text-align: center;
          animation: shake 0.3s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .login-btn {
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          background: linear-gradient(135deg, #2979ff, #7c4dff);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.5px;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(41, 121, 255, 0.35);
        }
        .login-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .login-btn:active { transform: scale(0.98); }
        .login-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 11.5px;
          color: #3d5469;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="login-logo">
            <span className="emoji">🥋</span>
            <h1>REFEREE AI ASSISTANT</h1>
            <div className="sub">WKF 2026 · Powered by AI</div>
          </div>

          <div className="login-greeting">
            <strong>OSH!! Halo, Karateka!</strong><br /><br />
            Saya siap menjadi <strong>partner belajar</strong> terbaik Anda untuk menguasai
            Peraturan Pertandingan Karate standar <strong>WKF 2026</strong>. 🏆<br /><br />
            Sebelum kita mulai, boleh saya kenal Anda lebih dekat dulu? 
            Isi data di bawah agar saya bisa menyesuaikan penjelasan terbaik untuk Anda! 👇
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nama Lengkap *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tingkatan Sabuk / Peran *</label>
              <select
                className="form-select"
                value={belt}
                onChange={e => { setBelt(e.target.value); setError(''); }}
              >
                <option value="">-- Pilih Tingkatan --</option>
                {BELT_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Perguruan / Dojo <span style={{ color: '#4a6278', fontWeight: 400 }}>(opsional)</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="Contoh: INKANAS Jakarta"
                value={club}
                onChange={e => setClub(e.target.value)}
              />
            </div>

            {error && <div className="form-error">⚠️ {error}</div>}

            <button type="submit" className="login-btn">
              MASUK KE DOJO →
            </button>
          </form>

          <div className="login-footer">
            🔒 Data Anda aman · Tidak tersimpan di server
          </div>
        </div>
      </div>
    </>
  );
}
