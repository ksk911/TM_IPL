import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Phase1Setup from './components/Phase1Setup';
import SetupDashboard from './components/SetupDashboard';
import WaitingRoom from './components/WaitingRoom';
import Phase2Auction from './components/Phase2Auction';
import Phase3Speaking from './components/Phase3Speaking';
import Phase4Competition from './components/Phase4Competition';
import Phase5Results from './components/Phase5Results';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>IPL Auction & Competition</h1>
        </header>
        
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            
            {/* Phase 1 Routes */}
            <Route path="/setup" element={<Phase1Setup />} />
            <Route path="/setup-dashboard/:roomId" element={<SetupDashboard />} />
            <Route path="/waiting-room/:roomId" element={<WaitingRoom />} />
            
            {/* Phase 2 Routes */}
            <Route path="/auction/:roomId" element={<Phase2Auction />} />

            {/* Phase 3 Routes */}
            <Route path="/speaking/:roomId" element={<Phase3Speaking />} />

            {/* Phase 4 Routes */}
            <Route path="/competition/:roomId" element={<Phase4Competition />} />

            {/* Phase 5 Routes */}
            <Route path="/results/:roomId" element={<Phase5Results />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
