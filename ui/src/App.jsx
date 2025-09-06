import { Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";

export default function App() {
  return (
    <Routes>
      {/* Dashboard layout */}
      <Route path="/*" element={<DashboardLayout />} />
    </Routes>
  );
}
