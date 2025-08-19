import { createBrowserRouter } from "react-router-dom";
import DashboardShell from "./components/DashboardShell";
import PortfolioOverview from "./pages/lender/PortfolioOverview";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DashboardShell/>,
    children: [
      { index: true, element: <PortfolioOverview/> },
      { path: "lender/portfolio", element: <PortfolioOverview/> },
      // add other subpages similarly…
    ]
  }
]);
