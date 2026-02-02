function extractLineItems(statement = '') {
  return statement
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/([-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
      const amount = match ? Number(match[1].replace(/,/g, '')) : null;
      return { line, amount };
    });
}

function summarizeStatement(statement = '') {
  const sanitized = typeof statement === 'string' ? statement.trim() : '';
  if (!sanitized) {
    return {
      insight: 'No financial data provided. Paste a recent borrower statement to receive an instant summary.',
      totals: null,
      liquidityGauge: 'unknown'
    };
  }

  const items = extractLineItems(sanitized);
  const totals = items.reduce(
    (acc, item) => {
      if (item.amount === null) {
        return acc;
      }
      if (/revenue|income|sales/i.test(item.line)) {
        acc.revenue += item.amount;
      } else if (/expense|cost|interest|payroll|rent/i.test(item.line)) {
        acc.expenses += item.amount;
      } else if (/cash|liquid/i.test(item.line)) {
        acc.cash += item.amount;
      }
      return acc;
    },
    { revenue: 0, expenses: 0, cash: 0 }
  );

  const operatingMargin = totals.revenue
    ? ((totals.revenue - totals.expenses) / totals.revenue) * 100
    : null;
  const liquidityGauge = totals.cash >= totals.expenses * 0.5 ? 'healthy' : 'tight';

  const insightParts = [];
  if (operatingMargin !== null) {
    const margin = Math.round(operatingMargin);
    if (margin >= 20) {
      insightParts.push(`Operating margin is strong at ${margin}%.`);
    } else if (margin >= 5) {
      insightParts.push(`Operating margin is modest at ${margin}%.`);
    } else {
      insightParts.push(`Operating margin is compressed at ${margin}% with expenses close to revenue.`);
    }
  } else {
    insightParts.push('Unable to derive an operating margin from the provided figures.');
  }

  if (totals.cash > 0) {
    const coverage = totals.expenses ? Math.round((totals.cash / totals.expenses) * 30) : null;
    if (coverage !== null) {
      insightParts.push(`Cash on hand covers roughly ${coverage} days of average expenses.`);
    }
  } else {
    insightParts.push('No liquid cash balances detected in the statement.');
  }

  const insight = insightParts.join(' ');

  return {
    insight,
    totals,
    liquidityGauge
  };
}

function buildAnalysis(summary) {
  const analysisLines = [];
  if (summary?.totals) {
    analysisLines.push(
      `Revenue noted: $${summary.totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
    );
    analysisLines.push(
      `Expenses identified: $${summary.totals.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
    );
    if (summary.totals.cash) {
      analysisLines.push(
        `Liquid cash observed: $${summary.totals.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
      );
    }
  }
  analysisLines.push(summary?.insight ?? 'No analysis available.');
  analysisLines.push(`Liquidity outlook: ${summary?.liquidityGauge ?? 'unknown'}.`);

  return analysisLines.join(' ');
}

module.exports = {
  buildAnalysis,
  summarizeStatement
};
