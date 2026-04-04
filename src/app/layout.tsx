import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "MPN Accuracy | Partly",
  description: "Interpreter accuracy benchmarking dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          {session && <Navbar />}
          <main className={session ? "pt-16" : ""}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
