// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useParams } from "react-router-dom";
import App from "./App";
import "./index.css";

// your existing pages:
import HomePage from "./pages/HomePage";          // already in your repo
import WeaponPage from "./components/WeaponPage";      // (keep if you use it)
import NotFoundPage from "./pages/NotFoundPage";  // already in your repo

// the new page:
import WeaponPricingTabs from "./pages/WeaponPricingTab";

function WeaponRoute() {
  const { name } = useParams();
  return <WeaponPricingTabs weaponName={decodeURIComponent(name ?? "AK-47")} />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,   // layout with Header + <Outlet />
    children: [
      { index: true, element: <HomePage /> },
      { path: "weapons", element: <WeaponPage /> },          // keep your existing routes
      { path: "weapon/:name", element: <WeaponRoute /> },    // ⬅ NEW
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
