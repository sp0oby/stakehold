"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { targetChain } from "@/lib/wagmi";
import { Spinner } from "./Spinner";
import { toast } from "sonner";

/**
 * Implements the four-state "primary-action slot" pattern from
 * ethskills/frontend-ux: a single button location that morphs through
 *
 *   [Not connected]  → Connect Wallet
 *   [Wrong network]  → Switch to Sepolia
 *   [Ready]          → renders children (the actual action button)
 *
 * Rendering the network-switch CTA in the page (not just the header
 * dropdown) is the difference between FAIL and PASS on qa/SKILL.md's
 * network gate check.
 */
export function ConnectGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!isConnected || !address) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal, connectModalOpen }) => (
          <button
            className="btn-primary w-full sm:w-auto"
            onClick={openConnectModal}
            disabled={connectModalOpen}
          >
            {connectModalOpen && <Spinner />}
            Connect wallet
          </button>
        )}
      </ConnectButton.Custom>
    );
  }

  if (chain?.id !== targetChain.id) {
    return (
      <button
        className="btn-primary w-full sm:w-auto"
        onClick={() =>
          switchChain(
            { chainId: targetChain.id },
            {
              onError: (e) => toast.error(e.message || "Could not switch network"),
            }
          )
        }
        disabled={isSwitching}
      >
        {isSwitching && <Spinner />}
        Switch to Sepolia
      </button>
    );
  }

  return <>{children}</>;
}
