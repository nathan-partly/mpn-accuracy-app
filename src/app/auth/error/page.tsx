"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const messages: Record<string, string> = {
    AccessDenied:
      "Your Google account is not authorised. Only @partly.com accounts can access this app.",
    Configuration: "There is a server configuration error. Contact the platform team.",
    Default: "An unexpected error occurred during sign in.",
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-xl font-bold">!</span>
        </div>
        <h1 className="text-grey-950 font-bold text-lg mb-2">Sign in failed</h1>
        <p className="text-grey-400 text-sm mb-6">
          {messages[error ?? "Default"] ?? messages.Default}
        </p>
        <Link
          href="/auth/signin"
          className="inline-block bg-brand-blue text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
