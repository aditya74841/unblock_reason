import { db } from '../database/db.js';
import { clearTimersForSite, setupTimers, reblockSite } from './timerManager.js';
import { refreshBlockedTabs } from './navigationManager.js';

/**
 * Handles messages from popup and blocked page.
 * @param {Object} message - The message object
 * @returns {Promise<any>} Response object
 */
export async function handleMessage(message) {
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
            // If blocking, refresh any open tabs for this site and update history
            if (message.isBlocked) {
                await db.updateHistoryOnReblock(message.url, false); // Manual reblock
                await refreshBlockedTabs(message.url);
            }
            return { success: true };

        case 'unblockWithReason':
            const site = await db.getSite(message.url);
            const duration = site?.unblockDuration || 10;
            await db.addUnblockReason(message.url, message.reason, duration);
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

        case 'getHistoryStats':
            return await db.getHistoryStats();

        case 'isBlocked':
            return await db.isBlocked(message.url);

        case 'getSiteInfo':
            return await db.getSite(message.url);

        default:
            return { error: 'Unknown action' };
    }
}
