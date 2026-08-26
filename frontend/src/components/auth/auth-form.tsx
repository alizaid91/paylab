"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-error";
import { login, register } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";

const password = z.string().min(8, "Password must be at least 8 characters").max(128).regex(/[a-z]/, "Include a lowercase letter").regex(/[A-Z]/, "Include an uppercase letter").regex(/[0-9]/, "Include a number");
const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email address"), password: z.string().min(1, "Password is required") });
const registerSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(200), email: z.string().trim().email("Enter a valid email address"), password, merchantName: z.string().trim().min(1, "Merchant name is required").max(200) });
type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

const Field = React.forwardRef<HTMLInputElement, FieldProps>(({ label, error, ...props }, ref) => {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span><input {...props} ref={ref} className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />{error && <span className="text-xs text-destructive">{error}</span>}</label>;
});
Field.displayName = "Field";

function ApiMessage({ error }: { error: Error | null }) {
  if (!error) return null;
  return <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error instanceof ApiError ? error.message : "Unable to complete your request. Please try again."}</p>;
}

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({ mutationFn: login, onSuccess: (data) => { window.sessionStorage.setItem("paylab_access_token", data.accessToken); queryClient.setQueryData(["auth", "me"], { user: data.user, merchant: data.merchant }); router.replace("/dashboard"); } });
  return <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5"><Field label="Email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} error={form.formState.errors.email?.message} /><Field label="Password" type="password" autoComplete="current-password" placeholder="Your password" {...form.register("password")} error={form.formState.errors.password?.message} /><ApiMessage error={mutation.error} /><Button className="h-10 w-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Signing in..." : "Sign in"}</Button><p className="text-center text-sm text-muted-foreground">Don&apos;t have an account? <Link href="/register" className="font-medium text-accent hover:underline">Create one</Link></p></form>;
}

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const mutation = useMutation({ mutationFn: (values: RegisterValues) => register({ email: values.email, password: values.password, merchant: { name: values.merchantName, slug: values.merchantName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "merchant", defaultCurrency: "USD", timezone: "UTC" } }), onSuccess: (data) => { window.sessionStorage.setItem("paylab_access_token", data.accessToken); queryClient.setQueryData(["auth", "me"], { user: data.user, merchant: data.merchant }); router.replace("/dashboard"); } });
  return <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5"><Field label="Name" autoComplete="name" placeholder="Your name" {...form.register("name")} error={form.formState.errors.name?.message} /><Field label="Email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} error={form.formState.errors.email?.message} /><Field label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register("password")} error={form.formState.errors.password?.message} /><Field label="Merchant name" autoComplete="organization" placeholder="Your business name" {...form.register("merchantName")} error={form.formState.errors.merchantName?.message} /><ApiMessage error={mutation.error} /><Button className="h-10 w-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating account..." : "Create account"}</Button><p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link></p></form>;
}
