/**
 * Database aggregation module.
 * Recombines specialized services into the main Database class to maintain API compatibility.
 */

import { Database } from './dbCore.js';
import * as siteService from './siteService.js';
import * as historyService from './historyService.js';
import * as statsService from './statsService.js';

// Aggregate methods onto Database prototype
Object.assign(Database.prototype, siteService);
Object.assign(Database.prototype, historyService);
Object.assign(Database.prototype, statsService);

// Export for use in other scripts (Window for popup, export for service worker)
if (typeof window !== 'undefined') {
  window.SiteBlockerDB = new Database();
}

/**
 * Singleton instance of the Database
 */
export const db = new Database();
export { Database };
