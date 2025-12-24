import { db } from '../database/db.js';
import { createNotification, showWarningNotification } from './notificationManager.js';
import { refreshBlockedTabs } from './navigationManager.js';

/**
 * Manages timers, reblocking logic, and time extensions.
 */

/**
 * Sets up warning and reblock alarms for a site.
 * @param {string} url - The site URL
 * @param {number} durationMinutes - Duration of unblock
 * @param {number} unblockUntil - Expiration timestamp
 */
export async function setupTimers(url, durationMinutes, unblockUntil) {
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

/**
 * Reblocks a site, clears its timers, and refreshes tabs.
 * @param {string} url - The site URL
 */
export async function reblockSite(url) {
    await db.ensureInit();
    await db.toggleSite(url, true);
    clearTimersForSite(url);

    // Update history to mark as auto-reblocked (timer expired)
    await db.updateHistoryOnReblock(url, true);

    // Refresh any tabs that have this site open
    await refreshBlockedTabs(url);

    // Show notification that site is now blocked (auto-dismiss in 5 seconds)
    await createNotification(`reblocked_${url}_${Date.now()}`, {
        title: '🛡️ Back to Focus Mode!',
        message: `「${url}」is now blocked.\n\nStay productive! 💪`
    }, 5000);

    console.log(`Site ${url} has been reblocked`);
}

/**
 * Resets the timer for a site (extends time).
 * @param {string} url - The site URL
 */
export async function resetTimerForSite(url) {
    const newTimerInfo = await db.resetTimer(url);
    if (newTimerInfo) {
        clearTimersForSite(url);
        await setupTimers(newTimerInfo.url, newTimerInfo.duration, newTimerInfo.unblockUntil);

        // Notify user (auto-dismiss in 5 seconds)
        await createNotification(`reset_${url}_${Date.now()}`, {
            title: '✅ Timer Extended!',
            message: `「${url}」extended for ${newTimerInfo.duration} more minutes.\n\nUse your time wisely!`
        }, 5000);
    }
}

/**
 * Clears alarms associated with a site.
 * @param {string} url - The site URL
 */
export function clearTimersForSite(url) {
    chrome.alarms.clear(`warning_${url}`);
    chrome.alarms.clear(`reblock_${url}`);
}

/**
 * Checks all unblocked sites and restores or expires their timers.
 */
export async function checkTimers() {
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
