import { Routes, Route } from "react-router-dom";
import ErrorBoundary from "./app/ErrorBoundary";
import SaasDashboard from "./pages/SaasDashboard";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/*" element={<SaasDashboard />} />
      </Routes>
    </ErrorBoundary>
  );
}
