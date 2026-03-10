import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AgentStudio from './pages/AgentStudio';
import AgentTreePage from './pages/AgentTree';
import KanbanBoard from './pages/KanbanBoard';
import SettingsPage from './pages/Settings';
import AgentSwarm from './pages/AgentSwarm';
import SwarmStudio from './pages/SwarmStudio';
import StudioRuns from './pages/StudioRuns';
import StudioSchedules from './pages/StudioSchedules';
import StudioMemory from './pages/StudioMemory';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SwarmStudio />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/studio" element={<SwarmStudio />} />
            <Route path="/studio/runs" element={<StudioRuns />} />
            <Route path="/studio/schedules" element={<StudioSchedules />} />
            <Route path="/studio/memory" element={<StudioMemory />} />
            <Route path="/agents" element={<AgentStudio />} />
            <Route path="/trees" element={<AgentTreePage />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/swarm" element={<AgentSwarm />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
