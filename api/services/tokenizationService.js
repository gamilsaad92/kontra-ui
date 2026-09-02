const { createHash, randomBytes } = require('crypto');
const {
  poolFactory,
  whitelistRegistry,
  describeDeployment
} = require('./tokenizationContracts');

const DEFAULT_RPC = process.env.CHAIN_RPC_URL || process.env.ALCHEMY_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
let cachedNetwork = null;

async function queryRpc(method, params = []) {
  if (!DEFAULT_RPC || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(DEFAULT_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await response.json();
    return json?.result || null;
  } catch (err) {
    return null;
  }
}

async function getNetworkMeta() {
  if (cachedNetwork) return cachedNetwork;
  const chainIdHex = await queryRpc('eth_chainId');
  if (chainIdHex) {
    const parsed = Number.parseInt(chainIdHex, 16);
    cachedNetwork = { chainId: parsed, name: parsed === 0 ? 'custom' : `chain-${parsed}` };
  } else {
    cachedNetwork = { name: 'offline' };
  }
  return cachedNetwork;
}

function deriveAddressFromPrivateKey(privateKey) {
  const normalized = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  const digest = createHash('sha256').update(normalized).digest('hex');
  return `0x${digest.slice(-40)}`;
}

function requireAdminWalletAddress() {
  const key = process.env.CHAIN_PRIVATE_KEY;
  if (!key) {
    throw new Error('CHAIN_PRIVATE_KEY is required to run tokenization service operations');
  }
  return deriveAddressFromPrivateKey(key);
}

function fakeTxMeta(action, from) {
  return {
    hash: `0x${randomBytes(32).toString('hex')}`,
    action,
    from,
    chain: cachedNetwork?.name || 'custom',
    rpcUrl: DEFAULT_RPC,
    at: new Date().toISOString()
  };
}

async function describeService() {
  const network = await getNetworkMeta();
  const adminAddress = process.env.CHAIN_PRIVATE_KEY ? requireAdminWalletAddress() : null;
  return {
    rpcUrl: DEFAULT_RPC,
    network,
    adminAddress,
    contracts: {
      poolFactory: poolFactory.address,
      whitelistRegistry: whitelistRegistry.address
    },
    deployment: describeDeployment()
  };
}

async function createPoolToken(poolConfig) {
  const adminAddress = requireAdminWalletAddress();
  const pool = poolFactory.createPool({
    ...poolConfig,
    adminAddress: poolConfig?.adminAddress || adminAddress
  });
  return {
    pool: pool.summary(),
    transaction: fakeTxMeta('createPoolToken', adminAddress)
  };
}

async function whitelistInvestor(walletAddress, attrs = {}) {
  const entry = whitelistRegistry.upsert(walletAddress, attrs);
  return {
    entry,
    transaction: fakeTxMeta('whitelistInvestor', requireAdminWalletAddress())
  };
}

async function mintPoolTokens(poolId, to, amount) {
  const pool = poolFactory.getPool(poolId);
  if (!pool) {
    throw new Error('Pool not found');
  }
  pool.mint(to, Number(amount));
  return {
    pool: pool.summary(),
    transaction: fakeTxMeta('mintPoolTokens', requireAdminWalletAddress())
  };
}

async function burnPoolTokens(poolId, from, amount) {
  const pool = poolFactory.getPool(poolId);
  if (!pool) {
    throw new Error('Pool not found');
  }
  pool.burn(from, Number(amount));
  return {
    pool: pool.summary(),
    transaction: fakeTxMeta('burnPoolTokens', requireAdminWalletAddress())
  };
}

function getPoolTokenAddress(poolId) {
  const pool = poolFactory.getPool(poolId);
  return pool ? pool.contractAddress : null;
}

module.exports = {
  provider: { rpcUrl: DEFAULT_RPC, getNetwork: getNetworkMeta },
  describeService,
  createPoolToken,
  whitelistInvestor,
  mintPoolTokens,
  burnPoolTokens,
  getPoolTokenAddress
};
