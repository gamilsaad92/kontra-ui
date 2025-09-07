import { Routes, Route } from "react-router-dom";
import SaasDashboard from "./pages/SaasDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<SaasDashboard />} />
    </Routes>
  );
}
