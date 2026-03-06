import { spawn } from 'child_process';
import os from 'os';

const cmd = os.platform() === 'win32' ? 'codex.cmd' : 'codex';
const args = ['exec', '[SYSTEM INSTRUCTIONS]\nYou are a Developer\nHello'];

const child = spawn(cmd, args, { shell: false });

child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));
child.on('close', c => console.log('EXIT:', c));
child.on('error', e => console.error('SPAWN ERR:', e));
