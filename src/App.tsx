import "./App.css";
import Header from "./components/Header";
import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <>
      <main>
        <Outlet />
      </main>
    </>
  );
}
