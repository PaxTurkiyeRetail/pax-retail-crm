"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState(process.env.NEXT_PUBLIC_APP_DEFAULT_AUTH_ROUTE || "/crm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && next.startsWith("/")) setNextPath(next);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const pre = await fetch("/api/auth/allow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!pre.ok) {
        const j = await pre.json().catch(() => ({}));
        setMsg(j?.message || "Bu email ile giriş yetkin yok.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMsg(error.message); return; }
      router.replace(nextPath);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Beklenmeyen hata oluştu.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <style>{`
        .login-root {
          min-height: 100vh; display: grid; place-items: center; padding: 24px;
          background: var(--app-bg);
        }
        .login-shell {
          width: min(1080px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
          gap: 20px; align-items: stretch;
        }
        .login-showcase {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); box-shadow: var(--shadow-md);
          padding: 32px; display: grid; align-content: space-between;
          min-height: 560px;
        }
        .login-eyebrow {
          display: inline-flex; align-items: center; padding: 0 14px;
          min-height: 32px; border-radius: 999px;
          background: var(--accent-soft); border: 1px solid var(--accent-border);
          color: var(--accent); font-size: 12px; font-weight: 800;
        }
        .login-headline {
          margin: 14px 0 0; font-size: clamp(28px, 4.5vw, 48px);
          line-height: .97; letter-spacing: -.05em; font-weight: 800; color: var(--text);
        }
        .login-lead {
          margin: 14px 0 0; color: var(--text-3); font-size: 15px; max-width: 50ch; line-height: 1.5;
        }
        .login-features {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 24px;
        }
        .login-feature {
          border-radius: var(--radius-lg); border: 1px solid var(--border);
          background: var(--surface-2); padding: 16px; display: grid; gap: 6px;
        }
        .login-feature strong { font-size: 14px; color: var(--text); }
        .login-feature span { color: var(--text-3); font-size: 12.5px; line-height: 1.5; }

        .login-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); box-shadow: var(--shadow-md);
          padding: 32px; display: grid; align-content: center;
        }
        .login-panel-inner { display: grid; gap: 20px; }
        .login-panel h1 { font-size: 26px; letter-spacing: -.04em; color: var(--text); font-weight: 800; }
        .login-panel p { color: var(--text-3); font-size: 13.5px; line-height: 1.5; }
        .login-form { display: grid; gap: 14px; }
        .login-field { display: grid; gap: 6px; }
        .login-submit {
          min-height: 46px; border-radius: var(--radius-md);
          border: none; background: var(--accent);
          color: #fff; font-weight: 800; font-size: 14px; cursor: pointer;
          transition: opacity 140ms;
        }
        .login-submit:hover { opacity: .88; }
        .login-submit:disabled { opacity: .6; cursor: not-allowed; }
        .login-error {
          font-size: 13px; color: var(--chip-red-color);
          background: var(--chip-red-bg); border: 1px solid var(--chip-red-bd);
          padding: 11px 14px; border-radius: var(--radius-md);
        }
        .login-footer {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; flex-wrap: wrap;
        }
        .login-footer a { color: var(--accent); font-size: 13px; font-weight: 700; }
        .login-footer span { color: var(--text-4); font-size: 13px; }

        @media (max-width: 860px) {
          .login-shell { grid-template-columns: 1fr; }
          .login-showcase { min-height: auto; }
        }
        @media (max-width: 480px) {
          .login-root { padding: 12px; }
          .login-features { grid-template-columns: 1fr; }
          .login-showcase, .login-panel { padding: 20px; }
        }
      `}</style>

      <main className="login-root">
        <div className="login-shell">
          <section className="login-showcase">
            <div>
              <span className="login-eyebrow">Kurumsal CRM Platformu</span>
              <h2 className="login-headline">Müşteri, aktivite ve künye yönetimi tek akışta.</h2>
              <p className="login-lead">Account manager, RS ve ITSM ekipleri için hızlı, düzenli ve kurumsal CRM deneyimi.</p>
            </div>
            <div className="login-features">
              <div className="login-feature">
                <strong>Müşteri 360 görünümü</strong>
                <span>Künye, faz ve takip aksiyonlarını tek yerden yönetin.</span>
              </div>
              <div className="login-feature">
                <strong>Kompakt tablolar</strong>
                <span>Daha ince, okunur ve responsive ekran düzeni.</span>
              </div>
              <div className="login-feature">
                <strong>Hızlı operasyon</strong>
                <span>Kritik sayfalarda gereksiz karmaşayı azaltan arayüz.</span>
              </div>
              <div className="login-feature">
                <strong>Yetki kontrollü erişim</strong>
                <span>Allowlist ve rol tabanlı erişimle güvenli kullanım.</span>
              </div>
            </div>
          </section>

          <section className="login-panel">
            <div className="login-panel-inner">
              <div>
                <h1>Giriş Yap</h1>
                <p>Email ve şifrenle giriş yap. Yetkili kullanıcılar CRM paneline yönlendirilir.</p>
              </div>
              <form onSubmit={onSubmit} className="login-form">
                <label className="login-field">
                  <span className="pax-label">Email</span>
                  <input className="pax-input" value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="ornek@sirket.com" />
                </label>
                <label className="login-field">
                  <span className="pax-label">Şifre</span>
                  <input className="pax-input" value={password} onChange={e => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
                </label>
                <button disabled={busy} type="submit" className="login-submit">
                  {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
                </button>
                {msg && <div className="login-error">{msg}</div>}
              </form>
              <div className="login-footer">
                <span>PAX CRM</span>
                <a href="/forgot-password">Şifremi unuttum</a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
