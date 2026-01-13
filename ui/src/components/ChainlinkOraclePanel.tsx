import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { isAddress } from "viem";

const oracleAbi = [
  {
    type: "function",
    name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setPoolFeed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "feed", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "poolFeed",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ name: "feed", type: "address" }],
  },
  {
    type: "function",
    name: "latestPrice",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ name: "price", type: "int256" }],
  },
  {
    type: "function",
    name: "feedDescription",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ name: "description", type: "string" }],
  },
] as const;

type Props = {
  apiBase?: string;
};

type ReadResults = {
  poolFeed?: string | null;
  latestPrice?: string | null;
  feedDescription?: string | null;
};

export default function ChainlinkOraclePanel({ apiBase }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [poolAddress, setPoolAddress] = useState("");
  const [priceFeedAddress, setPriceFeedAddress] = useState("");
  const [operatorAddress, setOperatorAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [readResults, setReadResults] = useState<ReadResults>({});

  const oracleAddress = useMemo(() => poolAddress.trim(), [poolAddress]);
  const poolTarget = useMemo(() => poolAddress.trim(), [poolAddress]);
  const feedTarget = useMemo(() => priceFeedAddress.trim(), [priceFeedAddress]);
  const operatorTarget = useMemo(() => operatorAddress.trim(), [operatorAddress]);

  const canWrite = Boolean(walletClient && address && isAddress(oracleAddress));
  const canRead = Boolean(publicClient && isAddress(oracleAddress));

  const resolveBaseLabel = () => {
    if (!apiBase) return "Wallet + RPC";
    return "Wallet + RPC";
  };

  const handleSetOperator = async () => {
    if (!canWrite) {
      setStatus("Connect a wallet and enter a valid pool/oracle address.");
      return;
    }
    if (!operatorTarget || !isAddress(operatorTarget)) {
      setStatus("Enter a valid operator address.");
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      await walletClient.writeContract({
        address: oracleAddress as `0x${string}`,
        abi: oracleAbi,
        functionName: "setOperator",
        args: [operatorTarget as `0x${string}`],
      });
      setStatus("Operator update submitted.");
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to set operator.";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetPoolFeed = async () => {
    if (!canWrite) {
      setStatus("Connect a wallet and enter a valid pool/oracle address.");
      return;
    }
    if (!poolTarget || !isAddress(poolTarget)) {
      setStatus("Enter a valid pool address.");
      return;
    }
    if (!feedTarget || !isAddress(feedTarget)) {
      setStatus("Enter a valid price feed address.");
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      await walletClient.writeContract({
        address: oracleAddress as `0x${string}`,
        abi: oracleAbi,
        functionName: "setPoolFeed",
        args: [poolTarget as `0x${string}`, feedTarget as `0x${string}`],
      });
      setStatus("Pool feed update submitted.");
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to set pool feed.";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReadPoolFeed = async () => {
    if (!canRead) {
      setStatus("Enter a valid pool/oracle address to read data.");
      return;
    }
    if (!poolTarget || !isAddress(poolTarget)) {
      setStatus("Enter a valid pool address.");
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      const feed = await publicClient.readContract({
        address: oracleAddress as `0x${string}`,
        abi: oracleAbi,
        functionName: "poolFeed",
        args: [poolTarget as `0x${string}`],
      });
      setReadResults((prev) => ({ ...prev, poolFeed: feed as string }));
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to read pool feed.";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReadLatestPrice = async () => {
    if (!canRead) {
      setStatus("Enter a valid pool/oracle address to read data.");
      return;
    }
    if (!poolTarget || !isAddress(poolTarget)) {
      setStatus("Enter a valid pool address.");
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      const price = await publicClient.readContract({
        address: oracleAddress as `0x${string}`,
        abi: oracleAbi,
        functionName: "latestPrice",
        args: [poolTarget as `0x${string}`],
      });
      setReadResults((prev) => ({ ...prev, latestPrice: price.toString() }));
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to read latest price.";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReadFeedDescription = async () => {
    if (!canRead) {
      setStatus("Enter a valid pool/oracle address to read data.");
      return;
    }
    if (!poolTarget || !isAddress(poolTarget)) {
      setStatus("Enter a valid pool address.");
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      const description = await publicClient.readContract({
        address: oracleAddress as `0x${string}`,
        abi: oracleAbi,
        functionName: "feedDescription",
        args: [poolTarget as `0x${string}`],
      });
      setReadResults((prev) => ({ ...prev, feedDescription: description as string }));
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to read feed description.";
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chainlink Price Oracle</p>
          <h2 className="text-lg font-semibold text-slate-900">PoolPriceOracle controls</h2>
          <p className="text-sm text-slate-600">
            Configure Chainlink feeds for pool NAV pricing, and query live oracle metadata using {resolveBaseLabel()}.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {address ? `Wallet ${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet not connected"}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oracle configuration</p>
            <h3 className="text-base font-semibold text-slate-900">Set operator + pool feed</h3>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool/Oracle address</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="0x... pool or oracle address"
              value={poolAddress}
              onChange={(event) => setPoolAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price feed address</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="0x... price feed"
              value={priceFeedAddress}
              onChange={(event) => setPriceFeedAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator address (optional)</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="0x... operator"
              value={operatorAddress}
              onChange={(event) => setOperatorAddress(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSetOperator}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Set operator
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSetPoolFeed}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Set pool feed
            </button>
          </div>
        </article>

        <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oracle reads</p>
            <h3 className="text-base font-semibold text-slate-900">Live feed metadata</h3>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool address</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="0x... pool address"
              value={poolAddress}
              onChange={(event) => setPoolAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool feed</p>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleReadPoolFeed}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Read pool feed
              </button>
            </div>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {readResults.poolFeed ?? "—"}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest price</p>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleReadLatestPrice}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Read latest price
              </button>
            </div>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {readResults.latestPrice ?? "—"}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feed description</p>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleReadFeedDescription}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Read description
              </button>
            </div>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {readResults.feedDescription ?? "—"}
            </p>
          </div>
        </article>
      </div>

      {status && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {status}
        </p>
      )}
    </div>
  );
}
