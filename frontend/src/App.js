// App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Snapshots from './components/Snapshots';
import Blacklist from './components/Blacklist';
import Settings from './components/Settings';
// Authentication can be added as needed

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/snapshots" element={<Snapshots />} />
        <Route path="/blacklist" element={<Blacklist />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;
