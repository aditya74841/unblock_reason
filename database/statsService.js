/**
 * Statistics Service for Site Blocker Extension.
 * Contains logic for calculating usage patterns and stats.
 */

export async function getHistoryStats() {
    const history = await this.getUnblockHistory();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter entries from the last 7 days
    const weekHistory = history.filter(e => new Date(e.timestamp) >= weekAgo);
    const todayHistory = history.filter(e => new Date(e.timestamp) >= today);

    // Count by URL
    const urlCounts = {};
    weekHistory.forEach(e => {
        urlCounts[e.url] = (urlCounts[e.url] || 0) + 1;
    });

    // Find most unblocked site
    let mostUnblocked = { url: null, count: 0 };
    Object.entries(urlCounts).forEach(([url, count]) => {
        if (count > mostUnblocked.count) {
            mostUnblocked = { url, count };
        }
    });

    // Calculate streak (days without unblocks, going backwards from yesterday)
    let streak = 0;
    let checkDate = new Date(today.getTime() - 24 * 60 * 60 * 1000); // Start from yesterday

    while (true) {
        const dayStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayHasUnblocks = history.some(e => {
            const ts = new Date(e.timestamp);
            return ts >= dayStart && ts < dayEnd;
        });

        if (dayHasUnblocks) break;
        streak++;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);

        // Limit check to last 30 days
        if (streak >= 30) break;
    }

    // Daily average (over 7 days)
    const avgPerDay = weekHistory.length / 7;

    // Day-wise breakdown for pattern detection
    const dayBreakdown = {};
    weekHistory.forEach(e => {
        const date = new Date(e.timestamp).toDateString();
        dayBreakdown[date] = (dayBreakdown[date] || 0) + 1;
    });

    return {
        totalThisWeek: weekHistory.length,
        totalToday: todayHistory.length,
        mostUnblocked: mostUnblocked,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        streak: streak,
        dayBreakdown: dayBreakdown,
        todayHistory: todayHistory
    };
}
