const express = require('express');
const { randomBytes, randomUUID } = require('crypto');
const { supabase } = require('../db');

const router = express.Router();

const METADATA_BUCKET = 'asset-digitization';
let bucketReady = false;

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureBucket() {
  if (bucketReady) return;
  const { data: bucket } = await supabase.storage.getBucket(METADATA_BUCKET);
  if (!bucket) {
    await supabase.storage.createBucket(METADATA_BUCKET, { public: true });
  }
  bucketReady = true;
}

async function uploadMetadata(metadata) {
  await ensureBucket();
  const filePath = `loans/${metadata.loan.id || randomUUID()}.json`;
  const payload = JSON.stringify(metadata, null, 2);
  const { error: uploadError } = await supabase.storage
    .from(METADATA_BUCKET)
    .upload(filePath, payload, { contentType: 'application/json', upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message || 'Unable to store metadata');
  }

  const { data: publicUrl } = supabase.storage.from(METADATA_BUCKET).getPublicUrl(filePath);
  return publicUrl?.publicUrl || null;
}

function buildMetadata(loanRow, tokenRow) {
  const standard = tokenRow.standard || (Number(tokenRow.total_supply) > 1 ? 'ERC-20' : 'ERC-721');
  return {
    name: `${tokenRow.token_symbol} | ${loanRow.property_address}`,
    description: 'Digitized loan metadata for collateral-backed credit tokenization.',
    standard,
    chain: tokenRow.chain,
    loan: {
      id: loanRow.id,
      property_address: loanRow.property_address,
      balance: Number(loanRow.balance),
      rate: Number(loanRow.rate),
      maturity: loanRow.maturity,
      status: loanRow.status,
      borrower: loanRow.borrower,
      lien_position: loanRow.lien_position,
      collateral_value: Number(loanRow.collateral_value)
    },
    token: {
      id: tokenRow.id,
      symbol: tokenRow.token_symbol,
      total_supply: Number(tokenRow.total_supply),
      price_per_token: Number(tokenRow.price_per_token),
      owner_wallet: tokenRow.owner_wallet,
      standard,
      chain: tokenRow.chain
    },
    timestamp: new Date().toISOString()
  };
}

router.post('/tokenize-loan', async (req, res) => {
  const { loan = {}, token = {}, transaction = {} } = req.body || {};
  const requiredFields = ['property_address', 'borrower'];

  if (!requiredFields.every((field) => loan[field])) {
    return res.status(400).json({ message: 'property_address and borrower are required to tokenize a loan' });
  }

  const loanPayload = {
    property_address: loan.property_address,
    balance: parseNumber(loan.balance),
    rate: parseNumber(loan.rate),
    maturity: loan.maturity || null,
    status: loan.status || 'pending_tokenization',
    borrower: loan.borrower,
    lien_position: loan.lien_position || null,
    collateral_value: parseNumber(loan.collateral_value)
  };

  try {
    const { data: loanRow, error: loanError } = await supabase
      .from('loan_tokenized_loans')
      .insert([loanPayload])
      .select()
      .single();

    if (loanError) {
      throw new Error(loanError.message || 'Unable to record loan metadata');
    }

    const standard = token.standard || (parseNumber(token.total_supply) > 1 ? 'ERC-20' : 'ERC-721');
    const tokenPayload = {
      loan_id: loanRow.id,
      token_symbol: token.token_symbol || 'LOAN',
      total_supply: parseNumber(token.total_supply) ?? 1,
      price_per_token: parseNumber(token.price_per_token),
      chain: token.chain || 'base-sepolia',
      owner_wallet: token.owner_wallet || transaction.buyer || transaction.to || null,
      standard
    };

    const { data: tokenRow, error: tokenError } = await supabase
      .from('loan_tokens')
      .insert([tokenPayload])
      .select()
      .single();

    if (tokenError) {
      throw new Error(tokenError.message || 'Unable to create token entry');
    }

    const metadata = buildMetadata(loanRow, tokenRow);
    const metadataUri = await uploadMetadata(metadata);

    const { data: updatedToken, error: metadataUpdateError } = await supabase
      .from('loan_tokens')
      .update({ metadata_uri: metadataUri })
      .eq('id', tokenRow.id)
      .select()
      .single();

    if (metadataUpdateError) {
      throw new Error(metadataUpdateError.message || 'Unable to persist metadata URI');
    }

    const txPayload = {
      token_id: tokenRow.id,
      buyer: transaction.buyer || tokenPayload.owner_wallet,
      seller: transaction.seller || tokenPayload.owner_wallet || 'treasury',
      amount: parseNumber(transaction.amount) ?? tokenPayload.total_supply,
      tx_hash: transaction.tx_hash || `0x${randomBytes(32).toString('hex')}`,
      chain: tokenPayload.chain
    };

    const { data: txRow, error: txError } = await supabase
      .from('loan_token_transactions')
      .insert([txPayload])
      .select()
      .single();

    if (txError) {
      throw new Error(txError.message || 'Unable to record token transaction');
    }

    res.status(201).json({
      loan: loanRow,
      token: updatedToken,
      metadata,
      metadataUri,
      transaction: txRow
    });
  } catch (err) {
    const message = err?.message || 'Unable to tokenize loan';
    res.status(500).json({ message });
  }
});

module.exports = { router };
