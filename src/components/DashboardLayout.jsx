 // src/components/DashboardLayout.jsx
 
 import React, { useState } from 'react';
 import PhotoValidation    from './PhotoValidation';
 import DrawRequestsTable  from './DrawRequestsTable';
 import DrawRequestForm    from './DrawRequestForm';
 import LienWaiverForm     from './LienWaiverForm';
 import LienWaiverList     from './LienWaiverList';
 import CreateLoanForm     from './CreateLoanForm';
 import LoanList           from './LoanList';
 import AmortizationTable  from './AmortizationTable';
 import PaymentForm        from './PaymentForm';
 import VirtualAssistant   from './VirtualAssistant';
 
+// Nav items arranged to reflect common lender operations
 const navItems = [
+  { label: 'Loans',            icon: '💰' },
   { label: 'Draw Requests',    icon: '📄' },
-  { label: 'Photo Validation', icon: '📷' },
   { label: 'Lien Waivers',     icon: '📝' },
-  { label: 'Loans',            icon: '💰' },
+  { label: 'Photo Validation', icon: '📷' },
   { label: 'Assistant',        icon: '🤖' },
   { label: 'Projects',         icon: '🏗️' }
 ];
 
 export default function DashboardLayout() {
-  const [active, setActive] = useState('Draw Requests');
+  // Start on the Loans view by default for lender-centric workflows
+  const [active, setActive] = useState('Loans');
   const [refreshKey, setRefreshKey] = useState(0);
   const [selectedId, setSelectedId] = useState(null);
 
   return (
-    <div className="flex h-screen bg-gray-100">
-      {/* Sidebar */}
-      <aside className="w-64 bg-gray-800 text-white p-6">
-        <h1 className="text-2xl font-bold mb-8">Kontra</h1>
-        <nav>
+    <div className="flex flex-col h-screen bg-gray-100">
+      {/* Top Navigation */}
+      <header className="bg-gray-800 text-white p-4 flex items-center">
+        <h1 className="text-2xl font-bold mr-8">Kontra</h1>
+        <nav className="flex space-x-4">
           {navItems.map(item => (
             <button
               key={item.label}
               onClick={() => {
                 setActive(item.label);
                 // Reset selection when switching sections
                 if (item.label !== 'Lien Waivers' && item.label !== 'Loans') {
                   setSelectedId(null);
                 }
               }}
-              className={`w-full text-left mb-4 p-2 rounded hover:bg-gray-700 ${
+              className={`px-3 py-1 rounded hover:bg-gray-700 ${
                 active === item.label ? 'bg-gray-700' : ''
               }`}
             >
               {item.icon} {item.label}
             </button>
           ))}
         </nav>
-      </aside>
+      </header>
 
       {/* Main Content */}
       <main className="flex-1 p-8 overflow-auto">
         <h2 className="text-3xl font-bold mb-6">{active}</h2>
 
         {active === 'Draw Requests' && (
           <>
             <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />
             <DrawRequestsTable key={refreshKey} onSelect={setSelectedId} />
           </>
         )}
 
         {active === 'Photo Validation' && <PhotoValidation />}
 
         {active === 'Lien Waivers' && (
           selectedId ? (
             <>
               <LienWaiverForm drawId={selectedId} />
               <LienWaiverList drawId={selectedId} />
             </>
           ) : (
             <p className="text-gray-500">Select a draw first to manage waivers</p>
           )
         )}
 
 
EOF
)
