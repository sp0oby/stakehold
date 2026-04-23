import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Docs",
  description: `How ${BRAND.name} works — contribute to a property, earn shares, claim yield.`,
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-20 animate-fade-in">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-3">
          Docs · {BRAND.name}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
          Own the work.{" "}
          <span className="text-accent">Not just the walls.</span>
        </h1>
        <p className="text-fg-muted mt-5 text-lg leading-relaxed">
          {BRAND.name} is a co-ownership platform for real estate. Instead of
          freezing the cap table on day one like traditional fractional
          ownership, {BRAND.name} lets the people who actually fund, maintain,
          and improve a property earn ownership over time. Rental income flows
          back to every owner automatically.
        </p>
        <p className="text-fg-muted mt-3 text-sm">
          This documentation covers how the platform works, how to participate,
          and what keeps it safe.
        </p>
      </section>

      {/* ── How it works (user journey) ───────────────────────────────────── */}
      <section id="how-it-works">
        <SectionTitle eyebrow="The short version" title="How it works" />
        <ol className="space-y-5">
          <Step
            n="1"
            title="A property is launched"
            body="Anyone can list a property on Stakehold. The launcher funds it, chooses their co-owners, and issues 1,000,000 shares split across the founding cap table. From that moment the property has its own governance, its own treasury, and its own rules."
          />
          <Step
            n="2"
            title="Co-owners contribute"
            body="Paid for a repair? Funded new appliances? Handled property taxes? Submit an on-chain contribution with a receipt or invoice pinned to IPFS. The contribution is scoped to a single property."
          />
          <Step
            n="3"
            title="Small contributions auto-approve, large ones go to a vote"
            body="Under the auto-approve threshold (default $500) a contribution passes after a short timelock. Larger contributions open a DAO vote — existing shareholders vote with their snapshotted ownership. The admin can cancel spam during the window."
          />
          <Step
            n="4"
            title="The cap table rebalances"
            body="When a contribution executes, new shares mint to the contributor in proportion to the work done, capped at 5% per execution so no single action can silently take over the property. Existing holders are diluted pro-rata."
          />
          <Step
            n="5"
            title="Newly minted shares vest"
            body="Rebalance grants unlock after a six-month cliff. This rewards long-term co-owners, discourages one-shot dilution attacks, and gives the DAO a window to react if something looks wrong."
          />
          <Step
            n="6"
            title="Rental income is paid out"
            body="Any party — property manager, tenant, rental platform — can deposit ETH into the property's Share token as rental income. The platform splits it pro-rata across every owner. You claim whenever you want."
          />
        </ol>
      </section>

      {/* ── Core concepts (glossary) ──────────────────────────────────────── */}
      <section id="concepts">
        <SectionTitle eyebrow="Vocabulary" title="Core concepts" />
        <dl className="grid gap-4 md:grid-cols-2">
          <Term
            term="Property"
            def="A single real-world property on Stakehold. Each property has its own token (shares), its own treasury, and its own governance. Properties don't share state."
          />
          <Term
            term="Shares"
            def="The cap-table units for a property — exactly 1,000,000 per property. Tradable, with built-in voting power. Fractional ownership is expressed as a percentage of the 1,000,000."
          />
          <Term
            term="Contribution"
            def="An on-chain claim that work or capital was put into the property, pinned to an IPFS receipt. Contributions can be approved, rejected, or cancelled by the property's governance."
          />
          <Term
            term="Proposal"
            def="A DAO vote triggered by contributions above the auto-approve threshold. Voting power is snapshotted at proposal creation — you can't buy shares the day of a vote to swing it."
          />
          <Term
            term="Timelock"
            def="A short waiting window between approval and execution. Lets the admin cancel fraudulent submissions and gives shareholders time to react to approved proposals."
          />
          <Term
            term="Vesting cliff"
            def="Newly minted shares are locked for six months. Protects against one-shot dilution and rewards holders who stay."
          />
          <Term
            term="Yield"
            def="Rental income distributed in ETH. Every holder accrues their share continuously; claim whenever you want, pay your own gas."
          />
          <Term
            term="Admin"
            def="The caller who launched the property (or a multisig they assigned). Can tune governance parameters, cancel spam contributions, update the legal-docs URI, and pause the property in an emergency. Cannot mint shares."
          />
        </dl>
      </section>

      {/* ── User guides ───────────────────────────────────────────────────── */}
      <section id="guides">
        <SectionTitle eyebrow="Step-by-step" title="User guides" />
        <div className="grid gap-4 md:grid-cols-2">
          <Guide
            title="Get started"
            steps={[
              "Install MetaMask, Rainbow, or any EVM wallet.",
              "Switch the wallet to the Sepolia testnet.",
              "Grab free test ETH from a Sepolia faucet — you'll need about 0.05 ETH to cover gas for a full round of interactions.",
              "Open the app and click Connect. That's it.",
            ]}
          />
          <Guide
            title="Submit a contribution"
            steps={[
              "Open the property you're contributing to and go to Contribute.",
              "Drag a receipt, invoice, or photo onto the drop-zone — it gets pinned to IPFS automatically.",
              "Enter the USD value of the contribution. Under the threshold it auto-approves; above it, it goes to a DAO vote.",
              "Submit. After approval + timelock, anyone can execute your contribution and mint your vested shares.",
            ]}
          />
          <Guide
            title="Vote on a proposal"
            steps={[
              "Open a property and go to Proposals.",
              "Your voting power is your share balance at the moment the proposal was created.",
              "Vote Yes or No — one vote per address per proposal, no re-voting.",
              "After voting closes and the timelock elapses, anyone can execute the proposal.",
            ]}
          />
          <Guide
            title="Claim rental yield"
            steps={[
              "Open a property you own shares in and go to Yield.",
              "Your claimable balance updates in real time as rent is deposited.",
              "Click Claim — the ETH is sent directly to your wallet. You pay a small claim gas fee and nothing else.",
              "You can claim as often or as rarely as you like; nothing expires.",
            ]}
          />
          <Guide
            title="Launch your own property"
            steps={[
              "Click Launch in the top nav. A flat launch fee is paid into the protocol treasury.",
              "Fill in the property identity, financials, and cap table — you can split the 1,000,000 shares across co-founders at launch.",
              "Attach a public metadata bundle (photos, description) and a gated legal docs bundle (deeds, insurance) pinned to IPFS.",
              "Submit. The factory deploys your property's contracts atomically and hands you admin control.",
            ]}
          />
          <Guide
            title="Add a partner later"
            steps={[
              "Transfer shares to the partner's address from the property's share token.",
              "Ask the partner to self-delegate once so their voting power activates.",
              "Alternatively, the partner can earn in by contributing work to the property and going through the normal contribution flow.",
            ]}
          />
        </div>
      </section>

      {/* ── Trust & safety ────────────────────────────────────────────────── */}
      <section id="safety">
        <SectionTitle eyebrow="What keeps it honest" title="Trust &amp; safety" />
        <div className="grid gap-4 md:grid-cols-2">
          <SafetyCard
            title="Every property is isolated"
            body="Each property has its own cap table, its own treasury, and its own governance. A problem on one property never propagates to another — there's no shared pool that all properties dip into."
          />
          <SafetyCard
            title="Ownership is transparent on-chain"
            body="Shares are an ERC-20 token you can see in any wallet or block explorer. Every contribution, vote, and yield payment is a public transaction — there are no hidden ledger states."
          />
          <SafetyCard
            title="No whale takeovers"
            body="A single contribution can mint at most 5% of total supply. Above a configurable threshold, contributions require a DAO vote at a snapshotted moment in time — late buyers can't swing decisions."
          />
          <SafetyCard
            title="Vesting protects existing owners"
            body="New shares from approved contributions are locked for six months before they become transferable or votable. Existing owners always have time to react to a rebalance."
          />
          <SafetyCard
            title="Pull-based yield, no custodian"
            body="Rental income sits in the property's Share contract. You claim it directly with your wallet — no intermediary holds your money, and no admin can redirect yield away from shareholders."
          />
          <SafetyCard
            title="Emergency pause without lock-out"
            body="The admin can pause governance and transfers in an emergency. Yield claims remain open — you are never trapped out of income you've already earned."
          />
        </div>
        <div className="mt-6 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-fg-muted">
          <strong className="text-warning">Testnet notice.</strong>{" "}
          {BRAND.name} currently runs on the Sepolia test network. Testnet ETH
          has no monetary value and nothing on this site is a security, an
          investment, or a financial product. Contracts are verified on
          Sepolia Etherscan but have not undergone a formal audit.
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq">
        <SectionTitle eyebrow="Common questions" title="FAQ" />
        <div className="space-y-4">
          <Faq
            q="What does it cost to use Stakehold?"
            a="Stakehold itself charges a flat fee to launch a new property (set by the protocol treasury). Everything else — contributing, voting, executing, claiming yield — only costs the network gas fee for the transaction you send."
          />
          <Faq
            q="Can I lose my shares?"
            a="Your shares can be diluted when other contributors earn in — that's the whole point of a dynamic cap table — but they cannot be seized. No admin can burn, confiscate, or redirect your shares. Transfers require your signature."
          />
          <Faq
            q="Can someone submit a bogus contribution to my property?"
            a="Anyone can submit a contribution, but submission alone doesn't mint shares. Small contributions sit in a timelock during which the property admin can cancel them. Large contributions require shareholders to vote yes — no honest shareholder approves a fake. Worst case, a griefer wastes their own gas."
          />
          <Faq
            q="What's the difference between shareholders and the admin?"
            a="Shareholders vote on contributions, earn yield, and collectively control the property. The admin is a single operational role — typically the launcher or a multisig — that can pause in emergencies, cancel spam, and tune governance parameters. The admin cannot mint shares or seize assets."
          />
          <Faq
            q="How is my voting power determined?"
            a="Your voting power equals your share balance at the block the proposal was created. Buying more shares after a proposal is live will not give you more votes on that proposal."
          />
          <Faq
            q="Where are receipts and legal documents stored?"
            a="On IPFS — the decentralized storage network. The platform pins your file through Filebase and records a cryptographic hash of the content on-chain. The file itself lives on IPFS and stays reachable through any gateway. Legal documents are only surfaced in the UI to verified shareholders of the property."
          />
          <Faq
            q="What happens if the platform goes away?"
            a="Properties keep working. The contracts are public, deployed on Sepolia, and every function — claiming yield, transferring shares, voting — is callable directly from Etherscan or any Ethereum tool. This frontend is just one client for the underlying protocol."
          />
          <Faq
            q="Is the code open source?"
            a="Yes. Contracts, tests, and the web app are all public, linked from the footer."
          />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="card bg-gradient-to-br from-accent/10 to-accent/5 border-accent/25">
        <h2 className="text-xl font-bold">Try it yourself</h2>
        <p className="text-fg-muted mt-2 max-w-lg">
          Connect a Sepolia-funded wallet, browse the properties on the
          platform, or launch one of your own. The whole round-trip takes a
          few minutes.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/properties" className="btn-primary">
            Browse properties
          </Link>
          <Link href="/launch" className="btn-secondary">
            Launch a property
          </Link>
          <a
            href="https://sepoliafaucet.com/"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            Get Sepolia ETH ↗
          </a>
        </div>
      </section>
    </div>
  );
}

