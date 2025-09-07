import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

const SaasDashboard = lazy(() => import("./pages/SaasDashboard"));

function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/*" element={<SaasDashboard />} />
      </Routes>
    </Suspense>
  );
}
