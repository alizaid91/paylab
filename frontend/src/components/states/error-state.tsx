import { AlertCircle } from "lucide-react";
export function ErrorState({ message = "Something went wrong." }: Readonly<{ message?: string }>) {
  return <div role="alert" className="flex min-h-32 items-center justify-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{message}</div>;
}