// ── building blocks ────────────────────────────────────────────────────────

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-bold">{title}</h2>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span
        className="shrink-0 w-9 h-9 rounded-full bg-accent/15 border border-accent/30 text-accent grid place-items-center font-semibold text-sm tabular-nums"
        aria-hidden
      >
        {n}
      </span>
      <div>
        <h3 className="font-semibold text-fg">{title}</h3>
        <p className="text-fg-muted mt-1 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function Term({ term, def }: { term: string; def: string }) {
  return (
    <div className="card">
      <dt className="font-semibold text-fg">{term}</dt>
      <dd className="text-sm text-fg-muted mt-1.5 leading-relaxed">{def}</dd>
    </div>
  );
}

function SafetyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-fg">{title}</h3>
      <p className="text-sm text-fg-muted mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

function Guide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-fg mb-3">{title}</h3>
      <ol className="space-y-2 text-sm text-fg-muted list-decimal list-inside marker:text-accent/70 marker:font-medium">
        {steps.map((s, i) => (
          <li key={i} className="leading-relaxed">
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group card cursor-pointer">
      <summary className="font-semibold text-fg list-none flex items-center justify-between gap-4">
        {q}
        <span
          aria-hidden
          className="text-fg-muted text-lg leading-none transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="text-fg-muted mt-3 leading-relaxed">{a}</p>
    </details>
  );
}
