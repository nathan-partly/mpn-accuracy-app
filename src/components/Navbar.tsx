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
    upload: null,
  },
  {
    href: "/accuracy",
    label: "Accuracy",
    match: (p: string) =>
      p === "/accuracy" || p.startsWith("/brands") || p === "/upload",
    upload: { href: "/upload", label: "Upload Results" },
  },
  {
    href: "/quality",
    label: "Quality",
    match: (p: string) => p.startsWith("/quality"),
    upload: { href: "/quality/upload", label: "New Snapshot" },
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const activeSection = sections.find((s) => s.match(pathname));

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-grey-100 h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-8">
        {/* Logo */}
        <Link href="/accuracy" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 bg-brand-blue rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-grey-950 text-sm">Interpreter Metrics</span>
        </Link>

        {/* Nav tabs — centred in remaining space */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
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

        {/* Right side — fixed width so layout never shifts between pages */}
        <div className="flex items-center gap-4 flex-shrink-0 w-56 justify-end">
          {/* Upload link: always occupies space; invisible when not applicable */}
          <Link
            href={activeSection?.upload?.href ?? "#"}
            aria-hidden={!activeSection?.upload}
            tabIndex={activeSection?.upload ? 0 : -1}
            className={clsx(
              "text-xs font-semibold transition-colors whitespace-nowrap",
              !activeSection?.upload && "invisible pointer-events-none",
              activeSection?.upload && pathname === activeSection.upload.href
                ? "text-brand-blue"
                : "text-grey-400 hover:text-grey-900"
            )}
          >
            {activeSection?.upload?.label ?? "Upload"}
          </Link>

          <span className="text-grey-400 text-xs hidden sm:block truncate max-w-36">
            {session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="text-xs text-grey-400 hover:text-grey-900 transition-colors flex-shrink-0"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
