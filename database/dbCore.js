/**
 * Core Database logic for Site Blocker Extension.
 * Handles IndexedDB initialization and basic utilities.
 */

export const DB_NAME = 'SiteBlockerDB';
export const DB_VERSION = 3;

export class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for sites with toggle state and duration
                if (!db.objectStoreNames.contains('sites')) {
                    const sitesStore = db.createObjectStore('sites', { keyPath: 'id', autoIncrement: true });
                    sitesStore.createIndex('url', 'url', { unique: true });
                }

                // Migrate from old blockedSites store if exists
                if (db.objectStoreNames.contains('blockedSites')) {
                    db.deleteObjectStore('blockedSites');
                }

                // Store for unblock history
                if (!db.objectStoreNames.contains('unblockHistory')) {
                    const historyStore = db.createObjectStore('unblockHistory', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('url', 'url', { unique: false });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async ensureInit() {
        if (!this.db) {
            await this.init();
        }
    }

    extractHostname(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url.replace('www.', '').toLowerCase();
        }
    }
}
