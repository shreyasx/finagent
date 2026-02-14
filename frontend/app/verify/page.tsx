"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/auth";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            <p className="mt-4 text-sm text-neutral-500">Verifying your email...</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Verified
            </h1>
            <p className="mt-3 text-sm text-neutral-500">
              {message}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Verification failed
            </h1>
            <p className="mt-3 text-sm text-neutral-500">
              {message}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
