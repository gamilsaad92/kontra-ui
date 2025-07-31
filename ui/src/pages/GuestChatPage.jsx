import React, { Suspense } from 'react';
import GuestChat from '../components/GuestChat.jsx';

export default function GuestChatPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <GuestChat />
    </Suspense>
  );
}
