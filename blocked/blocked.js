// Blocked Page Script

document.addEventListener('DOMContentLoaded', () => {
    const blockedUrlEl = document.getElementById('blockedUrl');
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

    // Go back button
    goBackBtn.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    });

    // Focus on the reason input
    reasonInput.focus();
});
