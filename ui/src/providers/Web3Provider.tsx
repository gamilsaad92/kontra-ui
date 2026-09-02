import { PropsWithChildren, useMemo } from "react";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia, mainnet, sepolia } from "wagmi/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
export const isWalletConnectConfigured = Boolean(projectId);

export function Web3Provider({ children }: PropsWithChildren) {
  const config = useMemo(
    () =>
       isWalletConnectConfigured
        ? getDefaultConfig({
            appName: "Kontra Dashboard",
            projectId: projectId as string,
            chains: [baseSepolia, sepolia, mainnet],
            ssr: false,
          })
        : createConfig({
            chains: [baseSepolia, sepolia, mainnet],
            transports: {
              [baseSepolia.id]: http(),
              [sepolia.id]: http(),
              [mainnet.id]: http(),
            },
            ssr: false,
          }),
    [projectId]
  );

  return (
    <WagmiProvider config={config}>
        {isWalletConnectConfigured ? (
        <RainbowKitProvider modalSize="compact" showRecentTransactions>
          {children}
        </RainbowKitProvider>
      ) : (
        children
      )}
    </WagmiProvider>
  );
}
