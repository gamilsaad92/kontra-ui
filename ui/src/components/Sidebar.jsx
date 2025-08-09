import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isFeatureEnabled } from '../lib/featureFlags';
import { toPath } from '../lib/navConfig';

export default function Sidebar({
  links,
  navItems = [],
  sidebarOpen = true,
  setSidebarOpen = () => {},
  department,
  setDepartment,
  supabase,
  usage = {},
  recordUsage = () => {}
}) {
  const location = useLocation();

  // Simple sidebar mode used by components like SimpleDashboard
  if (links) {
    const allLinks = [...links];
    if (isFeatureEnabled('trading')) {
      allLinks.push({ label: 'Trades', to: '/trades' });
    }
    return (
      <aside className="bg-gray-800 text-white w-64 min-h-screen flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">K Kontra</div>
        <nav className="flex-1 p-4 space-y-2">
          {allLinks.map(link => (
            <Link
              key={link.label}
              to={link.to}
              className="block px-3 py-2 rounded hover:bg-gray-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
    );
  }
    
  const frequentItems = navItems
    .filter(i => usage[i.label])
    .sort((a, b) => usage[b.label] - usage[a.label])
    .slice(0, 3);

  const renderItem = item => {
    const label = item.sub ? item.sub[0] : item.label;
    const path = toPath(label);
    const active = location.pathname === path;
    if (item.href) {
      return (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${active ? 'bg-gray-700 text-white' : 'text-gray-300'}`}
          title={item.label}
          onClick={() => recordUsage(item.label)}
        >
          <span className="text-lg">{item.icon}</span>
          {sidebarOpen && <span className="ml-2">{item.label}</span>}
        </a>
      );
    }
    return (
      <Link
        key={item.label}
        to={path}
        className={`flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${active ? 'bg-gray-700 text-white' : 'text-gray-300'}`}
        title={item.label}
        onClick={() => recordUsage(item.label)}
      >
        <span className="text-lg">{item.icon}</span>
        {sidebarOpen && <span className="ml-2">{item.label}</span>}
      </Link>
    );
  };

  return (
   <aside
      className={`${sidebarOpen ? 'md:w-48' : 'md:w-16'} w-full bg-gray-800 flex flex-col transition-all`}
      aria-label="Main navigation"
    >
      <button
        onClick={() => setSidebarOpen(o => !o)}
        className="p-4 text-2xl font-bold border-b border-gray-700 text-left text-white"
      >
        {sidebarOpen ? 'Kontra' : 'K'}
      </button>
      {setDepartment && (
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="m-2 p-1 bg-gray-700 text-white rounded"
        >
          <option value="finance">Finance</option>
          <option value="hospitality">Hospitality</option>
        </select>
      )}
      <nav className="flex-1 overflow-auto py-4 space-y-1">
        {frequentItems.length > 0 && (
          <div className="mb-2 space-y-1">
            {frequentItems.map(renderItem)}
            <hr className="border-gray-700" />
          </div>
        )}
        {navItems
          .filter(item => !item.flag || isFeatureEnabled(item.flag))
          .filter(item => !frequentItems.includes(item))
          .map(renderItem)}
        {supabase && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded text-gray-300"
          >
                  <span className="text-lg">🔓</span>
            {sidebarOpen && <span className="ml-2">Log Out</span>}
          </button>
        )}      
      </nav>
    </aside>
  );
}
