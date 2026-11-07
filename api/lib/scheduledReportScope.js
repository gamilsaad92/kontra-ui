'use strict';

const REPORT_ORG_COLUMNS = Object.freeze({
  loans: 'organization_id',
  draw_requests: 'org_id',
  payments: 'org_id',
});

function getReportOrganizationColumn(table) {
  return REPORT_ORG_COLUMNS[table] || null;
}

module.exports = { getReportOrganizationColumn };
