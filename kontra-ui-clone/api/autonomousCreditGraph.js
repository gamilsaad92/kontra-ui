const DEFAULT_WEIGHTS = {
  paymentHistory: 0.3,
  assetCoverage: 0.25,
  covenantHealth: 0.2,
  telemetryPulse: 0.25,
};

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function mergeUniqueByKey(existing = [], incoming = [], key = 'id') {
  const map = new Map();
  (existing || []).forEach(item => {
    if (!item || typeof item !== 'object') return;
    map.set(item[key] ?? Symbol(), item);
  });
  (incoming || []).forEach(item => {
    if (!item || typeof item !== 'object') return;
    const identifier = item[key] ?? Symbol();
    const previous = map.get(identifier);
    map.set(identifier, previous ? { ...previous, ...item } : item);
  });
  return Array.from(map.values());
}

class AutonomousCreditGraph {
  constructor(options = {}) {
    this.learningRate = options.learningRate ?? 0.05;
    this.decayFactor = options.decayFactor ?? 0.97;
    this.maxTelemetry = options.maxTelemetry ?? 200;

    this.borrowers = new Map();
    this.assets = new Map();
    this.covenants = new Map();
    this.telemetry = new Map();
    this.links = [];

    this.weights = { ...DEFAULT_WEIGHTS };
  }

  reset() {
    this.borrowers.clear();
    this.assets.clear();
    this.covenants.clear();
    this.telemetry.clear();
    this.links = [];
    this.weights = { ...DEFAULT_WEIGHTS };
  }

  upsertBorrower(borrower = {}) {
    if (!borrower.id) {
      throw new Error('Borrower id is required');
    }
    const previous = this.borrowers.get(borrower.id) || {};
    const mergedHistory = mergeUniqueByKey(
      previous.payment_history,
      borrower.payment_history,
      'period'
    );
    const mergedTags = Array.from(
      new Set([...(previous.tags || []), ...(borrower.tags || [])])
    );
    const result = {
      ...previous,
      ...borrower,
      payment_history: mergedHistory,
      tags: mergedTags,
      updatedAt: new Date().toISOString(),
    };
    this.borrowers.set(borrower.id, result);
    return result;
  }

  upsertAsset(asset = {}) {
    if (!asset.id) {
      throw new Error('Asset id is required');
    }
    const previous = this.assets.get(asset.id) || {};
    const mergedTelemetry = mergeUniqueByKey(
      previous.performance_window,
      asset.performance_window,
      'timestamp'
    );
    const result = {
      ...previous,
      ...asset,
      performance_window: mergedTelemetry,
      updatedAt: new Date().toISOString(),
    };
    this.assets.set(asset.id, result);

    if (asset.borrowerId) {
      this.linkBorrowerToAsset(asset.borrowerId, asset.id, asset.relationship || 'owns');
    }
    return result;
  }

  upsertCovenant(covenant = {}) {
    if (!covenant.id) {
      throw new Error('Covenant id is required');
    }
    const previous = this.covenants.get(covenant.id) || {};
    const mergedBreaches = mergeUniqueByKey(
      previous.breaches,
      covenant.breaches,
      'timestamp'
    );
    const result = {
      ...previous,
      ...covenant,
      breaches: mergedBreaches,
      updatedAt: new Date().toISOString(),
    };
    this.covenants.set(covenant.id, result);
    return result;
  }

