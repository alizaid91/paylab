import Link from "next/link";
import { LoginForm, RegisterForm } from "@/components/auth/auth-form";

export function AuthPage({ mode }: Readonly<{ mode: "login" | "register" }>) {
  const loginMode = mode === "login";
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"><div className="w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">P</span>PAYLAB</Link><div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8"><div className="mb-6"><h1 className="text-xl font-semibold tracking-tight">{loginMode ? "Welcome back" : "Create your account"}</h1><p className="mt-1 text-sm text-muted-foreground">{loginMode ? "Sign in to your revenue workspace." : "Start optimizing your merchant revenue."}</p></div>{loginMode ? <LoginForm /> : <RegisterForm />}</div></div></main>;
}
