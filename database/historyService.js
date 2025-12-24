/**
 * History Management Service for Site Blocker Extension.
 * Handles recording and retrieving unblock history.
 */

export async function addUnblockReason(url, reason, unblockDuration = 10) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['unblockHistory'], 'readwrite');
        const store = transaction.objectStore('unblockHistory');

        const entry = {
            url: url.toLowerCase().trim(),
            reason: reason,
            timestamp: new Date().toISOString(),
            unblockDuration: unblockDuration, // How long they're allowed
            wasAutoReblocked: null, // Will be updated when reblocked (true = timer, false = manual)
            reblockedAt: null // When they got reblocked
        };

        const request = store.add(entry);
        request.onsuccess = () => resolve(request.result); // Returns the history entry ID
        request.onerror = () => reject(request.error);
    });
}

export async function getUnblockHistory() {
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

// Update history entry when site is reblocked
export async function updateHistoryOnReblock(url, wasAutoReblocked) {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['unblockHistory'], 'readwrite');
        const store = transaction.objectStore('unblockHistory');
        const index = store.index('url');

        // Get all entries for this URL and find the most recent one without reblockedAt
        const request = index.getAll(url.toLowerCase().trim());
        request.onsuccess = () => {
            const entries = request.result
                .filter(e => e.reblockedAt === null)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (entries.length > 0) {
                const entry = entries[0];
                entry.wasAutoReblocked = wasAutoReblocked;
                entry.reblockedAt = new Date().toISOString();

                const updateRequest = store.put(entry);
                updateRequest.onsuccess = () => resolve(true);
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve(false);
            }
        };
        request.onerror = () => reject(request.error);
    });
}
