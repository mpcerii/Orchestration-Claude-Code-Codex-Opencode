import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AgentStudio from './pages/AgentStudio';
import AgentTreePage from './pages/AgentTree';
import KanbanBoard from './pages/KanbanBoard';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<AgentStudio />} />
            <Route path="/trees" element={<AgentTreePage />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
