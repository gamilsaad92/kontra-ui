const defaultLegalConfig = {
  structure: {
    vehicle: 'SPV',
    offeringStyle: 'Private placement',
    exemptions: [
      {
        code: 'Reg D 506(c)',
        description: 'US-only tranche for accredited investors with verification and investor legends.',
      },
      {
        code: 'Reg S',
        description: 'Offshore tranche that excludes US persons and routes onboarding through non-US distributors.',
      },
    ],
    tokenRepresentation:
      'Digital tokens map to limited partner/LLC interests in the SPV; no rights beyond the operating agreement.',
  },
  documentation: [
    {
      key: 'ppm',
      name: 'Private Placement Memorandum',
      owner: 'Securities counsel',
      status: 'required',
      notes: 'Counsel drafts core disclosures, use of proceeds, and legends.',
    },
    {
      key: 'subscription',
      name: 'Subscription Agreement',
      owner: 'Securities counsel',
      status: 'required',
      notes: 'Captures purchaser reps, AML, and governing law.',
    },
    {
      key: 'token_terms',
      name: 'Token Terms',
      owner: 'Product + legal',
      status: 'required',
      notes: 'Defines wallet eligibility, mint/burn rules, legends, and on-chain metadata.',
    },
    {
      key: 'risk_factors',
      name: 'Risk Factors',
      owner: 'Risk + legal',
      status: 'required',
      notes: 'Includes illiquidity, SPV insolvency, and operational risks.',
    },
    {
      key: 'transfer_restrictions',
      name: 'Transfer Restrictions',
      owner: 'Legal + transfer agent',
      status: 'required',
      notes: 'Whitelisting, lockups, and legends for Reg D/Reg S tranches.',
    },
  ],
  transferRestrictions: {
    whitelistOnly: true,
    kycRequired: true,
    regDAccreditedOnly: true,
    regSOffshoreOnly: true,
    secondaryTransfersRequireCounsel: true,
    lockupMonths: 12,
  },
  riskFactors: [
    'Interests are illiquid during Reg D/Reg S distribution compliance periods.',
    'Tokens only track SPV interests; they do not provide direct rights in underlying assets.',
    'Regulatory change risk around digital asset custody, broker-dealer rules, and transfer agents.',
    'SPV insolvency or servicing failure could impair redemptions or distributions.',
  ],
  lastUpdated: new Date().toISOString(),
};

let legalConfig = { ...defaultLegalConfig };

function normalizeDocumentation(updates = []) {
  if (!Array.isArray(updates)) return legalConfig.documentation;
  const existing = new Map(legalConfig.documentation.map((doc) => [doc.key, doc]));
  const merged = updates.map((doc) => {
    const prior = existing.get(doc.key) || {};
    return { ...prior, ...doc };
  });
  return merged;
}

function updateLegalConfiguration(partial = {}) {
  const nextDocumentation = partial.documentation
    ? normalizeDocumentation(partial.documentation)
    : legalConfig.documentation;

  const nextTransferRestrictions = {
    ...legalConfig.transferRestrictions,
    ...(partial.transferRestrictions || {}),
  };

  legalConfig = {
    ...legalConfig,
    ...partial,
    documentation: nextDocumentation,
    transferRestrictions: nextTransferRestrictions,
    lastUpdated: new Date().toISOString(),
  };

  return legalConfig;
}

function getLegalConfiguration() {
  return legalConfig;
}

function enforceTransferControls({ trade, counterpartyProfiles = [] }) {
  const config = getLegalConfiguration();
  const restrictions = config.transferRestrictions || {};
  const flags = [];

  if (restrictions.secondaryTransfersRequireCounsel && trade?.side === 'sell') {
    flags.push({
      code: 'counsel_review',
      message: 'Secondary transfers should route through counsel for legend/lockup review.',
    });
  }

  for (const profile of counterpartyProfiles) {
    const jurisdiction = String(profile.jurisdiction || '').toUpperCase();
    const investorType = String(profile.investor_type || '').toLowerCase();
    const isUsPerson = jurisdiction === 'US' || jurisdiction === 'USA';

    if (restrictions.kycRequired && !profile.kycApproved) {
      return { valid: false, message: `KYC must be approved for ${profile.id || profile.wallet_address}` };
    }

    if (restrictions.regDAccreditedOnly && isUsPerson) {
      const accreditedTypes = new Set(['institutional', 'qualified_purchaser', 'accredited', 'qib']);
      if (!accreditedTypes.has(investorType)) {
        return {
          valid: false,
          message: 'US investors must be accredited/QIB for Reg D 506(c) allocations.',
        };
      }
    }

    if (restrictions.regSOffshoreOnly && !isUsPerson) {
      if (!jurisdiction) {
        flags.push({
          code: 'missing_offshore_jurisdiction',
          message: 'Non-US investors need a jurisdiction recorded to satisfy Reg S controls.',
        });
      }
    }
  }

  if (restrictions.lockupMonths && restrictions.lockupMonths > 0) {
    flags.push({
      code: 'lockup_notice',
      message: `Honor the ${restrictions.lockupMonths}-month lockup before permitting secondary transfers.`,
    });
  }

  return { valid: true, flags };
}

module.exports = {
  getLegalConfiguration,
  updateLegalConfiguration,
  enforceTransferControls,
};
