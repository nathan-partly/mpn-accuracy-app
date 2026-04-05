"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

const sections = [
  {
    href: "/coverage",
    label: "Coverage",
    match: (p: string) => p.startsWith("/coverage"),
  },
  {
    href: "/accuracy",
    label: "Accuracy",
    match: (p: string) =>
      p === "/accuracy" || p.startsWith("/brands") || p === "/upload",
  },
  {
    href: "/quality",
    label: "Quality",
    match: (p: string) => p.startsWith("/quality"),
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-grey-100 h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/accuracy" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-blue rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-grey-950 text-sm">
            Interpreter Metrics
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                section.match(pathname)
                  ? "bg-brand-tint text-brand-blue"
                  : "text-grey-400 hover:text-grey-900 hover:bg-grey-50"
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          <span className="text-grey-400 text-xs hidden sm:block">
            {session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="text-xs text-grey-400 hover:text-grey-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
