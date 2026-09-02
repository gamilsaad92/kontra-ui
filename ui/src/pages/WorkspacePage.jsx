import { useContext, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";

// ── Icons (inline SVG to avoid extra deps) ─────────────────────
const Icon = ({ d, className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  home:        "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  tools:       "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  marketplace: "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z",
  properties:  "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  projects:    "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z",
  documents:   "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  reports:     "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  settings:    "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  enterprise:  "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z",
  logout:      "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9",
  bell:        "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  sparkles:    "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z",
};

// ── Helpers ─────────────────────────────────────────────────────
function getUserProfile(userId) {
  try {
    return JSON.parse(localStorage.getItem(`kontra_profile_${userId}`) || "{}");
  } catch { return {}; }
}

function getInitials(email) {
  if (!email) return "U";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// ── Nav items ────────────────────────────────────────────────────
const NAV_MAIN = [
  { to: "/workspace",             label: "Home",        icon: "home" },
  { to: "/workspace/tools",       label: "AI Tools",    icon: "tools" },
  { to: "/workspace/marketplace", label: "Marketplace", icon: "marketplace" },
  { to: "/workspace/properties",  label: "Properties",  icon: "properties" },
  { to: "/workspace/projects",    label: "Projects",    icon: "projects" },
  { to: "/workspace/documents",   label: "Document AI", icon: "documents" },
  { to: "/workspace/reports",     label: "Reports",     icon: "reports" },
];
const NAV_ENTERPRISE = [
  { to: "/dashboard",           label: "Portfolio Monitoring" },
  { to: "/dashboard/covenant",  label: "Covenant & Compliance" },
  { to: "/dashboard/draws",     label: "Draw / Project Review" },
  { to: "/dashboard/financials", label: "Borrower Financials" },
  { to: "/dashboard/hazard",    label: "Hazard & Loss Recovery" },
];

// ── Sidebar ──────────────────────────────────────────────────────
function Sidebar({ profile, email, onLogout }) {
  const isEnterprise = ["enterprise", "lender"].includes(profile.user_type);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <Link to="/workspace" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">K</div>
          <span className="text-white font-semibold text-sm tracking-tight">Kontra</span>
          <span className="ml-auto text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5">Beta</span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === "/workspace"} className={linkClass}>
            <Icon d={ICONS[item.icon]} className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {/* Enterprise section */}
        {isEnterprise && (
          <div className="pt-4 mt-2 border-t border-gray-800">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2">Enterprise</p>
            {NAV_ENTERPRISE.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <div className="pt-4 mt-2 border-t border-gray-800">
          <NavLink to="/workspace/settings" className={linkClass}>
            <Icon d={ICONS.settings} className="w-4 h-4 shrink-0" />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-800 transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {getInitials(email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{email || "Demo User"}</p>
            <p className="text-gray-500 text-xs capitalize">{profile.user_type?.replace("_", " ") || "Member"}</p>
          </div>
          <button onClick={onLogout} title="Sign out" className="text-gray-600 hover:text-gray-300 transition-colors">
            <Icon d={ICONS.logout} className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Action card ──────────────────────────────────────────────────
function ActionCard({ icon, title, desc, badge, onClick, gradient }) {
  const gradients = {
    blue:   "from-blue-600/20 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40",
    violet: "from-violet-600/20 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
    emerald:"from-emerald-600/20 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
    amber:  "from-amber-600/20 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
    rose:   "from-rose-600/20 to-rose-500/5 border-rose-500/20 hover:border-rose-500/40",
    cyan:   "from-cyan-600/20 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40",
  };
  return (
    <button
      onClick={onClick}
      className={`group text-left p-5 rounded-xl border bg-gradient-to-br ${gradients[gradient] || gradients.blue} transition-all hover:scale-[1.01] active:scale-[0.99]`}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
      <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
      {badge && (
        <span className="mt-3 inline-block text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded px-2 py-0.5">{badge}</span>
      )}
    </button>
  );
}

// ── Workspace Home ────────────────────────────────────────────────
function WorkspaceHome({ profile }) {
  const navigate = useNavigate();

  const allCards = [
    { icon:"📸", title:"AI Inspection Review",        desc:"Upload photos or inspection reports. AI identifies issues and generates a structured report.", badge:"AI Powered", gradient:"blue",    action:"/workspace/tools/inspection",   roles:["property_owner","investor","consultant","enterprise","vendor","other"] },
    { icon:"📊", title:"Analyze Property Financials", desc:"Upload rent roll or income statement. Get NOI, DSCR, occupancy, and OPEX trend analysis.",  badge:"AI Powered", gradient:"violet",  action:"/workspace/tools/financials",   roles:["property_owner","investor","consultant","enterprise","other"] },
    { icon:"⚠️", title:"Track Property Damage / Claim", desc:"Log damage events, insurance claims, repair status, and cost estimates in one place.",   badge:null,         gradient:"amber",   action:"/workspace/projects",           roles:["property_owner","consultant","enterprise","other"] },
    { icon:"🔎", title:"Find CRE Vendors",             desc:"Browse inspectors, engineers, contractors, appraisers, and environmental consultants.",     badge:null,         gradient:"emerald", action:"/workspace/marketplace",        roles:["property_owner","investor","consultant","enterprise","other"] },
    { icon:"📋", title:"Post a Project",               desc:"Describe your project and let qualified vendors apply. Get matched in 24 hours.",           badge:"New",        gradient:"cyan",    action:"/workspace/marketplace/post",   roles:["property_owner","consultant","enterprise","other"] },
    { icon:"📄", title:"Document AI",                  desc:"Extract data from leases, inspection reports, financials, and invoices automatically.",    badge:"AI Powered", gradient:"rose",    action:"/workspace/documents",          roles:["property_owner","investor","consultant","enterprise","vendor","other"] },
    { icon:"📈", title:"Deal Analysis",                desc:"Run financial models, comparable analysis, and due diligence reports on target assets.",   badge:"Pro",        gradient:"violet",  action:"/workspace/tools/deal-analysis",roles:["investor","other"] },
    { icon:"🗂️", title:"Portfolio Monitoring",         desc:"Track performance, covenants, and risk across your portfolio of assets.",                  badge:"Enterprise", gradient:"blue",    action:"/dashboard",                    roles:["enterprise"] },
    { icon:"🔧", title:"List My Services",             desc:"Create your vendor profile and get matched with property owners and investors.",            badge:null,         gradient:"emerald", action:"/workspace/marketplace/vendor", roles:["vendor"] },
  ];

  const filtered = profile.user_type
    ? allCards.filter(c => c.roles.includes(profile.user_type))
    : allCards.slice(0, 6);

  const recentActivity = [
    { icon:"📸", label:"Inspection report generated",  sub:"123 Main St, Austin TX",    time:"2h ago",  color:"blue" },
    { icon:"📊", label:"Financial analysis completed",  sub:"Harbor Blvd Retail Center", time:"Yesterday", color:"violet" },
    { icon:"🔎", label:"Vendor request submitted",      sub:"Environmental assessment",  time:"2d ago",  color:"emerald" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome to your workspace
          {profile.user_type && (
            <span className="ml-3 text-sm font-normal text-gray-400 capitalize">
              · {profile.user_type.replace("_", " ")}
            </span>
          )}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Run AI tools, browse vendors, and manage your CRE workflow — all in one place.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label:"AI Reports Run",    value:"0",  sub:"Lifetime" },
          { label:"Active Projects",   value:"0",  sub:"In progress" },
          { label:"Saved Properties",  value:"0",  sub:"In portfolio" },
          { label:"Vendor Matches",    value:"0",  sub:"Available now" },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 6).map(card => (
            <ActionCard
              key={card.title}
              {...card}
              onClick={() => navigate(card.action)}
            />
          ))}
        </div>
      </div>

      {/* Recent activity + suggested tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Activity</h2>
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl divide-y divide-gray-700/50">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{a.label}</p>
                  <p className="text-xs text-gray-500 truncate">{a.sub}</p>
                </div>
                <span className="text-xs text-gray-600 shrink-0">{a.time}</span>
              </div>
            ))}
            <div className="p-4 text-center">
              <button className="text-xs text-blue-500 hover:text-blue-400 transition-colors">View all activity →</button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Marketplace Highlights</h2>
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl divide-y divide-gray-700/50">
            {[
              { name:"Apex Property Inspections",   cat:"Inspector",     loc:"TX, OK, NM",  rating:"4.9" },
              { name:"ClearView Environmental",      cat:"Environmental", loc:"National",    rating:"4.8" },
              { name:"Summit Structural Engineers",  cat:"Engineering",   loc:"CO, WY, UT",  rating:"4.9" },
            ].map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-gray-200 shrink-0">
                  {v.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{v.name}</p>
                  <p className="text-xs text-gray-500">{v.cat} · {v.loc}</p>
                </div>
                <div className="text-xs text-amber-400 shrink-0">★ {v.rating}</div>
              </div>
            ))}
            <div className="p-4 text-center">
              <Link to="/workspace/marketplace" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">Browse all vendors →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stub pages ────────────────────────────────────────────────────
function ComingSoon({ title, desc, icon }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400 text-sm max-w-xs">{desc}</p>
    </div>
  );
}

// ── AI Tools Hub ──────────────────────────────────────────────────
function WorkspaceTools() {
  const navigate = useNavigate();
  const tools = [
    { icon:"📸", title:"AI Property Inspection Review",  desc:"Upload photos or inspection report. AI identifies issues and generates a structured deficiency report.", badge:"Free trial", gradient:"blue",    to:"/workspace/tools/inspection" },
    { icon:"📊", title:"AI Property Financial Analysis",  desc:"Upload rent roll / income statement. Calculates NOI, DSCR, occupancy, OPEX trends automatically.",    badge:"Pay per use", gradient:"violet",  to:"/workspace/tools/financials" },
    { icon:"⚠️", title:"Property Recovery & Claim Tracking", desc:"Track damage events, insurance claims, repair timelines, and cost estimates end-to-end.",          badge:"Free",        gradient:"amber",   to:"/workspace/projects" },
    { icon:"📄", title:"Document AI",                     desc:"Extract structured data from leases, inspection reports, financials, invoices — any CRE document.",   badge:"Pay per use", gradient:"rose",    to:"/workspace/documents" },
    { icon:"📋", title:"Covenant & Compliance Monitoring",desc:"Monitor loan covenants, compliance deadlines, and reporting requirements automatically.",              badge:"Enterprise",  gradient:"cyan",    to:"/dashboard/covenant" },
    { icon:"🏗️", title:"Draw / Project Review",           desc:"Submit, track, and approve project funding requests with supporting documentation.",                   badge:"Enterprise",  gradient:"emerald", to:"/dashboard/draws" },
  ];
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">AI Tools</h1>
        <p className="text-gray-400 text-sm mt-1">Purpose-built AI for commercial real estate professionals.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map(t => (
          <button key={t.title} onClick={() => navigate(t.to)}
            className={`group text-left p-5 rounded-xl border bg-gradient-to-br transition-all hover:scale-[1.01] ${
              { blue:"from-blue-600/20 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40",
                violet:"from-violet-600/20 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
                amber:"from-amber-600/20 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
                rose:"from-rose-600/20 to-rose-500/5 border-rose-500/20 hover:border-rose-500/40",
                cyan:"from-cyan-600/20 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40",
                emerald:"from-emerald-600/20 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
              }[t.gradient]
            }`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{t.icon}</span>
              <span className={`text-xs rounded px-2 py-0.5 border ${
                t.badge === "Enterprise" ? "bg-violet-600/30 text-violet-400 border-violet-500/30" :
                t.badge === "Free" || t.badge === "Free trial" ? "bg-emerald-600/30 text-emerald-400 border-emerald-500/30" :
                "bg-blue-600/30 text-blue-400 border-blue-500/30"
              }`}>{t.badge}</span>
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">{t.title}</h3>
            <p className="text-gray-400 text-xs leading-relaxed">{t.desc}</p>
            <div className="mt-3 text-blue-500 text-xs group-hover:text-blue-400 transition-colors">Start →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Workspace Marketplace ──────────────────────────────────────────
function WorkspaceMarketplace() {
  const VENDORS = [
    { name:"Apex Property Inspections",    cat:"Inspector",     loc:"TX, OK, NM",    rate:"$350–750/report",  rating:4.9, verified:true },
    { name:"ClearView Environmental",      cat:"Environmental", loc:"National",      rate:"$800–2,400",        rating:4.8, verified:true },
    { name:"Summit Structural Engineers",  cat:"Engineering",   loc:"CO, WY, UT",   rate:"$1,200–4,000",      rating:4.9, verified:true },
    { name:"BlueRidge Property Mgmt",      cat:"Prop. Mgmt",   loc:"Southeast",     rate:"8–10% of rent",     rating:4.7, verified:false },
    { name:"Valor Appraisal Group",        cat:"Appraisal",     loc:"CA, NV, AZ",   rate:"$1,500–3,500",      rating:4.8, verified:true },
    { name:"Pinnacle Claims Consulting",   cat:"Insurance",     loc:"Gulf Coast",    rate:"Contingency",       rating:4.6, verified:false },
  ];
  const CATS = ["All","Inspector","Environmental","Engineering","Prop. Mgmt","Appraisal","Insurance"];
  const [active, setActive] = useState("All");
  const shown = active === "All" ? VENDORS : VENDORS.filter(v => v.cat === active);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Find vetted CRE service providers for any project.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Post a Project
        </button>
      </div>
      <div className="flex gap-2 flex-wrap mb-6">
        {CATS.map(c => (
          <button key={c} onClick={() => setActive(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              active === c ? "bg-blue-600 border-blue-500 text-white" : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shown.map(v => (
          <div key={v.name} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600 transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-gray-200 shrink-0">{v.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm truncate">{v.name}</p>
                  {v.verified && <span className="text-xs text-emerald-400">✓ Verified</span>}
                </div>
                <p className="text-gray-400 text-xs">{v.cat} · {v.loc}</p>
              </div>
              <div className="text-xs text-amber-400 shrink-0">★ {v.rating}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{v.rate}</span>
              <button className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors">Contact</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stub sub-pages ─────────────────────────────────────────────────
const WorkspaceProperties = () => <ComingSoon title="Properties" desc="Track, analyze, and manage your CRE asset portfolio in one place." icon="🏢" />;
const WorkspaceDocuments  = () => <ComingSoon title="Document AI" desc="Upload leases, financials, inspections, and invoices. AI extracts key data automatically." icon="📄" />;
const WorkspaceReports    = () => <ComingSoon title="Reports" desc="All your AI-generated inspection, financial, and due-diligence reports in one place." icon="📊" />;
const WorkspaceSettings   = () => <ComingSoon title="Settings" desc="Manage your account, notifications, integrations, and billing." icon="⚙️" />;

// ── Top bar ───────────────────────────────────────────────────────
function TopBar({ email }) {
  return (
    <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex-1" />
      <button className="relative text-gray-500 hover:text-gray-300 transition-colors">
        <Icon d={ICONS.bell} className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
      </button>
      <Link to="/workspace/tools" className="flex items-center gap-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1.5 transition-colors font-medium">
        <Icon d={ICONS.sparkles} className="w-3.5 h-3.5" />
        Run AI Tool
      </Link>
    </header>
  );
}

// ── Root export ───────────────────────────────────────────────────
export default function WorkspacePage() {
  const { session, signOut } = useContext(AuthContext);
  const navigate = useNavigate();
  const userId = session?.user?.id || "demo";
  const email = session?.user?.email || "";
  const profile = getUserProfile(userId);

  function handleLogout() {
    if (signOut) signOut();
    localStorage.removeItem(`kontra_onboarding_${userId}`);
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar profile={profile} email={email} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar email={email} />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<WorkspaceHome profile={profile} />} />
            <Route path="tools"       element={<WorkspaceTools />} />
            <Route path="marketplace" element={<WorkspaceMarketplace />} />
            <Route path="properties"  element={<WorkspaceProperties />} />
            <Route path="documents"   element={<WorkspaceDocuments />} />
            <Route path="reports"     element={<WorkspaceReports />} />
            <Route path="settings"    element={<WorkspaceSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
