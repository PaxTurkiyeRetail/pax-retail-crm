import { redirect } from "next/navigation";

// Kök sayfa — oturum kontrolü middleware'de yapılır,
// session varsa /crm'e, yoksa /login'e yönlendirilir.
export default function RootPage() {
  redirect("/crm");
}
