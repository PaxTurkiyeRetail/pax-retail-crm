"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Şifre güncellendi. CRM’ye yönlendiriliyorsun...");
      setTimeout(() => {
        router.replace("/crm");
        router.refresh();
      }, 600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 420, maxWidth: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Yeni Şifre</h1>
        <p style={{ marginTop: 8, color: "#4b5563", fontSize: 14 }}>Yeni şifreni belirle.</p>

        <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Yeni Şifre
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
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
            {busy ? "..." : "Şifreyi Güncelle"}
          </button>

          {msg ? (
            <div style={{ fontSize: 13, background: "#f3f4f6", padding: 10, borderRadius: 10 }}>{msg}</div>
          ) : null}
        </form>

        <div style={{ marginTop: 12 }}>
          <a href="/login" style={{ fontSize: 13, color: "#111827" }}>
            Giriş ekranına dön
          </a>
        </div>
      </div>
    </main>
  );
}