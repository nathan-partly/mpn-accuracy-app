"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-9 h-9 bg-brand-blue rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="text-grey-950 font-bold text-xl tracking-tight">Partly</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-grey-100 rounded-xl shadow-sm p-8">
          <div className="h-1 bg-brand-blue rounded-t-xl -mt-8 -mx-8 mb-8 rounded-tl-xl rounded-tr-xl" />
          <h1 className="text-grey-950 font-bold text-xl mb-1">
            Interpreter Metrics
          </h1>
          <p className="text-grey-400 text-sm mb-8">
            Sign in with your Partly Google account to continue.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/accuracy" })}
            className="w-full flex items-center justify-center gap-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
          >
            <GoogleIcon />
            Sign in with Google
          </button>
          <p className="text-grey-400 text-xs text-center mt-4">
            Access restricted to @partly.com accounts
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#fff" fillOpacity=".9"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#fff" fillOpacity=".8"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#fff" fillOpacity=".7"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff" fillOpacity=".6"/>
    </svg>
  );
}
