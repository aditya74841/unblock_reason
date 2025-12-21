// Background Service Worker for Site Blocker Extension
import { db } from '../database/db.js';

// Store active timers
const activeTimers = new Map();

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
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;

    try {
        await db.ensureInit();
        const isBlocked = await db.isBlocked(details.url);

        if (isBlocked) {
            const blockedUrl = chrome.runtime.getURL('blocked/blocked.html') +
                '?url=' + encodeURIComponent(details.url);

            chrome.tabs.update(details.tabId, { url: blockedUrl });
        }
    } catch (error) {
        console.error('Error checking blocked status:', error);
    }
});

// Listen for messages from popup and blocked page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
});

async function handleMessage(message) {
    await db.ensureInit();

    switch (message.action) {
        case 'getAllSites':
            return await db.getAllSites();

        case 'getBlockedSites':
            return await db.getBlockedSites();

        case 'addSite':
            try {
                const siteDuration = message.duration || 10;
                console.log('Background: Adding site', message.url, 'with duration:', siteDuration);
                await db.addSite(message.url, siteDuration);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }

        case 'updateDuration':
            await db.updateSiteDuration(message.url, message.duration);
            return { success: true };

        case 'removeSite':
            // Clear any timers for this site
            clearTimersForSite(message.url);
            await db.removeSite(message.url);
            return { success: true };

        case 'toggleSite':
            // Clear any existing timers
            clearTimersForSite(message.url);
            await db.toggleSite(message.url, message.isBlocked);
            return { success: true };

        case 'unblockWithReason':
            await db.addUnblockReason(message.url, message.reason);
            const timerInfo = await db.unblockWithTimer(message.url);
            if (timerInfo) {
                await setupTimers(timerInfo.url, timerInfo.duration, timerInfo.unblockUntil);
            }
            return { success: true, timerInfo };

        case 'resetTimer':
            const newTimerInfo = await db.resetTimer(message.url);
            if (newTimerInfo) {
                clearTimersForSite(message.url);
                await setupTimers(newTimerInfo.url, newTimerInfo.duration, newTimerInfo.unblockUntil);
            }
            return { success: true, timerInfo: newTimerInfo };

        case 'getUnblockHistory':
            return await db.getUnblockHistory();

        case 'isBlocked':
            return await db.isBlocked(message.url);

        case 'getSiteInfo':
            return await db.getSite(message.url);

        default:
            return { error: 'Unknown action' };
    }
}

async function setupTimers(url, durationMinutes, unblockUntil) {
    const now = Date.now();
    const timeRemaining = unblockUntil - now;

    if (timeRemaining <= 0) {
        // Already expired, reblock immediately
        await reblockSite(url);
        return;
    }

    // Calculate when to show warning (1 minute before reblock)
    const warningTime = timeRemaining - (60 * 1000);

    // Clear any existing alarms for this site
    await chrome.alarms.clear(`warning_${url}`);
    await chrome.alarms.clear(`reblock_${url}`);

    // Set up warning alarm (1 min before)
    if (warningTime > 0) {
        chrome.alarms.create(`warning_${url}`, {
            when: now + warningTime
        });
    } else {
        // Less than 1 minute remaining, show warning immediately
        await showWarningNotification(url);
    }

    // Set up reblock alarm
    chrome.alarms.create(`reblock_${url}`, {
        when: unblockUntil
    });

    console.log(`Timers set for ${url}: warning in ${Math.round(warningTime / 1000)}s, reblock in ${Math.round(timeRemaining / 1000)}s`);
}

async function showWarningNotification(url) {
    try {
        await chrome.notifications.create(`warning_${url}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '⚠️ Site Blocker Warning',
            message: `${url} will be blocked again in 1 minute!`,
            buttons: [
                { title: '🔄 Reset Timer' }
            ],
            priority: 2,
            requireInteraction: true
        });
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

async function reblockSite(url) {
    await db.ensureInit();
    await db.toggleSite(url, true);
    clearTimersForSite(url);

    // Show notification that site is now blocked
    try {
        await chrome.notifications.create(`reblocked_${url}_${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '🛡️ Site Blocked',
            message: `${url} has been automatically blocked.`,
            priority: 1
        });
    } catch (error) {
        console.error('Error showing reblock notification:', error);
    }

    console.log(`Site ${url} has been reblocked`);
}

async function resetTimerForSite(url) {
    const newTimerInfo = await db.resetTimer(url);
    if (newTimerInfo) {
        clearTimersForSite(url);
        await setupTimers(newTimerInfo.url, newTimerInfo.duration, newTimerInfo.unblockUntil);

        // Notify user
        await chrome.notifications.create(`reset_${url}_${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '🔄 Timer Reset',
            message: `${url} timer reset to ${newTimerInfo.duration} minutes.`,
            priority: 1
        });
    }
}

function clearTimersForSite(url) {
    chrome.alarms.clear(`warning_${url}`);
    chrome.alarms.clear(`reblock_${url}`);
}

async function checkTimers() {
    const unblockedSites = await db.getUnblockedWithTimer();
    const now = Date.now();

    for (const site of unblockedSites) {
        if (site.unblockUntil) {
            if (site.unblockUntil <= now) {
                // Timer expired, reblock
                await reblockSite(site.url);
            } else {
                // Set up timers
                await setupTimers(site.url, site.unblockDuration, site.unblockUntil);
            }
        }
    }
}
