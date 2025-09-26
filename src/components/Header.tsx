import React from "react";

const Header: React.FC = () => {
  return (
    <header className="app-header">
      <h1 className="header-title">CS2 Skin Tracker</h1>

      <style>{`
        .app-header {
          background: #1f2030;
          color: #fff;
          padding: 16px;
          text-align: center;
          border-bottom: 3px solid #111;
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        .header-title {
          margin: 0;
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
      `}</style>
    </header>
  );
};

export default Header;
