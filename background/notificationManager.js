/**
 * Manages Chrome notifications for the extension.
 */

/**
 * Helper function to create beautiful notifications with auto-dismiss
 * @param {string} id - Notification ID
 * @param {Object} options - Chrome notification options
 * @param {number} autoDismissMs - Time in ms before auto-dismiss (0 to disable)
 */
export async function createNotification(id, options, autoDismissMs = 5000) {
    try {
        const notificationOptions = {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            priority: 2,
            requireInteraction: false, // Allow auto-dismiss
            silent: false,
            ...options
        };

        await chrome.notifications.create(id, notificationOptions);

        // Auto-dismiss using alarms (works reliably in service workers)
        if (autoDismissMs > 0) {
            chrome.alarms.create(`dismiss_notif_${id}`, {
                when: Date.now() + autoDismissMs
            });
        }

        return id;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

/**
 * Shows a warning notification when a site is about to be reblocked.
 * @param {string} url - The URL being warned about
 */
export async function showWarningNotification(url) {
    try {
        const notifId = `warning_${url}`;

        await chrome.notifications.create(notifId, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '⏰ Time Running Out!',
            message: `「${url}」will be blocked in 1 minute!\n\nClick to extend your time.`,
            buttons: [
                { title: '🔄 Add More Time' }
            ],
            priority: 2,
            requireInteraction: false // Allow auto-dismiss
        });

        // Auto-dismiss warning after 5 seconds if user doesn't interact (to match existing behavior)
        chrome.alarms.create(`dismiss_notif_${notifId}`, {
            when: Date.now() + 5000
        });
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}
