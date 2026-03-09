"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("/crm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next && next.startsWith("/")) {
      setNextPath(next);
    }
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        style={{
          width: 380,
          maxWidth: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 18,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Giriş</h1>
        <p style={{ marginTop: 8, color: "#4b5563", fontSize: 14 }}>
          Email ve şifren ile giriş yap.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Şifre
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          <button
            disabled={busy}
            type="submit"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {busy ? "..." : "Giriş Yap"}
          </button>

          {msg ? (
            <div
              style={{
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                padding: 10,
                borderRadius: 10,
              }}
            >
              {msg}
            </div>
          ) : null}
        </form>

        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a href="/forgot-password" style={{ fontSize: 13, color: "#111827" }}>
            Şifremi unuttum
          </a>
        </div>
      </div>
    </main>
  );
}