import { cn } from "@/lib/utils";
export function ContentContainer({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8", className)}>{children}</div>;
}
