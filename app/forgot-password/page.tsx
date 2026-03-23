"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { setMsg({ type: "err", text: error.message }); return; }
      setMsg({ type: "ok", text: "Şifre sıfırlama bağlantısı email adresinize gönderildi." });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Hata oluştu." });
    } finally { setBusy(false); }
  }

  return (
    <>
      <style>{`
        .auth-root { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--app-bg); }
        .auth-card { width: min(420px,100%); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); padding: 32px; display: grid; gap: 20px; }
        .auth-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing:-.03em; }
        .auth-sub { font-size: 13.5px; color: var(--text-3); line-height: 1.5; margin-top: 4px; }
        .auth-form { display: grid; gap: 14px; }
        .auth-submit { min-height: 44px; border-radius: var(--radius-md); border: none; background: var(--accent); color: #fff; font-weight: 800; font-size: 13.5px; cursor: pointer; transition: opacity 140ms; }
        .auth-submit:hover { opacity: .88; }
        .auth-submit:disabled { opacity: .6; cursor: not-allowed; }
        .auth-ok { font-size: 13px; color: var(--chip-green-color); background: var(--chip-green-bg); border: 1px solid var(--chip-green-bd); padding: 11px 14px; border-radius: var(--radius-md); }
        .auth-err { font-size: 13px; color: var(--chip-red-color); background: var(--chip-red-bg); border: 1px solid var(--chip-red-bd); padding: 11px 14px; border-radius: var(--radius-md); }
        .auth-back { font-size: 13px; font-weight: 700; color: var(--accent); }
      `}</style>
      <main className="auth-root">
        <div className="auth-card">
          <div>
            <div className="auth-title">Şifremi Unuttum</div>
            <div className="auth-sub">Email adresinize şifre sıfırlama bağlantısı göndereceğiz.</div>
          </div>
          <form onSubmit={onSubmit} className="auth-form">
            <div>
              <label className="pax-label">Email</label>
              <input className="pax-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@sirket.com" />
            </div>
            <button type="submit" disabled={busy} className="auth-submit">{busy ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}</button>
            {msg && <div className={msg.type === "ok" ? "auth-ok" : "auth-err"}>{msg.text}</div>}
          </form>
          <a href="/login" className="auth-back">← Girişe dön</a>
        </div>
      </main>
    </>
  );
}
