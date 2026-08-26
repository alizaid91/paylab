export function LoadingState({ label = "Loading..." }: Readonly<{ label?: string }>) {
  return <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-accent" />{label}</div>;
}
