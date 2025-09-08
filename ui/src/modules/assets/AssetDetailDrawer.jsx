import React, { useEffect, useState } from "react";
import { DetailDrawer } from "@/components/ui";
import { API_BASE } from "../../lib/apiBase";
import AssetFileUpload from "./AssetFileUpload";

export default function AssetDetailDrawer({ asset, onClose }) {
   const [full, setFull] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!asset) {
        setFull(null);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/assets/${asset.id}`);
        if (res.ok) {
          const { asset: data } = await res.json();
          if (!ignore) setFull(data);
        } else {
          if (!ignore) setFull(null);
        }
      } catch {
        if (!ignore) setFull(null);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [asset]);

  const a = full || asset;
 
  return (
       {asset && (
    <DetailDrawer open={!!asset}
        <div>
                <h3 className="text-xl mb-2">{a.name || a.address}</h3>
          <p>ID: {a.id}</p>
          <p>Address: {a.address}</p>
          <p>Type: {a.type || '—'}</p>
          <p>Value: {a.value ?? '—'}</p>
          {a.predicted_risk !== undefined && <p>Risk: {a.predicted_risk}</p>}
          <p>Status: {a.status}</p>
          {Array.isArray(a.loans) && a.loans.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Active Loans:</p>
              <ul className="list-disc pl-4">
                {a.loans.map(l => (
                  <li key={l.id}>#{l.id} - {l.status}</li>
                ))}
              </ul>
            </div>
          )}
             <div className="mt-2 space-y-1">
            <p className="font-medium">Upload Reports:</p>
            <AssetFileUpload assetId={a.id} kind="inspection" />
            <AssetFileUpload assetId={a.id} kind="appraisal" />
          </div>
        </div>
      )}
     </DetailDrawer>
  );
}
