'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Shield, HelpCircle, Download, Mail, LogOut, Home } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserProfile { name: string; belt: string; club: string; }
export interface Message { id: string; role: 'user' | 'assistant'; text: string; time: string; }

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────
function MessageContent({ text }: { text: string }) {
  return (
    <div className="msg-md">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('> '))
          return <blockquote key={i}>{line.slice(2)}</blockquote>;
        if (/^#+\s/.test(line))
          return <p key={i} className="md-heading">{line.replace(/^#+\s/, '')}</p>;
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        );
      })}
    </div>
  );
}

// ─── End Conversation Modal ───────────────────────────────────────────────────
function EndModal({ onEndOnly, onGoHome, onCancel }: {
  onEndOnly: () => void;
  onGoHome: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Akhiri Percakapan?</h3>
        <p style={{ marginBottom: 18 }}>Pilih tindakan yang ingin Anda lakukan:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="modal-btn confirm" onClick={onEndOnly}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            ✅ Akhiri &amp; Simpan Riwayat
          </button>
          <button className="modal-btn" onClick={onGoHome}
            style={{ background: '#1e2d3d', color: '#90caf9', border: '1px solid #2b3e50', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            🏠 Kembali ke Halaman Depan
          </button>
          <button className="modal-btn cancel" onClick={onCancel}
            style={{ textAlign: 'center' }}>
            Batalkan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ onSend, onCancel, isSending }: {
  onSend: (email: string) => void; onCancel: () => void; isSending: boolean;
}) {
  const [email, setEmail] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>📧 Simpan & Kirim ke Email?</h3>
        <p>Apakah Anda ingin mengirim riwayat ini ke email? Jika ya, masukkan alamat email tujuan:</p>
        <input
          type="email"
          className="modal-input"
          placeholder="contoh@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel} disabled={isSending}>Lewati (Tidak Kirim)</button>
          <button className="modal-btn confirm" onClick={() => onSend(email)} disabled={isSending || !email.includes('@')}>
            {isSending ? 'Mengirim...' : 'Kirim'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export default function ChatPage({
  profile,
  onStartQuiz,
  onLogout,
}: {
  profile: UserProfile;
  onStartQuiz: (messages: Message[]) => void;
  onLogout: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [ended, setEnded] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [toast, setToast] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const now = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, text, time: now() }]);
  }, []);

  const startCooldown = useCallback((s: number) => {
    setCooldown(s);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(cooldownRef.current!); return 0; } return c - 1; });
    }, 1000);
  }, []);

  // Initial greeting
  useEffect(() => {
    if (started) return;
    setStarted(true);
    setIsLoading(true);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'INITIAL_GREET', history: [], userName: profile.name, userBelt: profile.belt }),
    })
      .then(r => r.json())
      .then(d => { 
        if (d.reply) { addMessage('assistant', d.reply); }
        else { throw new Error('No reply'); }
      })
      .catch(() => addMessage('assistant', `OSH!! Selamat datang, ${profile.name}! 🥋 Siap belajar peraturan WKF 2026 hari ini?`))
      .finally(() => setIsLoading(false));
  }, [started, addMessage, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const trimmed = (input ?? '').trim();
    if (!trimmed || isLoading || cooldown > 0 || blocked || ended) return;
    setInput('');
    addMessage('user', trimmed);
    setIsLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, userName: profile.name, userBelt: profile.belt }),
      });
      const data = await res.json();
      if (res.status === 429) { addMessage('assistant', '😵‍💫 Waduh! Energi Ki saya habis! Istirahat sebentar...'); startCooldown(60); return; }
      if (res.status === 503) { addMessage('assistant', '🔧 Sistem lagi mumet. Coba ulangi ya!'); return; }
      if (data.error === 'profane') {
        const n = violationCount + 1; setViolationCount(n);
        addMessage('assistant', data.reply);
        if (n >= 3) { setTimeout(() => { addMessage('assistant', '🚫 PELANGGARAN MAKSIMAL! Sesi diblokir.'); setBlocked(true); }, 400); }
        return;
      }
      if (data.error) {
        addMessage('assistant', `❌ Error Sistem: ${data.details || 'Terjadi kesalahan tidak terduga.'}`);
        return;
      }
      if (data.reply) addMessage('assistant', data.reply);
    } catch { addMessage('assistant', '❌ Koneksi bermasalah atau server Vercel gagal merespons. Coba lagi!'); }
    finally { setIsLoading(false); inputRef.current?.focus(); }
  }, [input, isLoading, cooldown, blocked, ended, messages, profile, violationCount, addMessage, startCooldown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Save to PDF
  const savePDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const usableW = pageW - margin * 2;
      let y = 20;

      // Header
      doc.setFontSize(16); doc.setTextColor(41, 121, 255);
      doc.text('REFEREE AI ASSISTANT — Riwayat Percakapan', margin, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(100, 100, 100);
      doc.text(`Nama: ${profile.name} | Sabuk: ${profile.belt} | Dojo: ${profile.club || '-'}`, margin, y); y += 5;
      doc.text(`Tanggal: ${new Date().toLocaleString('id-ID')}`, margin, y); y += 8;
      doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 6;

      doc.setFontSize(10.5); doc.setTextColor(30, 30, 30);
      messages.forEach(m => {
        const prefix = m.role === 'user' ? `[${profile.name}] ` : '[REFEREE AI] ';
        const full = prefix + m.text;
        const lines = doc.splitTextToSize(full, usableW);
        
        if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
        doc.setTextColor(m.role === 'user' ? 20 : 50, m.role === 'user' ? 90 : 50, m.role === 'user' ? 200 : 50);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 6;
      });

      doc.save(`RefereeAI_${profile.name}_${Date.now()}.pdf`);
      showToast('✅ PDF berhasil diunduh!');
    } catch { showToast('❌ Gagal membuat PDF.'); }
  };

  // Send Email via EmailJS
  const sendEmail = async (toEmail: string) => {
    setIsSendingEmail(true);
    try {
      const chatText = messages.map(m =>
        `[${m.role === 'user' ? profile.name : 'AI'}] ${m.time}\n${m.text}`
      ).join('\n\n---\n\n');

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          subject: `Riwayat Percakapan - ${profile.name}`,
          textBody: `Halo,\n\nBerikut adalah riwayat percakapan dari Referee AI Assistant untuk pengguna:\nNama: ${profile.name}\nSabuk: ${profile.belt}\nDojo: ${profile.club || '-'}\n\n---\n\n${chatText}`,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Gagal mengirim email');

      setShowEmailModal(false);
      showToast('✅ Email berhasil dikirim!');
    } catch (e: any) {
      showToast(`❌ Gagal: ${e.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
      <style>{`
        .chat-root { display:flex; flex-direction:column; height:100dvh; width:100%; background:#0e1621; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; overflow:hidden; }
        /* Header */
        .chat-header { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#17212b; border-bottom:1px solid #0d1821; flex-shrink:0; min-width:0; }
        .avatar { width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2979ff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; position:relative; }
        .online-dot { position:absolute;bottom:1px;right:1px;width:9px;height:9px;border-radius:50%;background:#4caf50;border:2px solid #17212b; }
        .header-info { flex:1; min-width:0; }
        .header-name { font-size:clamp(13px,3.5vw,15px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .header-status { font-size:clamp(10px,2.5vw,11.5px);color:#7ab3ef;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .header-actions { display:flex;gap:2px;flex-shrink:0; }
        .icon-btn { padding:7px;border-radius:50%;border:none;background:transparent;color:#7c8b97;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s; }
        .icon-btn:hover { background:rgba(255,255,255,.08);color:#fff; }
        .icon-btn.danger:hover { background:rgba(239,83,80,.12);color:#ef5350; }
        .icon-btn.quiz-btn { background:rgba(41,121,255,.15);color:#7ab3ef;border-radius:20px;padding:6px 10px;font-size:clamp(11px,2.5vw,12px);font-weight:600;gap:4px;white-space:nowrap; }
        .icon-btn.quiz-btn:hover { background:rgba(41,121,255,.3);color:#fff; }
        /* Profile bar */
        .profile-bar { display:flex;align-items:center;gap:6px;padding:5px 12px;background:#142030;border-bottom:1px solid #0d1821;font-size:11px;color:#7ab3ef;flex-shrink:0;overflow-x:auto;white-space:nowrap;scrollbar-width:none; }
        .profile-bar::-webkit-scrollbar { display:none; }
        .profile-chip { background:rgba(41,121,255,.12);border:1px solid rgba(41,121,255,.2);border-radius:20px;padding:2px 8px;font-size:clamp(10px,2.5vw,11.5px);white-space:nowrap;flex-shrink:0; }
        /* Messages */
        .messages-area { flex:1;overflow-y:auto;padding:10px 12px 8px;display:flex;flex-direction:column;gap:4px;background:#0e1621;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23162535' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
        .messages-area::-webkit-scrollbar { width:4px; } .messages-area::-webkit-scrollbar-thumb { background:#2b3e50;border-radius:4px; }
        /* Bubbles */
        .msg-row { display:flex;align-items:flex-end;gap:6px; }
        .msg-row.user { justify-content:flex-end; } .msg-row.assistant { justify-content:flex-start; }
        .msg-avatar { width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#2979ff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-bottom:2px; }
        .msg-avatar.hidden { visibility:hidden; }
        .bubble { max-width:min(80%,520px);padding:8px 11px;border-radius:18px;font-size:clamp(13px,3.5vw,14px);line-height:1.55;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.3); }
        .bubble.user { background:#2b5278;color:#fff;border-bottom-right-radius:4px; }
        .bubble.assistant { background:#182533;color:#d4dde8;border-bottom-left-radius:4px; }
        .bubble-time { font-size:10px;margin-top:4px;display:flex;align-items:center;justify-content:flex-end;gap:3px;opacity:.6; }
        .msg-md p { margin-bottom:3px; } .msg-md p:last-child { margin-bottom:0; }
        .msg-md .md-heading { font-weight:700;color:#fff;margin:5px 0 2px; }
        .msg-md blockquote { border-left:3px solid #4fc3f7;background:rgba(79,195,247,.08);padding:5px 10px;margin:7px 0;border-radius:0 6px 6px 0;color:#90caf9;font-style:italic;font-size:13px; }
        /* Typing */
        .typing-row { display:flex;align-items:flex-end;gap:6px; }
        .typing-bubble { background:#182533;padding:10px 14px;border-radius:18px;border-bottom-left-radius:4px;display:flex;gap:5px;align-items:center; }
        .dot { width:7px;height:7px;border-radius:50%;background:#7ab3ef;animation:bounce 1.2s infinite; }
        .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.6}30%{transform:translateY(-5px);opacity:1}}
        /* Cooldown */
        .cooldown-banner { background:rgba(255,179,0,.1);border:1px solid rgba(255,179,0,.25);color:#ffcc02;padding:9px 14px;border-radius:12px;font-size:clamp(12px,3vw,13px);text-align:center;margin:4px 0; }
        .cooldown-banner strong { color:#ffe57f; }
        /* Ended Banner */
        .ended-banner { background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.2);color:#81c784;padding:10px;border-radius:12px;text-align:center;font-size:clamp(12px,3vw,13px);margin:6px 0; }
        .ended-actions { display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap; }
        .ended-btn { display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;font-size:clamp(11px,3vw,13px);font-weight:600;cursor:pointer;border:none;transition:opacity .15s; }
        .ended-btn.pdf { background:#2979ff;color:#fff; }
        .ended-btn.email { background:#7c4dff;color:#fff; }
        .ended-btn.quiz { background:#00897b;color:#fff; }
        .ended-btn:hover { opacity:.88; }
        /* Input */
        .input-area { flex-shrink:0;padding:8px 12px 10px;background:#17212b;border-top:1px solid #0d1821; }
        .input-row { display:flex;align-items:center;gap:8px;background:#242f3d;border-radius:24px;padding:5px 5px 5px 14px; }
        .chat-input { flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:clamp(14px,3.5vw,15px);line-height:1.4;padding:4px 0;min-width:0; }
        .chat-input::placeholder { color:#5a7a9a; } .chat-input:disabled { opacity:.5; }
        .send-btn { width:36px;height:36px;border-radius:50%;flex-shrink:0;background:#2979ff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;transition:background .15s,transform .1s; }
        .send-btn:hover:not(:disabled){ background:#448aff; } .send-btn:active:not(:disabled){ transform:scale(.93); }
        .send-btn:disabled { background:#2c3e50;cursor:not-allowed;opacity:.5; }
        .blocked-notice { text-align:center;color:#ef5350;font-size:14px;padding:12px; }
        /* Modal */
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);padding:16px; }
        .modal-box { background:#17212b;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:fadeUp .25s ease; }
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .modal-box h3 { font-size:clamp(15px,4vw,17px);font-weight:700;margin-bottom:10px; }
        .modal-box p { font-size:clamp(12px,3vw,13.5px);color:#8fa9c0;line-height:1.55; }
        .modal-input { width:100%;margin-top:14px;background:#242f3d;border:1px solid #2b3e50;border-radius:10px;padding:10px 14px;color:#fff;font-size:clamp(13px,3.5vw,14.5px);outline:none; }
        .modal-input:focus { border-color:#2979ff; }
        .modal-actions { display:flex;gap:8px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap; }
        .modal-btn { padding:8px 16px;border-radius:10px;font-size:clamp(12px,3.5vw,14px);font-weight:600;cursor:pointer;border:none;transition:opacity .15s; }
        .modal-btn.cancel { background:#242f3d;color:#8fa9c0; }
        .modal-btn.confirm { background:#2979ff;color:#fff; }
        .modal-btn:hover { opacity:.85; }
        .modal-btn:disabled { opacity:.5;cursor:not-allowed; }
        /* Toast */
        .toast { position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e2d3d;border:1px solid #2b3e50;color:#fff;padding:10px 18px;border-radius:20px;font-size:clamp(12px,3vw,13.5px);z-index:200;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:fadeUp .25s ease;max-width:calc(100vw - 32px);text-align:center; }
        .check { color:#7ab3ef; }
        @media (max-width:360px) {
          .avatar { width:32px;height:32px;font-size:16px; }
          .bubble { max-width:85%; }
        }
      `}</style>

      <div className="chat-root">
        {/* Header */}
        <div className="chat-header">
          <div className="avatar" style={{ position: 'relative' }}>
            🥋 <span className="online-dot"></span>
          </div>
          <div className="header-info">
            <div className="header-name">REFEREE AI ASSISTANT</div>
            <div className="header-status">
              {isLoading ? '✏️ sedang mengetik...' : 'Ahli Peraturan WKF 2026 · Online'}
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn quiz-btn" onClick={() => onStartQuiz(messages)} title="Mulai Quiz">
              <HelpCircle size={15} /> Quiz
            </button>
            <button className="icon-btn" onClick={() => setShowEndModal(true)} title="Menu" style={{ color: '#7ab3ef' }}>
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {/* Profile Bar */}
        <div className="profile-bar">
          <span>👤</span>
          <span className="profile-chip">{profile.name}</span>
          <span className="profile-chip">🥋 {profile.belt}</span>
          {profile.club && <span className="profile-chip">🏯 {profile.club}</span>}
        </div>

        {/* Messages */}
        <div className="messages-area" ref={chatRef}>
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const showAv = msg.role === 'assistant' && (isLast || messages[idx + 1]?.role !== 'assistant');
            return (
              <div key={msg.id} className={`msg-row ${msg.role}`}>
                {msg.role === 'assistant' && <div className={`msg-avatar ${showAv ? '' : 'hidden'}`}>🥋</div>}
                <div className={`bubble ${msg.role}`}>
                  {msg.role === 'assistant' ? <MessageContent text={msg.text} /> : <span>{msg.text}</span>}
                  <div className="bubble-time">
                    {msg.time}{msg.role === 'user' && <span className="check"> ✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="typing-row">
              <div className="msg-avatar">🥋</div>
              <div className="typing-bubble">
                <div className="dot"/><div className="dot"/><div className="dot"/>
              </div>
            </div>
          )}

          {cooldown > 0 && (
            <div className="cooldown-banner">
              😵‍💫 Energi Ki habis! Minum air putih dulu...<br />
              <strong>{cooldown} detik</strong> menuju ronde selanjutnya!
            </div>
          )}

          {ended && (
            <div className="ended-banner">
              ✅ <strong>Percakapan telah diakhiri.</strong><br />Terima kasih sudah belajar bersama Referee AI!
              <div className="ended-actions">
                <button className="ended-btn pdf" onClick={savePDF}><Download size={14} /> Simpan PDF</button>
                <button className="ended-btn email" onClick={() => setShowEmailModal(true)}><Mail size={14} /> Kirim Email</button>
                <button className="ended-btn quiz" onClick={() => onStartQuiz(messages)}><HelpCircle size={14} /> Mulai Quiz</button>
                <button className="ended-btn" onClick={onLogout}
                  style={{ background: '#1e2d3d', border: '1px solid #2b3e50', color: '#90caf9' }}>
                  <Home size={14} /> Halaman Depan
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          {blocked ? (
            <div className="blocked-notice">🚫 Sesi diblokir. Muat ulang halaman untuk memulai lagi.</div>
          ) : ended ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="ended-btn pdf" onClick={savePDF}><Download size={14} /> Simpan PDF</button>
              <button className="ended-btn email" onClick={() => setShowEmailModal(true)}><Mail size={14} /> Kirim Email</button>
              <button className="ended-btn" onClick={onLogout}
                style={{ background: '#1e2d3d', border: '1px solid #2b3e50', color: '#90caf9', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Home size={14} /> Halaman Depan
              </button>
            </div>
          ) : (
            <div className="input-row">
              <input
                ref={inputRef}
                className="chat-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={cooldown > 0 ? `Tunggu ${cooldown} detik...` : 'Tulis pesan...'}
                disabled={isLoading || cooldown > 0 || blocked || ended}
                autoFocus
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!(input ?? '').trim() || isLoading || cooldown > 0 || blocked || ended}
              >
                <Send size={17} style={{ transform: 'translateX(1px)' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEndModal && (
        <EndModal
          onEndOnly={() => { setShowEndModal(false); setEnded(true); setShowEmailModal(true); }}
          onGoHome={() => { setShowEndModal(false); onLogout(); }}
          onCancel={() => setShowEndModal(false)}
        />
      )}
      {showEmailModal && (
        <EmailModal
          onSend={sendEmail}
          onCancel={() => setShowEmailModal(false)}
          isSending={isSendingEmail}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
