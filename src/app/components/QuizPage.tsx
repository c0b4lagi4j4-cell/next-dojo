'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Mail, RefreshCcw, CheckCircle, XCircle } from 'lucide-react';

export interface UserProfile { name: string; belt: string; club: string; }
export interface Message { id: string; role: 'user' | 'assistant'; text: string; time: string; }

interface QuizQuestion {
  question: string;
  answer: 'Benar' | 'Salah';
  explanation: string;
  source?: string;
  ref?: string;
}

type Phase = 'select_category' | 'loading' | 'quiz' | 'result';

export default function QuizPage({
  profile,
  onBack,
}: {
  profile: UserProfile;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('select_category');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [error, setError] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const startCooldown = useCallback((s: number) => {
    setCooldown(s);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(cooldownRef.current!); return 0; } return c - 1; });
    }, 1000);
  }, []);

  const loadQuiz = useCallback(async (cat?: string) => {
    const targetCat = typeof cat === 'string' ? cat : selectedCategory;
    if (cooldown > 0) return;
    setPhase('loading');
    setError('');
    setCurrent(0);
    setAnswers([]);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ belt: profile.belt, category: targetCat }),
      });
      const data = await res.json();
      
      if (res.status === 429 || data.error === '429') {
        startCooldown(60);
        throw new Error('429');
      }
      
      if (!res.ok) throw new Error(data.error || 'Gagal memuat quiz');
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setPhase('quiz');
    } catch (e: any) {
      if (e.message === '429') {
        setError('⚠️ Sensei, Anda meminta soal terlalu cepat! Sesuai aturan WKF, mari kita tenangkan pikiran (Cooldown) sebelum lanjut berlatih.');
      } else {
        setError(e.message || 'Terjadi kesalahan saat memuat soal quiz.');
      }
    }
  }, [profile.belt, cooldown, startCooldown, selectedCategory]);

  const handleAnswer = (choice: string) => {
    const newAnswers = [...answers];
    newAnswers[current] = choice;
    setAnswers(newAnswers);
    setTimeout(() => {
      if (current < questions.length - 1) setCurrent(c => c + 1);
      else setPhase('result');
    }, 600);
  };

  const score = answers.filter((a, i) => a === questions[i]?.answer).length;

  // PDF
  const savePDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;
      const margin = 15;
      const pageW = doc.internal.pageSize.getWidth();
      const usableW = pageW - margin * 2;

      doc.setFontSize(16); doc.setTextColor(41, 121, 255);
      doc.text('REFEREE AI ASSISTANT — Hasil Quiz WKF 2026', margin, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(100, 100, 100);
      doc.text(`Nama: ${profile.name} | Sabuk: ${profile.belt} | Dojo: ${profile.club || '-'}`, margin, y); y += 5;
      doc.text(`Tanggal: ${new Date().toLocaleString('id-ID')} | Skor: ${score}/${questions.length}`, margin, y); y += 8;
      doc.setDrawColor(200, 200, 200); doc.line(margin, y, pageW - margin, y); y += 6;

      questions.forEach((q, i) => {
        const userAns = answers[i] || '-';
        const correct = userAns === q.answer;
        
        doc.setFontSize(10.5);
        const qLines = doc.splitTextToSize(`${i + 1}. ${q.question}`, usableW);
        doc.setFontSize(9.5);
        const expLines = doc.splitTextToSize(`Penjelasan: ${q.explanation}`, usableW);
        
        const totalBlockHeight = (qLines.length * 5) + 6 + (expLines.length * 5) + 8;
        
        // Pindah halaman jika blok soal tidak muat
        if (y + totalBlockHeight > 280) { doc.addPage(); y = 20; }
        
        doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
        doc.text(qLines, margin, y); y += qLines.length * 5 + 3;
        
        doc.setFontSize(9.5);
        doc.setTextColor(correct ? 0 : 200, correct ? 130 : 0, 0);
        doc.text(`Jawaban Anda: ${userAns}  |  Jawaban Benar: ${q.answer}  —  ${correct ? '✓ Benar' : '✗ Salah'}`, margin, y); y += 5;
        
        doc.setTextColor(90, 90, 90);
        doc.text(expLines, margin, y); y += expLines.length * 5 + 8;
      });

      doc.save(`QuizWKF_${profile.name}_${Date.now()}.pdf`);
      showToast('✅ PDF berhasil diunduh!');
    } catch { showToast('❌ Gagal membuat PDF.'); }
  };

  // Email
  const sendEmail = async () => {
    if (!emailInput.includes('@')) return;
    setIsSending(true);
    try {
      let chatText = `HASIL QUIZ WKF 2026\nSkor Akhir: ${score} dari ${questions.length}\n---\n\n`;
      questions.forEach((q, i) => {
        chatText += `Q${i + 1}: ${q.question}\n`;
        chatText += `Jawaban Anda: ${answers[i]}\n`;
        chatText += `Jawaban Benar: ${q.answer}\n`;
        chatText += `Penjelasan: ${q.explanation}\n\n`;
      });

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: emailInput,
          subject: `Hasil Quiz WKF - ${profile.name}`,
          textBody: `Halo,\n\nBerikut adalah hasil quiz WKF dari Referee AI Assistant:\nNama: ${profile.name}\nSabuk: ${profile.belt}\nDojo: ${profile.club || '-'}\n\n---\n\n${chatText}`,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Gagal mengirim email');

      setShowEmailModal(false);
      showToast('✅ Email hasil quiz berhasil dikirim!');
    } catch (e: any) {
      showToast(`❌ Gagal: ${e.message}`);
    } finally { setIsSending(false); }
  };

  const getScoreLabel = () => {
    const pct = (score / questions.length) * 100;
    if (pct === 100) return { label: '🏆 SEMPURNA!', color: '#ffd700' };
    if (pct >= 80) return { label: '🥋 Sangat Baik!', color: '#4caf50' };
    if (pct >= 60) return { label: '👍 Cukup Baik', color: '#2979ff' };
    if (pct >= 40) return { label: '📚 Perlu Belajar Lagi', color: '#ff9800' };
    return { label: '💪 Semangat Berlatih!', color: '#ef5350' };
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .quiz-root { display:flex;flex-direction:column;height:100dvh;width:100%;background:#0e1621;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden; }
        .quiz-header { display:flex;align-items:center;gap:8px;padding:10px 12px;background:#17212b;border-bottom:1px solid #0d1821;flex-shrink:0;min-width:0; }
        .quiz-header h2 { flex:1;font-size:clamp(14px,4vw,16px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .quiz-body { flex:1;overflow-y:auto;padding:14px 12px;-webkit-overflow-scrolling:touch; }
        .quiz-body::-webkit-scrollbar { width:4px; } .quiz-body::-webkit-scrollbar-thumb { background:#2b3e50;border-radius:4px; }
        /* Loading */
        .loading-box { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:#7ab3ef; }
        .spinner { width:44px;height:44px;border:4px solid #1e2d3d;border-top:4px solid #2979ff;border-radius:50%;animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        /* Progress */
        .progress-bar-wrap { background:#1e2d3d;border-radius:20px;height:6px;margin-bottom:16px; }
        .progress-bar-fill { height:6px;border-radius:20px;background:linear-gradient(90deg,#2979ff,#7c4dff);transition:width .4s ease; }
        .question-card { background:#17212b;border-radius:14px;padding:16px;margin-bottom:12px; }
        .question-num { font-size:clamp(10px,2.5vw,11.5px);color:#7ab3ef;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px; }
        .question-text { font-size:clamp(14px,3.5vw,15.5px);line-height:1.55;color:#e8edf2;font-weight:500; }
        .options-grid { display:flex;flex-direction:column;gap:10px;margin-top:14px; }
        .option-btn { display:flex;align-items:center;justify-content:center;padding:clamp(13px,4vw,16px);background:#1e2d3d;border:2px solid #243447;border-radius:12px;cursor:pointer;text-align:center;transition:all .2s;color:#d4dde8;font-size:clamp(14px,4vw,16px);font-weight:700;letter-spacing:1px;width:100%;outline:none;-webkit-appearance:none;appearance:none; }
        .option-btn:focus { outline:none; }
        .option-btn:focus-visible { outline:none; }
        .option-btn:not(:disabled):hover { border-color:#2979ff !important;background:rgba(41,121,255,.15) !important;color:#7ab3ef !important; }
        .option-btn.selected-correct { border-color:#4caf50;background:rgba(76,175,80,.12);color:#81c784; }
        .option-btn.selected-wrong { border-color:#ef5350;background:rgba(239,83,80,.12);color:#ef9a9a; }
        .option-btn:disabled { cursor:not-allowed;opacity:.7; }
        /* Results */
        .result-header { background:#17212b;border-radius:14px;padding:20px 16px;text-align:center;margin-bottom:16px; }
        .result-score { font-size:clamp(36px,10vw,52px);font-weight:800;margin:8px 0 4px;line-height:1; }
        .result-label { font-size:clamp(15px,4vw,18px);font-weight:700;margin-bottom:4px; }
        .result-sub { font-size:clamp(11px,3vw,13.5px);color:#7ab3ef;word-break:break-word; }
        .result-actions { display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap; }
        .result-btn { display:flex;align-items:center;gap:5px;padding:8px 16px;border-radius:20px;font-size:clamp(11px,3vw,13.5px);font-weight:600;cursor:pointer;border:none;transition:opacity .15s;white-space:nowrap; }
        .result-btn.pdf { background:#2979ff;color:#fff; }
        .result-btn.email { background:#7c4dff;color:#fff; }
        .result-btn.retry { background:#1e2d3d;color:#7ab3ef;border:1px solid #2b3e50; }
        .result-btn:hover { opacity:.85; }
        .result-item { background:#17212b;border-radius:12px;padding:14px;margin-bottom:10px;border-left:4px solid transparent; }
        .result-item.correct { border-left-color:#4caf50; }
        .result-item.wrong { border-left-color:#ef5350; }
        .result-q { font-size:clamp(13px,3.5vw,14px);color:#e8edf2;margin-bottom:10px;line-height:1.5; }
        .result-ans { font-size:clamp(11px,3vw,13px);display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;flex-wrap:wrap; }
        .result-explain { font-size:clamp(11px,3vw,12.5px);color:#6d8699;margin-top:8px;line-height:1.5;font-style:italic; }
        /* Modal */
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);padding:16px; }
        .modal-box { background:#17212b;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5); }
        .modal-box h3 { font-size:clamp(15px,4vw,17px);font-weight:700;margin-bottom:10px; }
        .modal-box p { font-size:clamp(12px,3vw,13.5px);color:#8fa9c0;margin-bottom:14px; }
        .modal-input { width:100%;background:#242f3d;border:1px solid #2b3e50;border-radius:10px;padding:10px 14px;color:#fff;font-size:clamp(13px,3.5vw,14px);outline:none;min-width:0; }
        .modal-input:focus { border-color:#2979ff; }
        .modal-actions { display:flex;gap:8px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap; }
        .modal-btn { padding:8px 16px;border-radius:10px;font-size:clamp(12px,3.5vw,14px);font-weight:600;cursor:pointer;border:none; }
        .modal-btn.cancel { background:#242f3d;color:#8fa9c0; }
        .modal-btn.confirm { background:#2979ff;color:#fff; }
        .modal-btn:disabled { opacity:.5;cursor:not-allowed; }
        .icon-btn { padding:7px;border-radius:50%;border:none;background:transparent;color:#7c8b97;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s; }
        .icon-btn:hover { background:rgba(255,255,255,.08);color:#fff; }
        
        /* Back Button */
        .back-btn { display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(239,83,80,0.15);border:1px solid rgba(239,83,80,0.3);color:#ef9a9a;border-radius:20px;font-size:clamp(11px,3vw,13px);font-weight:600;cursor:pointer;transition:all .2s; }
        .back-btn:hover { background:rgba(239,83,80,0.25);color:#fff;border-color:#ef5350; }
        .toast { position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e2d3d;border:1px solid #2b3e50;color:#fff;padding:10px 18px;border-radius:20px;font-size:clamp(12px,3vw,13.5px);z-index:200;max-width:calc(100vw - 32px);text-align:center; }
        @media (max-width:360px) {
          .quiz-body { padding:10px 10px; }
          .result-header { padding:16px 12px; }
        }
      `}</style>

      <div className="quiz-root">
        {/* Header */}
        <div className="quiz-header">
          <div style={{ fontSize: 22 }}>🎯</div>
          <h2>Quiz Peraturan WKF 2026</h2>
          {phase === 'quiz' && (
            <span style={{ fontSize: 13, color: '#7ab3ef' }}>{current + 1} / {questions.length}</span>
          )}
          <button className="back-btn" onClick={onBack}>
            <XCircle size={16} /> Tutup
          </button>
        </div>

        <div className="quiz-body">
          {/* Select Category */}
          {phase === 'select_category' && (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <h3 style={{ marginBottom: 24, fontSize: 'clamp(16px, 4.5vw, 20px)' }}>Pilih Topik Ujian</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto' }}>
                <button 
                  className="option-btn" 
                  onClick={() => { setSelectedCategory('kumite'); loadQuiz('kumite'); }}
                  style={{ background: 'linear-gradient(135deg, #1e2d3d, #243447)' }}
                >
                  🔴 Kumite Quiz
                </button>
                <button 
                  className="option-btn" 
                  onClick={() => { setSelectedCategory('kata'); loadQuiz('kata'); }}
                  style={{ background: 'linear-gradient(135deg, #1e2d3d, #243447)' }}
                >
                  🔵 Kata Quiz
                </button>
                <button 
                  className="option-btn" 
                  onClick={() => { setSelectedCategory('coach'); loadQuiz('coach'); }}
                  style={{ background: 'linear-gradient(135deg, #1e2d3d, #243447)' }}
                >
                  👔 Coach Quiz
                </button>
                <button 
                  className="option-btn" 
                  onClick={() => { setSelectedCategory('all'); loadQuiz('all'); }}
                  style={{ background: 'linear-gradient(135deg, #2979ff, #7c4dff)', borderColor: 'transparent' }}
                >
                  🎲 Campuran (Random)
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {phase === 'loading' && !error && (
            <div className="loading-box">
              <div className="spinner"></div>
              <p>Menyiapkan soal quiz untuk {profile.name}...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ textAlign: 'center', padding: 32, color: '#ef9a9a' }}>
              <p style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 400, margin: '0 auto 16px' }}>{error}</p>
              
              <button 
                className="result-btn retry" 
                onClick={() => loadQuiz()} 
                disabled={cooldown > 0}
                style={{ margin: '0 auto', display: 'inline-flex', opacity: cooldown > 0 ? 0.6 : 1, cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}
              >
                {cooldown > 0 ? (
                  `⏳ Tunggu ${cooldown} detik`
                ) : (
                  <><RefreshCcw size={14} /> Coba Lagi</>
                )}
              </button>
            </div>
          )}

          {/* Quiz */}
          {phase === 'quiz' && questions.length > 0 && (
            <>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${((current) / questions.length) * 100}%` }} />
              </div>
              <div className="question-card">
                <div className="question-num">Soal {current + 1} dari {questions.length}</div>
                <div className="question-text">{questions[current].question}</div>
              </div>
              <div className="options-grid">
                {(['Benar', 'Salah'] as const).map(opt => {
                  const chosen = answers[current];
                  let cls = 'option-btn true-false-btn';
                  if (chosen === opt) cls += chosen === questions[current].answer ? ' selected-correct' : ' selected-wrong';
                  if (opt === 'Benar') cls += ' btn-benar';
                  if (opt === 'Salah') cls += ' btn-salah';
                  return (
                    <button
                      key={opt}
                      className={cls}
                      onClick={() => !answers[current] && handleAnswer(opt)}
                      disabled={!!answers[current]}
                    >
                      <span className="tf-label">{opt.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Results */}
          {phase === 'result' && (
            <>
              <div className="result-header">
                <div style={{ fontSize: 13, color: '#7ab3ef', marginBottom: 4 }}>Quiz Selesai!</div>
                <div className="result-score" style={{ color: getScoreLabel().color }}>
                  {score}/{questions.length}
                </div>
                <div className="result-label" style={{ color: getScoreLabel().color }}>{getScoreLabel().label}</div>
                <div className="result-sub">{profile.name} · {profile.belt}</div>
                <div className="result-actions">
                  <button className="result-btn pdf" onClick={savePDF}><Download size={14} /> Simpan PDF</button>
                  <button className="result-btn email" onClick={() => setShowEmailModal(true)}><Mail size={14} /> Kirim Email</button>
                  <button className="result-btn retry" onClick={() => setPhase('select_category')}><RefreshCcw size={14} /> Quiz Baru</button>
                </div>
              </div>

              {questions.map((q, i) => {
                const ua = answers[i] || '-';
                const correct = ua === q.answer;
                return (
                  <div key={i} className={`result-item ${correct ? 'correct' : 'wrong'}`}>
                    <div className="result-q"><strong>{i + 1}.</strong> {q.question}</div>
                    <div className="result-ans">
                      {correct ? <CheckCircle size={14} color="#4caf50" /> : <XCircle size={14} color="#ef5350" />}
                      <span style={{ color: correct ? '#81c784' : '#ef9a9a' }}>
                        Jawaban Anda: <strong>{ua}</strong> — {correct ? 'Benar! 🎉' : `Salah. Jawaban benar: ${q.answer}`}
                      </span>
                    </div>
                    <div className="result-explain">💡 {q.explanation}</div>
                    {q.source && (
                      <div style={{ fontSize: 'clamp(10px,2.5vw,11px)', color: '#4a6478', marginTop: 5, fontStyle: 'italic' }}>
                        📄 {q.source} — {q.ref}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>📧 Kirim Hasil Quiz</h3>
            <p>Masukkan alamat email tujuan:</p>
            <input
              className="modal-input"
              type="email"
              placeholder="contoh@email.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowEmailModal(false)} disabled={isSending}>Batal</button>
              <button className="modal-btn confirm" onClick={sendEmail} disabled={isSending || !emailInput.includes('@')}>
                {isSending ? 'Mengirim...' : 'Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
