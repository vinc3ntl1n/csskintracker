import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useParams } from "react-router-dom";
import App from "./App";
import "./index.css";

import HomePage from "./pages/HomePage";       
import WeaponPage from "./components/WeaponPage";    
import NotFoundPage from "./pages/NotFoundPage";  

import WeaponPricingTabs from "./pages/WeaponPricingTab";

function WeaponRoute() {
  const { name } = useParams();
  return <WeaponPricingTabs weaponName={decodeURIComponent(name ?? "AK-47")} />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,  
    children: [
      { index: true, element: <HomePage /> },
      { path: "weapons", element: <WeaponPage /> },     
      { path: "weapon/:name", element: <WeaponRoute /> },    
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
