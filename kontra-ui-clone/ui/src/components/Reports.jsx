import React from 'react';
import StandardReports from './StandardReports';
import ReportBuilder from './ReportBuilder';

export default function Reports() {
  return (
    <div className="space-y-8">
      <StandardReports />
      <ReportBuilder />
    </div>
  );
}
