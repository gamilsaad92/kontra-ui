import React from 'react';

export default function QRCodeDisplay({ data }) {
  if (!data) return null;
  return <img src={data} alt="QR code" className="mx-auto" />;
}
