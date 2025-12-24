// Background Service Worker for Site Blocker Extension
import { db } from '../database/db.js';
import { showWarningNotification } from './notificationManager.js';
import { handleNavigation } from './navigationManager.js';
import { checkTimers, reblockSite, resetTimerForSite } from './timerManager.js';
import { handleMessage } from './messageHandler.js';

// Initialize database on install
chrome.runtime.onInstalled.addListener(async () => {
    await db.init();
    console.log('Site Blocker installed and database initialized');
    // Check for any existing timed unblocks
    await checkTimers();
});

// On startup, restore timers
chrome.runtime.onStartup.addListener(async () => {
    await db.ensureInit();
    await checkTimers();
});

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('warning_')) {
        const url = alarm.name.replace('warning_', '');
        await showWarningNotification(url);
    } else if (alarm.name.startsWith('reblock_')) {
        const url = alarm.name.replace('reblock_', '');
        await reblockSite(url);
    } else if (alarm.name.startsWith('dismiss_notif_')) {
        // Auto-dismiss notification
        const notifId = alarm.name.replace('dismiss_notif_', '');
        chrome.notifications.clear(notifId);
    }
});

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (notificationId.startsWith('warning_') && buttonIndex === 0) {
        const url = notificationId.replace('warning_', '');
        await resetTimerForSite(url);
        chrome.notifications.clear(notificationId);
    }
});

// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);

// Listen for messages from popup and blocked page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
});
