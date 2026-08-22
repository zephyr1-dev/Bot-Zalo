import path from 'path';
import process from 'process';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
export const projectRoot = path.resolve(process.cwd());
const args = process.argv;
const botName = args[2] || 'admin';
const runWithPM2 = args.length > 2;
export const cfgPath = path.join(projectRoot, 'assets', 'config.json');
const isWindows = process.platform === 'win32';
function validateFiles() {
    if (!fs.existsSync(cfgPath)) {
        console.error(`Config not found: ${cfgPath}`);
        process.exit(1);
    }
    const indexPath = path.join(projectRoot, 'src', 'index.js');
    if (!fs.existsSync(indexPath)) {
        console.error(`Source not found: ${indexPath}`);
        process.exit(1);
    }
    return indexPath;
}
function checkPM2() {
    return new Promise((resolve) => {
        const pm2Command = isWindows ? 'pm2.cmd' : 'pm2';
        const pm2Check = spawn(pm2Command, ['--version'], { 
            stdio: 'pipe',
            shell: true,
            windowsHide: isWindows
        });
        let hasOutput = false;
        pm2Check.stdout.on('data', () => {
            hasOutput = true;
        });
        pm2Check.stderr.on('data', (data) => {
            if (!isWindows) {
                console.warn(`PM2 check stderr: ${data}`);
            }
        });
        pm2Check.on('close', (code) => {
            resolve(code === 0 || hasOutput);
        });
        pm2Check.on('error', (err) => {
            console.warn(`PM2 check error: ${err.message}`);
            resolve(false);
        });
        setTimeout(() => {
            pm2Check.kill();
            resolve(false);
        }, 5000);
    });
}
function startWithPM2(indexPath) {
    const pm2Command = isWindows ? 'pm2.cmd' : 'pm2';
    const pm2Args = [
        'start', 
        indexPath,
        '--name', botName,
        '--silent',
        '--no-autorestart',
        ...(isWindows ? ['--no-daemon'] : [])
    ];
    console.log(`Starting with PM2: ${pm2Command} ${pm2Args.join(' ')}`);
    const pm2Process = spawn(pm2Command, pm2Args, {
        stdio: 'inherit',
        shell: true,
        windowsHide: false,
        env: {
            ...process.env,
            BOT_NAME: botName,
            CONFIG_PATH: cfgPath,
            PROJECT_ROOT: projectRoot,
            NODE_ENV: 'production',
            PM2_HOME: process.env.PM2_HOME || path.join(process.env.USERPROFILE || process.env.HOME, '.pm2')
        }
    });
    pm2Process.on('close', (code) => {
        console.log(`PM2 process exited with code ${code}`);
        process.exit(code);
    });
    pm2Process.on('error', (err) => {
        console.error(`PM2 process error: ${err.message}`);
        process.exit(1);
    });
    ['SIGINT', 'SIGTERM'].forEach(signal => {
        process.on(signal, () => {
            console.log(`Received ${signal}, stopping PM2 process...`);
            pm2Process.kill(signal);
        });
    });
}
function startDirect(indexPath) {
    console.log(`Starting directly: node ${indexPath}`);
    const nodeProcess = spawn('node', [indexPath], {
        stdio: 'inherit',
        shell: isWindows,
        windowsHide: false,
        env: {
            ...process.env,
            BOT_NAME: botName,
            CONFIG_PATH: cfgPath,
            PROJECT_ROOT: projectRoot
        }
    });
    nodeProcess.on('close', (code) => {
        console.log(`Node process exited with code ${code}`);
        process.exit(code);
    });
    nodeProcess.on('error', (err) => {
        console.error(`Node process error: ${err.message}`);
        process.exit(1);
    });
    ['SIGINT', 'SIGTERM'].forEach(signal => {
        process.on(signal, () => {
            console.log(`Received ${signal}, stopping node process...`);
            nodeProcess.kill(signal);
        });
    });
}
async function main() {
    console.log(`Platform: ${process.platform}`);
    console.log(`Bot name: ${botName}`);
    console.log(`Config path: ${cfgPath}`);
    console.log(`Run with PM2: ${runWithPM2}`);
    const indexPath = validateFiles();
    console.log(`Index path: ${indexPath}`);
    if (runWithPM2) {
        console.log('Checking PM2...');
        const pm2Available = await checkPM2();
        if (!pm2Available) {
            console.error('PM2 not available or not working properly');
            console.log('Trying to install PM2 with: npm install -g pm2');
            console.log('Or falling back to direct node execution...');
            startDirect(indexPath);
            return;
        }
        console.log('PM2 is available, starting with PM2...');
        startWithPM2(indexPath);
    } else {
        console.log('Starting directly with Node.js...');
        startDirect(indexPath);
    }
}
const currentFile = fileURLToPath(import.meta.url);
const scriptFile = process.argv[1];
if (currentFile === scriptFile || path.resolve(currentFile) === path.resolve(scriptFile)) {
    main().catch((err) => {
        console.error('Main process error:', err);
        process.exit(1);
    });
}