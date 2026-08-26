"use client";
import { ErrorState } from "@/components/states/error-state";
export default function GlobalError() { return <div className="p-8"><ErrorState message="We couldn't load this page." /></div>; }
