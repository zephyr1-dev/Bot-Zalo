/*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                   _ooOoo_
                  o8888888o
                  88" . "88
                  (| -_- |)
                  O\  =  /O
               ____/`---'\____
             .'  \\|     |//  `.
            /  \\|||  :  |||//  \
           /  _||||| -:- |||||-  \
           |   | \\\  -  /// |   |
           | \_|  ''\---/''  |   |
           \  .-\__  `-`  ___/-. /
         ___`. .'  /--.--\  `. . __
      ."" '<  `.___\_<|>_/___.'  >'"".
     | | :  `- \`.;`\ _ /`;.`/ - ` : | |
     \  \ `-.   \_ __\ /__ _/   .-` /  /
======`-.____`-.___\_____/___.-`____.-'======
                   `=---='
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  PHẬT ĐỘ, CODE Không LỖI, TỐI ƯU Không BUG
            DEVELOPER: SBT
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

import { spawn } from 'child_process';
import path from 'path';
const cmdPath = path.join('C:', 'Windows', 'System32', 'cmd.exe');
import { ensureLogFiles, logManagerBot } from './src/utils/io-json.js';

let botProcess;

function startBot() {
    botProcess = spawn(cmdPath, ['/c', 'npm start'], {
        detached: true,
        stdio: 'ignore'
    });
    attachBotEvents(botProcess);
    botProcess.unref();
    logManagerBot('Bot started');
    console.log('Bot started');
}

function stopBot() {
    if (botProcess && botProcess.pid) {
        try {
            process.kill(-botProcess.pid);
            logManagerBot('Bot stopped');
            console.log('Bot stopped');
        } catch (err) {
            logManagerBot(`Failed to stop bot: ${err.message}`);
            console.log('Failed to stop bot:', err.message);
        }
    } else {
        logManagerBot('Failed to stop bot: invalid PID');
        console.log('Failed to stop bot: invalid PID');
    }
}

function restartBot() {
    stopBot();
    setTimeout(() => {
        startBot();
        logManagerBot('Bot restarted');
        console.log('Bot restarted');
    }, 1000);
}

ensureLogFiles();
startBot();

function attachBotEvents(botProcess) {
    botProcess.on('error', (err) => {
        logManagerBot(`Bot gặp lỗi: ${err.message}`);
        console.error('Lỗi bot:', err.message);
        restartBot();
    });

    botProcess.on('exit', (code) => {
        logManagerBot(`Bot đã thoát với mã: ${code}`);
        console.log('Bot đã thoát:', code);
        restartBot();
    });
}

setInterval(() => {
    // restartBot();
}, 1800000);//30p

process.on('SIGINT', () => {
    logManagerBot('Bot stopped by user (SIGINT). Restarting...');
    console.log('Bot stopped by user (SIGINT). Restarting...');
    restartBot();
});

process.on('SIGTERM', () => {
    logManagerBot('Bot stopped (SIGTERM). Restarting...');
    console.log('Bot stopped (SIGTERM). Restarting...');
    restartBot();
});

process.on('exit', () => {
    logManagerBot('Bot process was closed unexpectedly. Restarting after 1 seconds...');
    console.log('Bot process was closed unexpectedly. Restarting after 1 seconds...');
    setTimeout(() => {
        startBot();
    }, 1000);
});
