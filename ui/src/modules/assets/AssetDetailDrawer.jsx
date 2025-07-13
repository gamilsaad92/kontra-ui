import React from 'react';
import { DetailDrawer } from '../../components/ui';

export default function AssetDetailDrawer({ asset, onClose }) {
 
  return (
       <DetailDrawer open={!!asset} onClose={onClose}>
      {asset && (
        <div>
          <h3 className="text-xl mb-2">{asset.name || asset.address}</h3>
          <p>Value: {asset.value ?? '—'}</p>
          {asset.predicted_risk !== undefined && (
            <p>Risk: {asset.predicted_risk}</p>
          )}
          <p>Status: {asset.status}</p>
        </div>
      )}
    </DetailDrawer>  );
}
