import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AppSettings } from '../types';
import { Save, FolderOpen } from 'lucide-react';

export default function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>({
        defaultWorkspacePath: '',
        theme: 'dark',
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        api.getSettings().then(setSettings).catch(() => { });
    }, []);

    async function handleSave() {
        await api.updateSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Settings</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                    Globale Einstellungen für AI Orchestra
                </p>
            </div>

            <div className="card" style={{ padding: 28, maxWidth: 600 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label className="label">
                            <FolderOpen size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            Standard Workspace Pfad
                        </label>
                        <input className="input"
                            placeholder="C:"
                            value={settings.defaultWorkspacePath}
                            onChange={(e) => setSettings({ ...settings, defaultWorkspacePath: e.target.value })}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            Der Standard-Ordner, in dem die CLI-Agenten arbeiten. Kann pro Tree überschrieben werden.
                        </p>
                    </div>

                    <div>
                        <label className="label">Theme</label>
                        <select className="select" value={settings.theme}
                            onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'dark' | 'light' })}>
                            <option value="dark">Dark Mode</option>
                            <option value="light">Light Mode (coming soon)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button className="btn-primary" onClick={handleSave}>
                            <Save size={14} /> Speichern
                        </button>
                        {saved && (
                            <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                                ✓ Gespeichert!
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* CLI Tool Status */}
            <div className="card" style={{ padding: 28, maxWidth: 600, marginTop: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Installierte CLI Tools</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {['claude', 'gemini', 'codex', 'opencode'].map((tool) => (
                        <div key={tool} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className={`badge badge-${tool}`}>{tool}</span>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>
                                    {tool === 'claude' ? 'Claude Code' :
                                        tool === 'gemini' ? 'Gemini CLI' :
                                            tool === 'codex' ? 'Codex CLI' : 'OpenCode'}
                                </span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--success)' }}>● Verfügbar</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
