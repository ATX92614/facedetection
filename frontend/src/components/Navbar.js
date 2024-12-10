import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <h1>FaceDetector</h1>
        </div>
        <button className="hamburger-icon" onClick={toggleMenu}>
          ☰ Menu
        </button>
        <div className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
          <NavLink to="/" exact className="nav-link" activeClassName="active-link">
            Dashboard
          </NavLink>
          <NavLink to="/snapshots" className="nav-link" activeClassName="active-link">
            Snapshots
          </NavLink>
          <NavLink to="/blacklist" className="nav-link" activeClassName="active-link">
            Blacklist
          </NavLink>
          <NavLink to="/settings" className="nav-link" activeClassName="active-link">
            Settings
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
