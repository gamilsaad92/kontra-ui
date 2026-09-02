function runManagementAgent(managementData = {}) {
  const reportDate = managementData.report_date || null;
  const propertyManager = managementData.property_manager || null;
  const openWorkOrders = Number(managementData.open_work_orders || 0);
  const overdueWorkOrders = Number(managementData.overdue_work_orders || 0);
  const delinquencyRate = Number(managementData.delinquency_rate || 0);
  const maintenanceReserveBalance = Number(managementData.maintenance_reserve_balance || 0);
  const requiredReserve = Number(managementData.required_reserve || 0);
  const incidents = Array.isArray(managementData.incidents) ? managementData.incidents : [];

  const reasons = [];
  const evidence = [];

  if (!reportDate) {
    reasons.push({
      code: 'MISSING_REPORT_DATE',
      message: 'Management report is missing a report date.',
      severity: 'low',
    });
  }

  if (overdueWorkOrders > 5) {
    reasons.push({
      code: 'OVERDUE_WORK_ORDERS',
      message: `${overdueWorkOrders} overdue work orders exceed the acceptable threshold.`,
      severity: 'medium',
    });
  }

  if (delinquencyRate > 5) {
    reasons.push({
      code: 'HIGH_DELINQUENCY',
      message: `Tenant delinquency rate of ${delinquencyRate.toFixed(1)}% exceeds the 5% threshold.`,
      severity: 'high',
    });
  }

  if (requiredReserve > 0 && maintenanceReserveBalance < requiredReserve * 0.85) {
    reasons.push({
      code: 'LOW_RESERVE',
      message: `Maintenance reserve $${maintenanceReserveBalance.toFixed(2)} is below required $${requiredReserve.toFixed(2)}.`,
      severity: 'medium',
    });
  }

  const criticalIncidents = incidents.filter((inc) => inc.severity === 'critical' || inc.severity === 'high');
  if (criticalIncidents.length > 0) {
    reasons.push({
      code: 'CRITICAL_INCIDENTS',
      message: `${criticalIncidents.length} critical incident(s) require immediate review.`,
      severity: 'high',
    });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    confidence: status === 'pass' ? 0.86 : 0.67,
    title: status === 'pass' ? 'Management report passed AI review' : 'Management report requires AI exception review',
    summary:
      status === 'pass'
        ? 'Property management metrics are within acceptable ranges.'
        : `Detected ${reasons.length} management exception(s) requiring human review.`,
    reasons,
    evidence,
    recommended_actions:
      status === 'pass'
        ? [
            {
              action_type: 'approve_management_report',
              label: 'Approve management report',
              payload: { report_date: reportDate, property_manager: propertyManager },
              requires_approval: true,
            },
          ]
        : [
            {
              action_type: 'escalate_to_asset_manager',
              label: 'Escalate to asset manager',
              payload: {
                delinquency_rate: delinquencyRate,
                overdue_work_orders: overdueWorkOrders,
                critical_incidents: criticalIncidents.length,
              },
              requires_approval: true,
            },
            {
              action_type: 'request_remediation_plan',
              label: 'Request remediation plan',
              payload: { property_manager: propertyManager },
              requires_approval: true,
            },
          ],
    proposed_updates: {
      open_work_orders: openWorkOrders,
      overdue_work_orders: overdueWorkOrders,
      delinquency_rate: delinquencyRate,
      maintenance_reserve_balance: maintenanceReserveBalance,
    },
  };
}

module.exports = { runManagementAgent };
