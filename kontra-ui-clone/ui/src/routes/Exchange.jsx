import React from 'react';
import Marketplace from '../components/exchange/Marketplace';
import AssetTokenizationForm from '../components/exchange/AssetTokenizationForm';
import KycCheck from '../components/exchange/KycCheck';

export default function Exchange() {
  return (
    <div className="space-y-6 p-6">
      <KycCheck />
      <AssetTokenizationForm />
      <Marketplace />
    </div>
  );
}
