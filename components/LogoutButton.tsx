'use client';

export default function LogoutButton({ className = 'pax-logout-btn' }: { className?: string }) {
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
    <button type="button" className={className} onClick={handleLogout}>
      Çıkış Yap
    </button>
  );
}
