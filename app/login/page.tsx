"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

      if (error) {
        setMsg(error.message);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Beklenmeyen hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <style jsx>{`
        .login-page {
          min-height: 100vh; display: grid; place-items: center; padding: 24px;
          background:
            radial-gradient(circle at 15% 20%, rgba(191,219,254,.5), transparent 28%),
            radial-gradient(circle at 85% 10%, rgba(226,232,240,.75), transparent 26%),
            linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%);
        }
        .shell {
          width: min(1120px, 100%); display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(380px, .9fr); gap: 22px; align-items: stretch;
        }
        .showcase, .panel {
          border: 1px solid #dbe4ef; border-radius: 28px; background: rgba(255,255,255,.92); box-shadow: 0 28px 60px rgba(15,23,42,.1);
        }
        .showcase {
          padding: 28px; display: grid; align-content: space-between; min-height: 620px;
          background: linear-gradient(160deg, rgba(255,255,255,.97) 0%, rgba(243,247,253,.94) 100%);
        }
        .eyebrow {
          display: inline-flex; width: fit-content; min-height: 34px; align-items: center; padding: 0 14px; border-radius: 999px;
          border: 1px solid #c8d6ea; background: #edf4ff; color: #1d4ed8; font-size: 12px; font-weight: 900;
        }
        .headline { margin: 16px 0 0; font-size: clamp(34px, 5vw, 54px); line-height: .98; letter-spacing: -.05em; }
        .lead { margin: 16px 0 0; color: #64748b; font-size: 16px; max-width: 52ch; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; margin-top: 26px; }
        .feature {
          border-radius: 22px; border: 1px solid #dbe4ef; background: #fff; padding: 18px; display: grid; gap: 8px;
        }
        .feature strong { font-size: 15px; }
        .feature span { color: #64748b; font-size: 13px; line-height: 1.5; }
        .panel { padding: 26px; display: grid; align-content: center; }
        .panel-inner { display: grid; gap: 18px; }
        .panel h1 { margin: 0; font-size: 30px; letter-spacing: -.04em; }
        .panel p { margin: 0; color: #64748b; font-size: 14px; }
        .form { display: grid; gap: 14px; }
        .field { display: grid; gap: 8px; }
        .label { font-size: 12px; font-weight: 900; color: #334155; }
        .input {
          width: 100%; min-height: 48px; border-radius: 16px; border: 1px solid #cdd8e6; padding: 0 14px;
          background: #fff; color: #0f172a; outline: none;
        }
        .input:focus { border-color: #94a3b8; box-shadow: 0 0 0 4px rgba(148,163,184,.16); }
        .submit {
          min-height: 50px; border-radius: 16px; border: 1px solid #0f172a; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white; font-weight: 900; cursor: pointer;
        }
        .submit:disabled { cursor: not-allowed; opacity: .7; }
        .message { font-size: 13px; color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px 14px; border-radius: 14px; }
        .footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .footer a { color: #0f172a; font-size: 13px; font-weight: 700; }
        @media (max-width: 980px) {
          .shell { grid-template-columns: 1fr; }
          .showcase { min-height: auto; }
        }
        @media (max-width: 640px) {
          .login-page { padding: 14px; }
          .showcase, .panel { border-radius: 22px; }
          .showcase, .panel { padding: 20px; }
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="shell">
        <section className="showcase">
          <div>
            <span className="eyebrow">Kurumsal CRM Platformu</span>
            <h2 className="headline">Müşteri, aktivite ve künye yönetimini tek akışta yönetin.</h2>
            <p className="lead">
              Account manager, RS ve ITSM ekipleri için hızlı çalışan, düzenli ve kurumsal CRM deneyimi.
            </p>
          </div>

          <div className="grid">
            <div className="feature">
              <strong>Müşteri 360 görünümü</strong>
              <span>Künye, faz ve takip aksiyonlarını tek yerden yönetin.</span>
            </div>
            <div className="feature">
              <strong>Kompakt tablolar</strong>
              <span>Daha ince, daha okunur ve responsive ekran düzeni.</span>
            </div>
            <div className="feature">
              <strong>Hızlı operasyon</strong>
              <span>Kritik sayfalarda gereksiz karmaşayı azaltan iş odaklı arayüz.</span>
            </div>
            <div className="feature">
              <strong>Yetki kontrollü erişim</strong>
              <span>Allowlist ve rol tabanlı erişimle güvenli kullanım.</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <div>
              <h1>Giriş</h1>
              <p>Email ve şifren ile giriş yap. Yetkili kullanıcılar CRM panellerine yönlendirilir.</p>
            </div>

            <form onSubmit={onSubmit} className="form">
              <label className="field">
                <span className="label">Email</span>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
              </label>

              <label className="field">
                <span className="label">Şifre</span>
                <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
              </label>

              <button disabled={busy} type="submit" className="submit">
                {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>

              {msg ? <div className="message">{msg}</div> : null}
            </form>

            <div className="footer">
              <span style={{ color: "#64748b", fontSize: 13 }}>PAX CRM</span>
              <a href="/forgot-password">Şifremi unuttum</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
