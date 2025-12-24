import { db } from '../database/db.js';

/**
 * Manages navigation events and tab updates.
 */

/**
 * Handles navigation events to check if a site is blocked.
 * @param {Object} details - Navigation details from onBeforeNavigate
 */
export async function handleNavigation(details) {
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
}

/**
 * Refreshes all tabs that match a newly blocked URL.
 * @param {string} url - The URL (domain) that was blocked
 */
export async function refreshBlockedTabs(url) {
    try {
        const tabs = await chrome.tabs.query({});
        const blockedPageUrl = chrome.runtime.getURL('blocked/blocked.html');

        for (const tab of tabs) {
            if (!tab.url) continue;

            // Skip if already on blocked page
            if (tab.url.startsWith(blockedPageUrl)) continue;

            try {
                const tabUrl = new URL(tab.url);
                const tabDomain = tabUrl.hostname.replace('www.', '');

                // Check if the tab's domain matches the blocked URL
                if (tabDomain === url || tabDomain.endsWith('.' + url)) {
                    const redirectUrl = blockedPageUrl + '?url=' + encodeURIComponent(tab.url);
                    await chrome.tabs.update(tab.id, { url: redirectUrl });
                    console.log(`Refreshed tab ${tab.id} to blocked page for ${url}`);
                }
            } catch (e) {
                // Invalid URL, skip
            }
        }
    } catch (error) {
        console.error('Error refreshing blocked tabs:', error);
    }
}
