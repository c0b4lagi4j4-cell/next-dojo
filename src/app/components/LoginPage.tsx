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
        * { box-sizing: border-box; }

        .login-root {
          /* Isi penuh viewport, scroll internal jika konten melebihi */
          position: fixed;
          inset: 0;
          overflow-y: auto;
          overflow-x: hidden;
          background: #0e1621;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          /* Flexbox untuk centering horisontal & vertikal saat konten pendek */
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 20px 16px;
          -webkit-overflow-scrolling: touch;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          /* Beri jarak atas-bawah agar tidak mepet saat layar tinggi */
          margin: auto;
          background: #17212b;
          border-radius: 20px;
          padding: 36px 32px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: fadeUp 0.45s ease;
          /* Pastikan tidak lebih lebar dari viewport */
          min-width: 0;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Logo ── */
        .login-logo {
          text-align: center;
          margin-bottom: 20px;
        }
        .login-logo .emoji {
          font-size: clamp(40px, 8vw, 56px);
          display: block;
          margin-bottom: 10px;
          animation: pulse 2.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.07); }
        }
        .login-logo h1 {
          font-size: clamp(15px, 4vw, 20px);
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
          margin: 0 0 5px;
          line-height: 1.3;
          word-break: break-word;
        }
        .login-logo .sub {
          font-size: clamp(10px, 2.5vw, 13px);
          color: #7ab3ef;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        /* ── Greeting box ── */
        .login-greeting {
          background: rgba(41, 121, 255, 0.08);
          border: 1px solid rgba(41, 121, 255, 0.2);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 22px;
          color: #b0c8e8;
          font-size: clamp(12px, 3vw, 13.5px);
          line-height: 1.6;
          text-align: center;
        }
        .login-greeting strong { color: #7ab3ef; }

        /* ── Form ── */
        .form-group { margin-bottom: 14px; }
        .form-label {
          display: block;
          font-size: clamp(10px, 2.5vw, 12px);
          font-weight: 600;
          color: #7ab3ef;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        .form-input, .form-select {
          width: 100%;
          background: #242f3d;
          border: 1px solid #2b3e50;
          border-radius: 10px;
          padding: 10px 12px;
          color: #fff;
          font-size: clamp(13px, 3.5vw, 15px);
          outline: none;
          transition: border-color 0.2s;
          appearance: none;
          -webkit-appearance: none;
          /* Penting: jangan biarkan melebihi parent */
          min-width: 0;
        }
        .form-input::placeholder { color: #4a6278; }
        .form-input:focus,
        .form-select:focus { border-color: #2979ff; box-shadow: 0 0 0 3px rgba(41,121,255,0.15); }

        .form-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237ab3ef' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 34px;
          cursor: pointer;
        }
        .form-select option { background: #17212b; }

        /* ── Error ── */
        .form-error {
          color: #ef5350;
          font-size: clamp(11px, 2.8vw, 12.5px);
          margin-top: 10px;
          text-align: center;
          animation: shake 0.3s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-5px); }
          75%       { transform: translateX(5px); }
        }

        /* ── Button ── */
        .login-btn {
          width: 100%;
          margin-top: 20px;
          padding: 13px 16px;
          background: linear-gradient(135deg, #2979ff, #7c4dff);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.5px;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(41, 121, 255, 0.35);
        }
        .login-btn:hover  { opacity: 0.9; transform: translateY(-1px); }
        .login-btn:active { transform: scale(0.98); }

        /* ── Footer ── */
        .login-footer {
          text-align: center;
          margin-top: 18px;
          font-size: clamp(10px, 2.5vw, 11.5px);
          color: #3d5469;
        }

        /* ── Breakpoint khusus HP sangat kecil (<360px) ── */
        @media (max-width: 360px) {
          .login-root   { padding: 12px 10px; }
          .login-card   { padding: 24px 16px; border-radius: 14px; }
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
