import { redirect } from 'next/navigation';

// AD-only cutover: parola sıfırlama ekranı kalıcı olarak kapatıldı.
export default function ForgotPasswordPage() {
  redirect('/login');
}
