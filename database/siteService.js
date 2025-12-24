/**
 * Site Management Service for Site Blocker Extension.
 * Contains methods for adding, removing, and checking sites.
 */

export async function addSite(url, unblockDuration = 10) {
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

export async function updateSiteDuration(url, duration) {
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

export async function removeSite(url) {
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

export async function toggleSite(url, isBlocked) {
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

export async function unblockWithTimer(url) {
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

export async function resetTimer(url) {
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

export async function getSite(url) {
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

export async function getAllSites() {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['sites'], 'readonly');
        const store = transaction.objectStore('sites');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getBlockedSites() {
    const allSites = await this.getAllSites();
    return allSites.filter(site => site.isBlocked);
}

export async function getUnblockedWithTimer() {
    const allSites = await this.getAllSites();
    return allSites.filter(site => !site.isBlocked && site.unblockUntil);
}

export async function isBlocked(url) {
    const sites = await this.getBlockedSites();
    const currentHostname = this.extractHostname(url); // e.g., "old.reddit.com"

    // Get aliases for the current domain (e.g., if on twitter.com, check x.com too)
    const aliases = this.getDomainAliases(currentHostname);
    const domainsToCheck = [currentHostname, ...aliases];

    return sites.some(site => {
        const blockedDomain = site.url.toLowerCase(); // e.g., "reddit.com"

        return domainsToCheck.some(domain => {
            // Match 1: Exact match
            if (domain === blockedDomain) return true;

            // Match 2: Subdomain match (checks if it ends with ".reddit.com")
            if (domain.endsWith('.' + blockedDomain)) return true;

            return false;
        });
    });
}
