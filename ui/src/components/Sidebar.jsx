import React from 'react';
import { Link } from 'react-router-dom';

// Basic app pages
const links = [
  { label: 'Dashboard', to: '/' },
  { label: 'Land Acquisition', to: '/land-acquisition' },
  { label: 'Market Analysis', to: '/market-analysis' },
  { label: 'Settings', to: '/settings' },
  
  // Dashboard layout components
  { label: 'Employee Dashboard', to: '/employee-dashboard' },
  { label: 'Features', to: '/features' },
  { label: 'Loan Dashboard', to: '/loan-dashboard' },
  { label: 'Overview', to: '/overview' },
  { label: 'Exposure', to: '/exposure' },
  { label: 'Events', to: '/events' },
  { label: 'Loan Notes', to: '/loan-notes' },
  { label: 'Analytics Overview', to: '/analytics-overview' },
  { label: 'Loan Master', to: '/loan-master' },
  { label: 'Consolidated Notes', to: '/consolidated-notes' },
  { label: 'Installments Due/Paid', to: '/installments-due/paid' },
  { label: 'Payment Analysis', to: '/payment-analysis' },
  { label: 'Amortization Schedule', to: '/amortization-schedule' },
  { label: 'Servicing', to: '/servicing' },
  { label: 'Draw Requests', to: '/draw-requests' },
  { label: 'New Application', to: '/new-application' },
  { label: 'Application List', to: '/application-list' },
  { label: 'Risk Monitoring', to: '/risk-monitoring' },
  { label: 'Troubled Assets', to: '/troubled-assets' },
  { label: 'Revived Sales', to: '/revived-sales' },
  { label: 'Investor Reporting', to: '/investor-reporting' },
  { label: 'Reports', to: '/reports' },
  { label: 'Investor Reports', to: '/investor-reports' },
  { label: 'Live Analytics', to: '/live-analytics' },
  { label: 'Alerts', to: '/alerts' },
  { label: 'Dev Tools', to: '/dev-tools' },
  { label: 'Generate Loans', to: '/generate-loans' },
  { label: 'Guest CRM', to: '/guest-crm' },
  { label: 'Guest Chat', to: '/guest-chat' },
  { label: 'Guest Reservations', to: '/guest-reservations' },
  { label: 'Booking Calendar', to: '/booking-calendar' },
  { label: 'Restaurant Menu', to: '/restaurant-menu' },
  { label: 'Restaurant Dashboard', to: '/restaurant-dashboard' },
  { label: 'Docs', href: 'https://github.com/kontra-ui/docs' },
];

export default function Sidebar() {
  return (
       <div className="w-64 h-screen bg-gray-800 text-white flex flex-col">
      <div className="p-4 text-2xl font-bold border-b border-gray-700">Kontra</div>
      <nav className="flex-1 p-4 space-y-2">
        {links.map(link => (
         link.href ? (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded hover:bg-gray-700"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.to}
              to={link.to}
              className="block px-3 py-2 rounded hover:bg-gray-700"
            >
              {link.label}
            </Link>
          )
        ))}
      </nav>
   </div>
 );
}
