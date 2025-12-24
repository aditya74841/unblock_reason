// Blocked Page Script

document.addEventListener('DOMContentLoaded', () => {
    const blockedUrlEl = document.getElementById('blockedUrl');
    const confirmSection = document.getElementById('confirmSection');
    const unblockSection = document.getElementById('unblockSection');
    const noBtn = document.getElementById('noBtn');
    const yesBtn = document.getElementById('yesBtn');
    const reasonInput = document.getElementById('reasonInput');
    const unblockBtn = document.getElementById('unblockBtn');
    const goBackBtn = document.getElementById('goBackBtn');

    // Get the blocked URL from query params
    const urlParams = new URLSearchParams(window.location.search);
    const blockedUrl = urlParams.get('url') || 'Unknown URL';

    // Extract domain for display
    let displayUrl = blockedUrl;
    try {
        const urlObj = new URL(blockedUrl);
        displayUrl = urlObj.hostname;
    } catch {
        displayUrl = blockedUrl;
    }

    blockedUrlEl.textContent = displayUrl;

    // Stats Dashboard elements
    const statsDashboard = document.getElementById('statsDashboard');
    const statTotal = document.getElementById('statTotal');
    const statAvg = document.getElementById('statAvg');
    const statStreak = document.getElementById('statStreak');
    const statMostUnblocked = document.getElementById('statMostUnblocked');

    // Load and display stats
    async function loadStats() {
        try {
            const stats = await chrome.runtime.sendMessage({ action: 'getHistoryStats' });

            if (stats) {
                statTotal.textContent = stats.totalThisWeek;
                statAvg.textContent = stats.avgPerDay;
                statStreak.textContent = stats.streak > 0 ? `${stats.streak}🔥` : '0';

                if (stats.mostUnblocked.url && stats.mostUnblocked.count > 1) {
                    statMostUnblocked.innerHTML = `⚠️ Most unblocked: <strong>${stats.mostUnblocked.url}</strong> (${stats.mostUnblocked.count}x)`;
                } else {
                    statMostUnblocked.innerHTML = '';
                }

                // Hide dashboard if no history
                if (stats.totalThisWeek === 0) {
                    statsDashboard.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            statsDashboard.style.display = 'none';
        }
    }

    // Load stats on page load
    loadStats();

    // No button - go back to previous page
    noBtn.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    });

    // Yes button - show reason input section
    yesBtn.addEventListener('click', () => {
        confirmSection.style.display = 'none';
        unblockSection.style.display = 'block';
        unblockSection.classList.add('fade-in');
        reasonInput.focus();
    });

    // Enable/disable unblock button based on reason input
    reasonInput.addEventListener('input', () => {
        const hasReason = reasonInput.value.trim().length >= 5;
        unblockBtn.disabled = !hasReason;
    });

    // Unblock and continue
    unblockBtn.addEventListener('click', async () => {
        const reason = reasonInput.value.trim();

        if (reason.length < 5) {
            alert('Please enter a valid reason (at least 5 characters)');
            return;
        }

        // Extract just the domain for storage
        let domain = displayUrl.replace('www.', '');

        try {
            await chrome.runtime.sendMessage({
                action: 'unblockWithReason',
                url: domain,
                reason: reason
            });

            // Redirect to the original URL
            window.location.href = blockedUrl;
        } catch (error) {
            console.error('Error unblocking:', error);
            alert('Error unblocking site. Please try again.');
        }
    });

    // Go back button (in reason section)
    goBackBtn.addEventListener('click', () => {
        // Go back to confirmation step
        unblockSection.style.display = 'none';
        confirmSection.style.display = 'block';
        reasonInput.value = '';
        unblockBtn.disabled = true;
    });
});
