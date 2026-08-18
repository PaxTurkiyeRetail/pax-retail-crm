'use client';

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    } catch {
      // Ağ hatası olsa bile yönlendirme mutlaka gerçekleşmeli.
    } finally {
      window.location.replace('/login');
    }
  }

  return (
    <button type="button" className="pax-logout-btn" onClick={handleLogout}>
      Çıkış Yap
    </button>
  );
}
