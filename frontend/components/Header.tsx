"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

const nav = [
  { href: "/properties", label: "Properties" },
  { href: "/launch", label: "Launch" },
  { href: "/portfolio", label: "Portfolio", authOnly: true },
  { href: "/about", label: "About" },
];

export function Header() {
  const path = usePathname();
  const { isConnected } = useAccount();

  const visible = nav.filter((n) => !n.authOnly || isConnected);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl flex items-center gap-4 px-4 py-3 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-fg hover:opacity-90 transition-opacity"
          aria-label={`${BRAND.name} home`}
        >
          <Logo size={30} showWordmark={false} />
          <span className="hidden sm:inline font-semibold tracking-tight text-[15px]">
            {BRAND.name}
          </span>
        </Link>

        <span className="hidden md:inline-flex chip ml-1 border-accent/25 bg-accent/10 text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          {BRAND.network}
        </span>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {visible.map((n) => {
            const active =
              n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-fg"
                    : "text-fg-muted hover:text-fg hover:bg-surface-2"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <ConnectButton
            showBalance={false}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {visible.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors",
                active
                  ? "bg-surface-2 text-fg"
                  : "text-fg-muted hover:text-fg"
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
