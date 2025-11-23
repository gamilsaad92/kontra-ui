const { randomBytes } = require('crypto');

function randomAddress() {
  return `0x${randomBytes(20).toString('hex')}`;
}

class WhitelistRegistry {
  constructor() {
    this.address = randomAddress();
    this.entries = new Map();
  }

  upsert(address, { isWhitelisted = true, investorType = 'unknown', kycProviderRef = null } = {}) {
    if (!address) throw new Error('Address is required');
    const normalized = address.toLowerCase();
    const record = {
      address: normalized,
      isWhitelisted: Boolean(isWhitelisted),
      investorType,
      kycProviderRef,
      updatedAt: new Date().toISOString()
    };
    this.entries.set(normalized, record);
    return record;
  }

  isAllowed(address) {
    if (!address) return false;
    const record = this.entries.get(address.toLowerCase());
    return Boolean(record?.isWhitelisted);
  }

  get(address) {
    if (!address) return null;
    return this.entries.get(address.toLowerCase()) || null;
  }

  all() {
    return Array.from(this.entries.values());
  }
}

class PoolToken {
  constructor({ poolId, name, symbol, initialSupply = 0, adminAddress, whitelistRegistry }) {
    if (!poolId) throw new Error('poolId is required');
    if (!name || !symbol) throw new Error('Pool token requires a name and symbol');
    this.poolId = poolId;
    this.name = name;
    this.symbol = symbol;
    this.contractAddress = randomAddress();
    this.whitelistRegistry = whitelistRegistry;
    this.admin = adminAddress;
    this.active = true;
    this.totalSupply = 0;
    this.balances = new Map();

    if (initialSupply > 0 && adminAddress) {
      this.mint(adminAddress, initialSupply);
    }
  }

  _beforeTokenTransfer(from, to) {
    if (!this.active) {
      throw new Error('Pool is not active');
    }
    if (from && !this.whitelistRegistry.isAllowed(from)) {
      throw new Error('Sender must be whitelisted');
    }
    if (to && !this.whitelistRegistry.isAllowed(to)) {
      throw new Error('Recipient must be whitelisted');
    }
  }

  mint(to, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be positive');
    }
    this._beforeTokenTransfer(null, to);
    const current = this.balances.get(to) || 0;
    this.balances.set(to, current + amount);
    this.totalSupply += amount;
  }

  transfer(from, to, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be positive');
    }
    this._beforeTokenTransfer(from, to);
    const fromBalance = this.balances.get(from) || 0;
    if (fromBalance < amount) {
      throw new Error('Insufficient balance');
    }
    this.balances.set(from, fromBalance - amount);
    const toBalance = this.balances.get(to) || 0;
    this.balances.set(to, toBalance + amount);
  }

  close() {
    this.active = false;
  }

  summary() {
    return {
      poolId: this.poolId,
      name: this.name,
      symbol: this.symbol,
      contractAddress: this.contractAddress,
      whitelistRegistry: this.whitelistRegistry.address,
      admin: this.admin,
      active: this.active,
      totalSupply: this.totalSupply,
      holders: Array.from(this.balances.entries()).map(([address, balance]) => ({ address, balance }))
    };
  }
}

class PoolFactory {
  constructor(whitelistRegistry) {
    this.address = randomAddress();
    this.whitelistRegistry = whitelistRegistry;
    this.pools = new Map();
  }

  createPool({ poolId, name, symbol, initialSupply = 0, adminAddress }) {
    if (this.pools.has(poolId)) {
      throw new Error('Pool already exists');
    }
    if (adminAddress) {
      this.whitelistRegistry.upsert(adminAddress, {
        isWhitelisted: true,
        investorType: 'admin',
        kycProviderRef: 'treasury'
      });
    }
    const token = new PoolToken({ poolId, name, symbol, initialSupply, adminAddress, whitelistRegistry: this.whitelistRegistry });
    this.pools.set(poolId, token);
    return token;
  }

  getPool(poolId) {
    return this.pools.get(poolId) || null;
  }

  describePools() {
    return Array.from(this.pools.values()).map(pool => pool.summary());
  }
}

const whitelistRegistry = new WhitelistRegistry();
const poolFactory = new PoolFactory(whitelistRegistry);

function describeDeployment() {
  const whitelistEntries = whitelistRegistry.all();
  const investorTypes = whitelistEntries.reduce((acc, entry) => {
    acc[entry.investorType] = (acc[entry.investorType] || 0) + 1;
    return acc;
  }, {});

  return {
    whitelistRegistry: {
      address: whitelistRegistry.address,
      totalEntries: whitelistEntries.length,
      investorTypes,
    },
    poolFactory: {
      address: poolFactory.address,
      poolsDeployed: poolFactory.pools.size,
    },
    pools: poolFactory.describePools(),
  };
}

module.exports = {
  whitelistRegistry,
  poolFactory,
  describeDeployment,
};
