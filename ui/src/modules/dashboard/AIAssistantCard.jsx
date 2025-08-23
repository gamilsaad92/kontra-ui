import React from 'react';
import Card from '../../components/Card';
import VirtualAssistant from '../../components/VirtualAssistant';

export default function AIAssistantCard({ to }) {
  return (
    <Card title="AI Assistant" to={to}>
      <div className="h-64">
        <VirtualAssistant />
      </div>
    </Card>
  );
}
