import { PropsWithChildren, useMemo } from "react";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { baseSepolia, mainnet, sepolia } from "wagmi/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-walletconnect";

export function Web3Provider({ children }: PropsWithChildren) {
  const config = useMemo(
    () =>
      getDefaultConfig({
        appName: "Kontra Dashboard",
        projectId,
        chains: [baseSepolia, sepolia, mainnet],
        ssr: false,
      }),
    [projectId]
  );

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider modalSize="compact" showRecentTransactions>
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
