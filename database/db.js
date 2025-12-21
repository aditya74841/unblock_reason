// IndexedDB Database Wrapper for Site Blocker Extension

const DB_NAME = 'SiteBlockerDB';
const DB_VERSION = 3; // Updated version for timed unblock

class Database {
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
        } else {
          // Sites store already exists, no migration needed for new fields
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

  async addSite(url, unblockDuration = 10) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');

      const site = {
        url: url.toLowerCase().trim(),
        isBlocked: true,
        unblockDuration: unblockDuration, // Duration in minutes
        unblockUntil: null, // Timestamp when to reblock
        dateAdded: new Date().toISOString()
      };

      const request = store.add(site);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateSiteDuration(url, duration) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const getRequest = index.get(url.toLowerCase().trim());
      getRequest.onsuccess = () => {
        const site = getRequest.result;
        if (site) {
          site.unblockDuration = duration;
          const updateRequest = store.put(site);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removeSite(url) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const request = index.getKey(url.toLowerCase().trim());
      request.onsuccess = () => {
        if (request.result !== undefined) {
          store.delete(request.result);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async toggleSite(url, isBlocked) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const getRequest = index.get(url.toLowerCase().trim());
      getRequest.onsuccess = () => {
        const site = getRequest.result;
        if (site) {
          site.isBlocked = isBlocked;
          site.unblockUntil = null; // Clear timer when manually toggling
          const updateRequest = store.put(site);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async unblockWithTimer(url) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const getRequest = index.get(url.toLowerCase().trim());
      getRequest.onsuccess = () => {
        const site = getRequest.result;
        if (site) {
          site.isBlocked = false;
          // Set unblock until time
          site.unblockUntil = Date.now() + (site.unblockDuration * 60 * 1000);
          const updateRequest = store.put(site);
          updateRequest.onsuccess = () => resolve({
            url: site.url,
            duration: site.unblockDuration,
            unblockUntil: site.unblockUntil
          });
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async resetTimer(url) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readwrite');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const getRequest = index.get(url.toLowerCase().trim());
      getRequest.onsuccess = () => {
        const site = getRequest.result;
        if (site && !site.isBlocked) {
          // Reset the timer to full duration again
          site.unblockUntil = Date.now() + (site.unblockDuration * 60 * 1000);
          const updateRequest = store.put(site);
          updateRequest.onsuccess = () => resolve({
            url: site.url,
            duration: site.unblockDuration,
            unblockUntil: site.unblockUntil
          });
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getSite(url) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readonly');
      const store = transaction.objectStore('sites');
      const index = store.index('url');

      const request = index.get(url.toLowerCase().trim());
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSites() {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sites'], 'readonly');
      const store = transaction.objectStore('sites');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getBlockedSites() {
    const allSites = await this.getAllSites();
    return allSites.filter(site => site.isBlocked);
  }

  async getUnblockedWithTimer() {
    const allSites = await this.getAllSites();
    return allSites.filter(site => !site.isBlocked && site.unblockUntil);
  }

  async isBlocked(url) {
    const sites = await this.getBlockedSites();
    const hostname = this.extractHostname(url);
    return sites.some(site => hostname.includes(site.url) || site.url.includes(hostname));
  }

  async addUnblockReason(url, reason) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['unblockHistory'], 'readwrite');
      const store = transaction.objectStore('unblockHistory');

      const entry = {
        url: url.toLowerCase().trim(),
        reason: reason,
        timestamp: new Date().toISOString()
      };

      const request = store.add(entry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnblockHistory() {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['unblockHistory'], 'readonly');
      const store = transaction.objectStore('unblockHistory');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result.sort((a, b) =>
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  extractHostname(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url.replace('www.', '').toLowerCase();
    }
  }

  async ensureInit() {
    if (!this.db) {
      await this.init();
    }
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.SiteBlockerDB = new Database();
}

// For module usage
export const db = new Database();
