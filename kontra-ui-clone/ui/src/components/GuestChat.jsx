import React from 'react';
import VirtualAssistant from './VirtualAssistant';

export default function GuestChat() {
  return (
    <div className="h-full flex flex-col border rounded-lg bg-white">
      <VirtualAssistant
        endpoint="/api/guest-chat"
        placeholder="Ask for room service or spa booking…"
      />
    </div>
  );
}
