import Link from "next/link";
import Image from "next/image";
import { LoginForm, RegisterForm } from "@/components/auth/auth-form";

export function AuthPage({ mode }: Readonly<{ mode: "login" | "register" }>) {
  const loginMode = mode === "login";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-2 flex justify-center">
          <Image
            src="/logos/full_logo.png"
            alt="PAYLAB"
            width={180}
            height={60}
            className="h-16 w-auto object-contain border border-gray-400/50 rounded-2xl"
            priority
          />
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              {loginMode ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loginMode
                ? "Sign in to your revenue workspace."
                : "Start optimizing your merchant revenue."}
            </p>
          </div>
          {loginMode ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </main>
  );
}
