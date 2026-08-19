import { redirect } from 'next/navigation';

// AD-only cutover: parola değiştirme ekranı kalıcı olarak kapatıldı.
export default function ResetPasswordPage() {
  redirect('/login');
}
