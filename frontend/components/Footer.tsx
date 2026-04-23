import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { FACTORY_ADDRESS } from "@/lib/contracts";

export function Footer() {
  const etherscan =
    FACTORY_ADDRESS && FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000"
      ? `https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}`
      : null;

  return (
    <footer className="mt-16 border-t border-border bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size={28} />
          <p className="mt-3 text-sm text-fg-muted max-w-xs leading-relaxed">
            {BRAND.shortDescription}
          </p>
          <span className="mt-4 inline-flex chip border-accent/25 bg-accent/10 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {BRAND.version}
          </span>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: "/", label: "Home" },
            { href: "/properties", label: "Browse" },
            { href: "/launch", label: "Launch" },
            { href: "/portfolio", label: "Portfolio" },
          ]}
        />

        <FooterCol
          title="Protocol"
          links={[
            { href: "/about", label: "How it works" },
            { href: "/about#security", label: "Security" },
            { href: "/about#faq", label: "FAQ" },
            etherscan
              ? { href: etherscan, label: "Factory contract", external: true }
              : null,
          ].filter(Boolean) as { href: string; label: string; external?: boolean }[]}
        />

        <FooterCol
          title="Resources"
          links={[
            { href: "/about", label: "Docs" },
            { href: BRAND.githubUrl, label: "GitHub", external: true },
            {
              href: `${BRAND.githubUrl.replace(/\/$/, "")}/blob/main/SECURITY.md`,
              label: "Security policy",
              external: true,
            },
            {
              href: `${BRAND.githubUrl.replace(/\/$/, "")}/blob/main/LEGAL.md`,
              label: "Legal considerations",
              external: true,
            },
            { href: "https://sepoliafaucet.com/", label: "Get test ETH", external: true },
          ]}
        />
      </div>

      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-5 flex flex-col md:flex-row gap-2 md:items-center justify-between text-xs text-fg-muted">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Open-source software.
          </p>
          <p className="max-w-xl md:text-right">
            <strong className="text-fg-muted/90">Preview only.</strong>{" "}
            Running on a public test network. Shares represent demo ownership of
            a sample property — not legal title, not investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-fg mb-3">
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href + l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-fg-muted hover:text-fg transition-colors"
              >
                {l.label} ↗
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-fg-muted hover:text-fg transition-colors"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
