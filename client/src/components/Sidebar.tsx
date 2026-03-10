import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Bot,
    GitBranch,
    KanbanSquare,
    Settings,
    Zap,
    Network,
    Play,
    Clock,
    Database,
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Swarm Studio' },
    { to: '/studio/runs', icon: Play, label: 'Runs' },
    { to: '/studio/schedules', icon: Clock, label: 'Schedules' },
    { to: '/studio/memory', icon: Database, label: 'Memory' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Legacy Dashboard' },
    { to: '/agents', icon: Bot, label: 'Agent Studio' },
    { to: '/trees', icon: GitBranch, label: 'Agent Trees' },
    { to: '/kanban', icon: KanbanSquare, label: 'Kanban Board' },
    { to: '/swarm', icon: Network, label: 'Agent Swarm' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
    return (
        <aside className="sidebar">
            {/* Logo */}
            <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--accent), #a855f7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Zap size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
                            AI Swarm Studio
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Local Orchestration Runtime
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 8,
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            color: isActive ? 'var(--accent-hover)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--accent-glow)' : 'transparent',
                            transition: 'all 0.15s ease',
                        })}
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-muted)',
            }}>
                v1.0.0 • Local Instance
            </div>
        </aside>
    );
}
