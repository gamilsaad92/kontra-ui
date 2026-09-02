import React from 'react';
import Card from '../../components/Card';
import VirtualAssistant from '../../components/VirtualAssistant';

export default function AIAssistantCard({ to }) {
  return (
    <Card
      title="AI Assistant"
      to={to}
      footer={<p className="text-xs text-gray-500">Text routes to /api/ask; voice requests relay to /api/voice.</p>}
    >
      <div className="h-72">
        <VirtualAssistant endpoint="/api/ask" showVoiceControls />
      </div>
    </Card>
  );
}
