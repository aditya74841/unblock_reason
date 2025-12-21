// Popup Script for Site Blocker Extension

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const durationSelect = document.getElementById('durationSelect');
    const addBtn = document.getElementById('addBtn');
    const sitesList = document.getElementById('sitesList');
    const historyList = document.getElementById('historyList');
    const emptyMessage = document.getElementById('emptyMessage');
    const emptyHistoryMessage = document.getElementById('emptyHistoryMessage');
    const tabs = document.querySelectorAll('.tab');

    // Reason Modal elements
    const reasonModal = document.getElementById('reasonModal');
    const modalUrl = document.getElementById('modalUrl');
    const modalDuration = document.getElementById('modalDuration');
    const modalReasonInput = document.getElementById('modalReasonInput');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmUnblockBtn = document.getElementById('confirmUnblockBtn');

    // Edit Modal elements
    const editModal = document.getElementById('editModal');
    const editModalUrl = document.getElementById('editModalUrl');
    const editDurationSelect = document.getElementById('editDurationSelect');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editSaveBtn = document.getElementById('editSaveBtn');

    let currentUnblockUrl = null;
    let currentEditUrl = null;

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            const tabId = tab.dataset.tab + '-tab';
            document.getElementById(tabId).classList.add('active');

            if (tab.dataset.tab === 'history') {
                loadHistory();
            }
        });
    });

    // Add site
    addBtn.addEventListener('click', addSite);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSite();
    });

    async function addSite() {
        const url = urlInput.value.trim();
        if (!url) return;

        const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        const durationValue = durationSelect.value;
        const duration = parseInt(durationValue, 10);

        console.log('Adding site:', cleanUrl, 'Duration value:', durationValue, 'Parsed:', duration);

        const response = await chrome.runtime.sendMessage({
            action: 'addSite',
            url: cleanUrl,
            duration: duration
        });

        if (response.success) {
            urlInput.value = '';
            loadSites();
        } else {
            alert('Site already exists or error occurred');
        }
    }

    async function loadSites() {
        const sites = await chrome.runtime.sendMessage({ action: 'getAllSites' });

        sitesList.innerHTML = '';

        if (!sites || sites.length === 0) {
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';

        sites.forEach(site => {
            const li = document.createElement('li');
            li.className = site.isBlocked ? 'blocked' : 'unblocked';

            const timerHtml = (!site.isBlocked && site.unblockUntil)
                ? `<div class="site-timer" data-url="${site.url}" data-until="${site.unblockUntil}">⏱️ <span class="countdown"></span></div>`
                : '';

            li.innerHTML = `
                <div class="site-row">
                    <div class="site-info">
                        <span class="site-url">${site.url}</span>
                        <span class="site-status ${site.isBlocked ? 'blocked' : 'unblocked'}">
                            ${site.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                    </div>
                    <div class="site-actions">
                        <label class="toggle-switch">
                            <input type="checkbox" ${site.isBlocked ? 'checked' : ''} data-url="${site.url}">
                            <span class="toggle-slider"></span>
                        </label>
                        <button class="btn-delete" data-url="${site.url}">✕</button>
                    </div>
                </div>
                <div class="site-meta">
                    <div class="site-duration" data-url="${site.url}" data-duration="${site.unblockDuration || 10}">
                        ⏱️ ${site.unblockDuration || 10} min unblock
                    </div>
                    ${timerHtml}
                </div>
            `;
            sitesList.appendChild(li);
        });

        // Start countdown timers
        startCountdowns();

        // Add toggle handlers
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const url = e.target.dataset.url;
                const shouldBlock = e.target.checked;

                if (!shouldBlock) {
                    e.target.checked = true;
                    showReasonModal(url);
                } else {
                    await chrome.runtime.sendMessage({
                        action: 'toggleSite',
                        url: url,
                        isBlocked: true
                    });
                    loadSites();
                }
            });
        });

        // Add duration edit handlers
        document.querySelectorAll('.site-duration').forEach(el => {
            el.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                const duration = e.currentTarget.dataset.duration;
                showEditModal(url, duration);
            });
        });

        // Add delete handlers
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const url = e.target.dataset.url;
                if (confirm(`Remove ${url} from the list?`)) {
                    await chrome.runtime.sendMessage({
                        action: 'removeSite',
                        url: url
                    });
                    loadSites();
                }
            });
        });
    }

    function startCountdowns() {
        const timers = document.querySelectorAll('.site-timer');

        timers.forEach(timer => {
            const until = parseInt(timer.dataset.until);
            const countdownEl = timer.querySelector('.countdown');

            const updateCountdown = () => {
                const now = Date.now();
                const remaining = until - now;

                if (remaining <= 0) {
                    countdownEl.textContent = 'Reblocking...';
                    loadSites();
                    return;
                }

                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} left`;
            };

            updateCountdown();
            const interval = setInterval(updateCountdown, 1000);
            timer.dataset.interval = interval;
        });
    }

    async function showReasonModal(url) {
        currentUnblockUrl = url;

        // Get site info to show duration
        const site = await chrome.runtime.sendMessage({ action: 'getSiteInfo', url: url });

        modalUrl.textContent = url;
        modalDuration.textContent = `Will be blocked again in ${site?.unblockDuration || 10} minutes`;
        modalReasonInput.value = '';
        confirmUnblockBtn.disabled = true;
        reasonModal.classList.add('active');
        modalReasonInput.focus();
    }

    function hideReasonModal() {
        reasonModal.classList.remove('active');
        currentUnblockUrl = null;
        modalReasonInput.value = '';
    }

    function showEditModal(url, currentDuration) {
        currentEditUrl = url;
        editModalUrl.textContent = url;
        editDurationSelect.value = currentDuration;
        editModal.classList.add('active');
    }

    function hideEditModal() {
        editModal.classList.remove('active');
        currentEditUrl = null;
    }

    // Reason Modal event handlers
    modalReasonInput.addEventListener('input', () => {
        const hasReason = modalReasonInput.value.trim().length >= 5;
        confirmUnblockBtn.disabled = !hasReason;
    });

    cancelBtn.addEventListener('click', () => {
        hideReasonModal();
        loadSites();
    });

    confirmUnblockBtn.addEventListener('click', async () => {
        const reason = modalReasonInput.value.trim();

        if (reason.length < 5) {
            alert('Please enter a reason (at least 5 characters)');
            return;
        }

        await chrome.runtime.sendMessage({
            action: 'unblockWithReason',
            url: currentUnblockUrl,
            reason: reason
        });

        hideReasonModal();
        loadSites();
    });

    // Edit Modal event handlers
    editCancelBtn.addEventListener('click', hideEditModal);

    editSaveBtn.addEventListener('click', async () => {
        const newDuration = parseInt(editDurationSelect.value);

        await chrome.runtime.sendMessage({
            action: 'updateDuration',
            url: currentEditUrl,
            duration: newDuration
        });

        hideEditModal();
        loadSites();
    });

    // Close modals on outside click
    reasonModal.addEventListener('click', (e) => {
        if (e.target === reasonModal) {
            hideReasonModal();
            loadSites();
        }
    });

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            hideEditModal();
        }
    });

    async function loadHistory() {
        const history = await chrome.runtime.sendMessage({ action: 'getUnblockHistory' });

        historyList.innerHTML = '';

        if (!history || history.length === 0) {
            emptyHistoryMessage.style.display = 'block';
            return;
        }

        emptyHistoryMessage.style.display = 'none';

        history.forEach(entry => {
            const li = document.createElement('li');
            const date = new Date(entry.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            li.innerHTML = `
                <div class="history-url">🔓 ${entry.url}</div>
                <div class="history-reason">"${entry.reason}"</div>
                <div class="history-time">${formattedDate}</div>
            `;
            historyList.appendChild(li);
        });
    }

    // Initial load
    loadSites();

    // Refresh every 30 seconds to update timers
    setInterval(loadSites, 30000);
});