  linkBorrowerToAsset(borrowerId, assetId, relation = 'owns') {
    if (!borrowerId || !assetId) return;
    const exists = this.links.find(
      link => link.borrowerId === borrowerId && link.assetId === assetId
    );
    if (exists) {
      exists.relation = relation;
      exists.updatedAt = new Date().toISOString();
      return;
    }
    this.links.push({
      borrowerId,
      assetId,
      relation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  ingestTelemetry(event = {}) {
    if (!event.id) {
      event.id = `${event.source || 'telemetry'}-${Date.now()}-${Math.random()}`;
    }
    const scopeKey = event.borrowerId || event.assetId;
    if (!scopeKey) {
      throw new Error('Telemetry must reference a borrowerId or assetId');
    }
    const existing = this.telemetry.get(scopeKey) || [];
    const next = [
      ...existing,
      {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      },
    ].slice(-this.maxTelemetry);
    this.telemetry.set(scopeKey, next);
    return next[next.length - 1];
  }

  getTelemetryForBorrower(borrowerId) {
    const direct = this.telemetry.get(borrowerId) || [];
    const relatedAssets = this.links
      .filter(link => link.borrowerId === borrowerId)
      .map(link => link.assetId);
    const assetTelemetry = relatedAssets.flatMap(assetId => this.telemetry.get(assetId) || []);
    return [...direct, ...assetTelemetry].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  computePaymentHistoryScore(borrower) {
    const history = borrower.payment_history || [];
    if (!history.length) return 0.5;
    const onTime = history.filter(period => period.status === 'on_time').length;
    const late = history.length - onTime;
    const severeLate = history.filter(period => (period.days_late || 0) > 30).length;
    const base = clamp01(onTime / history.length);
    const penalty = late * 0.1 + severeLate * 0.15;
    return clamp01(base - penalty);
  }

  computeAssetCoverageScore(borrowerId, borrower) {
    const relatedAssets = this.links
      .filter(link => link.borrowerId === borrowerId)
      .map(link => this.assets.get(link.assetId))
      .filter(Boolean);
    if (!relatedAssets.length) return 0.5;
    const totalValue = relatedAssets.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
    const totalIncome = relatedAssets.reduce(
      (sum, asset) => sum + Number(asset.net_operating_income || asset.noi || 0),
      0
    );
    const obligation = Number(borrower.total_commitment || borrower.balance || borrower.loan_amount || 0) || 1;
    const coverage = (totalValue + totalIncome * 10) / obligation;
    if (coverage >= 2) return 1;
    if (coverage >= 1.2) return 0.8;
    if (coverage >= 1) return 0.65;
    if (coverage >= 0.8) return 0.45;
    return 0.25;
  }

  computeCovenantHealthScore(borrowerId) {
    const covenants = Array.from(this.covenants.values()).filter(
      covenant => !covenant.borrowerId || covenant.borrowerId === borrowerId
    );
    if (!covenants.length) return 0.6;
    const satisfied = covenants.filter(covenant => covenant.status === 'satisfied').length;
    const breaches = covenants.reduce((count, covenant) => count + (covenant.breaches || []).length, 0);
    const base = clamp01(satisfied / covenants.length);
    const penalty = Math.min(0.4, breaches * 0.05);
    return clamp01(base - penalty);
  }

  computeTelemetryPulseScore(borrowerId) {
    const events = this.getTelemetryForBorrower(borrowerId);
    if (!events.length) return 0.5;
    const windows = events.slice(-20);
    let signal = 0.5;
    windows.forEach(event => {
      const metrics = event.metrics || {};
      const health = Number(metrics.health || metrics.score || 0.5);
      const sentiment = Number(metrics.sentiment || 0);
      const outages = Number(metrics.outages || metrics.incidents || 0);
      const normalizedHealth = clamp01(health);
      const normalizedSentiment = clamp01((sentiment + 1) / 2);
      const outagePenalty = Math.min(0.3, outages * 0.05);
      signal += (normalizedHealth * 0.5 + normalizedSentiment * 0.4) - outagePenalty;
    });
    return clamp01(signal / (windows.length + 1));
  }

  evaluateBorrower(borrowerId) {
    const borrower = this.borrowers.get(borrowerId);
    if (!borrower) return null;
    const paymentHistory = this.computePaymentHistoryScore(borrower);
    const assetCoverage = this.computeAssetCoverageScore(borrowerId, borrower);
    const covenantHealth = this.computeCovenantHealthScore(borrowerId);
    const telemetryPulse = this.computeTelemetryPulseScore(borrowerId);

    const signals = { paymentHistory, assetCoverage, covenantHealth, telemetryPulse };
    const riskVector = Object.entries(this.weights).reduce((sum, [key, weight]) => {
      const value = key === 'telemetryPulse' ? telemetryPulse : signals[key];
      return sum + weight * (value ?? 0.5);
    }, 0);
    const normalized = clamp01(riskVector);
    const riskTier = normalized >= 0.75 ? 'stable' : normalized >= 0.55 ? 'watch' : normalized >= 0.35 ? 'concern' : 'critical';

    return {
      borrowerId,
      borrower,
      signals,
      riskScore: Number((normalized * 100).toFixed(2)),
      riskTier,
      updatedAt: new Date().toISOString(),
    };
  }

  getBorrowerSummary(borrowerId) {
    const evaluation = this.evaluateBorrower(borrowerId);
    if (!evaluation) return null;
    const relatedAssets = this.links
      .filter(link => link.borrowerId === borrowerId)
      .map(link => ({
        assetId: link.assetId,
        relation: link.relation,
        asset: this.assets.get(link.assetId),
      }));
    const covenants = Array.from(this.covenants.values()).filter(
      covenant => !covenant.borrowerId || covenant.borrowerId === borrowerId
    );
    const telemetry = this.getTelemetryForBorrower(borrowerId);
    return {
      ...evaluation,
      assets: relatedAssets,
      covenants,
      telemetry,
    };
  }

  applyFeedback({ borrowerId, signal, direction, magnitude = 1, notes }) {
    if (!borrowerId) {
      throw new Error('borrowerId is required');
    }
    if (!this.borrowers.has(borrowerId)) {
      throw new Error('Borrower not found in graph');
    }
    if (!signal || !(signal in this.weights)) {
      throw new Error('Unknown signal for feedback');
    }
    if (!['positive', 'negative'].includes(direction)) {
      throw new Error('direction must be positive or negative');
    }
    const delta = this.learningRate * magnitude * (direction === 'positive' ? 1 : -1);
    this.weights[signal] = Math.max(0, this.weights[signal] + delta);
    this.normalizeWeights();
    const evaluation = this.getBorrowerSummary(borrowerId);
    return {
      borrowerId,
      signal,
      direction,
      notes,
      weights: this.getWeights(),
      evaluation,
    };
  }

  normalizeWeights() {
    const total = Object.values(this.weights).reduce((sum, value) => sum + value, 0);
    if (total === 0) {
      this.weights = { ...DEFAULT_WEIGHTS };
      return;
    }
    Object.keys(this.weights).forEach(key => {
      this.weights[key] = Number((this.weights[key] / total).toFixed(4));
    });
  }

  getWeights() {
    return { ...this.weights };
  }

  decaySignalWeights() {
    Object.keys(this.weights).forEach(key => {
      this.weights[key] = Number((this.weights[key] * this.decayFactor).toFixed(4));
    });
    this.normalizeWeights();
  }

  getDecisionFabric() {
    const borrowers = Array.from(this.borrowers.keys()).map(id => this.getBorrowerSummary(id));
    return {
      generatedAt: new Date().toISOString(),
      weights: this.getWeights(),
      borrowers,
      borrowersIndexed: borrowers.reduce((acc, item) => {
        if (item) acc[item.borrowerId] = { riskScore: item.riskScore, riskTier: item.riskTier };
        return acc;
      }, {}),
      assets: Array.from(this.assets.values()),
      covenants: Array.from(this.covenants.values()),
      edges: this.links.map(link => ({ ...link })),
    };
  }
}

const autonomousCreditGraph = new AutonomousCreditGraph();

module.exports = {
  AutonomousCreditGraph,
  autonomousCreditGraph,
};
