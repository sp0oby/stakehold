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
            body="Paid for a repair? Funded new appliances? Handled property taxes? Submit a contribution with a receipt or invoice attached. It stays tied to that property and nowhere else."
          />
          <Step
            n="3"
            title="Smaller work clears on a delay, bigger work needs a full vote"
            body="For routine amounts under a set threshold, there&apos;s a short review window before the record goes in. Bigger line items are put to a co-owner vote, using everyone&apos;s ownership at the moment the item opened — you can&apos;t show up the same day to swing it. The lead operator can still cancel obvious junk during the window."
          />
          <Step
            n="4"
            title="The ownership split can shift"
            body="When a contribution is approved, new stakes go to the person who did the work — up to 5% of the cap table in one go, so a single line item can&apos;t rewrite the group overnight. Everyone else is adjusted proportionally."
          />
          <Step
            n="5"
            title="New stakes unlock over time"
            body="Fresh stakes from work earn-in stay locked for six months before they can move or vote. That window gives everyone time to spot anything that doesn&apos;t look right."
          />
          <Step
            n="6"
            title="Rental income is paid out"
            body="When rent is received, it can be posted to the group and split across co-owners in line with their stakes. You claim your portion whenever you want — no one else has to send it to you."
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
            def="A recorded claim that money or work went into the property, with proof attached. Co-owners can approve it, turn it down, or cancel it if something is off."
          />
          <Term
            term="Proposal"
            def="A co-owner vote on a larger line item. Everyone&apos;s weight is set when the item opens, so you can&apos;t change your stake the same day to game the result."
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
            def="Rental and pass-through income for the group, distributed in ETH. It accrues to you automatically; you collect when you&apos;re ready."
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
              "Switch the wallet to the preview test network the app is deployed on.",
              "Grab free test ETH from a public test faucet — you’ll need a little to cover a full round of interactions.",
              "Open the app and click Connect. That's it.",
            ]}
          />
          <Guide
            title="Submit a contribution"
            steps={[
              "Open the property you're contributing to and go to Contribute.",
              "Drag a receipt, invoice, or photo onto the drop zone — we store the file and link it to your submission.",
              "Enter the USD value. Smaller line items can clear on a short review delay; larger ones are put to a co-owner vote.",
              "After approval, anyone can finalise the line item and your new stake (with its earn-in lock) is recorded for you.",
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
              "Click Launch. A one-time setup fee is paid to the Stakehold treasury.",
              "Fill in the property identity, financials, and who holds what at day one — you can split the full stake across co-founders at launch.",
              "Attach a public information pack (photos, story) and a private legal bundle (deeds, insurance) the same way you upload other files.",
              "Submit. A dedicated co-ownership space is created for that building, and you start as the day-to-day operator unless you hand that role to a multisig.",
            ]}
          />
          <Guide
            title="Add a partner later"
            steps={[
              "From the property page, open Rental & yield → the My shares card → send a portion of your stake to the partner's wallet address.",
              "Ask the partner to turn on their voting power once from the same screen so their voice counts in decisions.",
              "Or have them join by contributing to the work of the place through the regular contribution path.",
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
            title="Ownership is out in the open"
            body="Stakes, votes, and income movements are all recorded where anyone can look them up. The numbers you see in the app are the same numbers on the public record."
          />
          <SafetyCard
            title="No whale takeovers"
            body="A single piece of work can earn in at most 5% of the cap table. Above a set dollar threshold, the group has to vote — and the vote is locked to ownership from when the line item opened, so a last-minute buy-in can't swing it."
          />
          <SafetyCard
            title="Vesting protects existing owners"
            body="New shares from approved contributions are locked for six months before they become transferable or votable. Existing owners always have time to react to a rebalance."
          />
          <SafetyCard
            title="Income is yours to collect"
            body="Rental and pass-through income is attributed to the group first, then you pull what you're owed to your own wallet when you want. The property operator can pause day-to-day actions in a crisis, but not quietly redirect income that already belongs to co-owners."
          />
          <SafetyCard
            title="Emergency pause without lock-out"
            body="The admin can pause governance and transfers in an emergency. Yield claims remain open — you are never trapped out of income you've already earned."
          />
        </div>
        <div className="mt-6 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-fg-muted">
          <strong className="text-warning">Testnet notice.</strong>{" "}
          {BRAND.name} currently runs on a public preview network. Preview funds
          have no monetary value and nothing on this site is a security, an
          investment, or a financial product. The code is published for anyone
          to read, but it has not undergone a formal third-party audit.
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq">
        <SectionTitle eyebrow="Common questions" title="FAQ" />
        <div className="space-y-4">
          <Faq
            q="What does it cost to use Stakehold?"
            a="Stakehold charges a flat setup fee to launch a new property, set by the protocol treasury. After that, you only pay the usual small network fee when you move money or take an action in your wallet."
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
            a="Files live in distributed storage, with a short fingerprint kept on the public record so they can't be quietly swapped. Property photos and marketing material can be public; private paperwork is only shown to people who already hold a stake in that building."
          />
          <Faq
            q="What happens if the platform goes away?"
            a="The property's rules and balances don't live in this website — they're on the open network, and any wallet or community-built tool can still interact with them. Stakehold is one interface; it isn't a gate that can disappear with your access."
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
          Connect a test-funded wallet, browse the properties on the
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
            Get test ETH ↗
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
