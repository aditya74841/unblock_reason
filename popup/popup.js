// Popup Script for Site Blocker Extension

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const durationSelect = document.getElementById('durationSelect');
    const addBtn = document.getElementById('addBtn');
    const sitesList = document.getElementById('sitesList');
    const historyList = document.getElementById('historyList');
    const historyGroups = document.getElementById('historyGroups');
    const emptyMessage = document.getElementById('emptyMessage');
    const emptyHistoryMessage = document.getElementById('emptyHistoryMessage');
    const tabs = document.querySelectorAll('.tab');

    // Stats Dashboard elements
    const statTotal = document.getElementById('statTotal');
    const statAvg = document.getElementById('statAvg');
    const statStreak = document.getElementById('statStreak');
    const statMostUnblocked = document.getElementById('statMostUnblocked');

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

    // Reflection Modal elements
    const reflectionModal = document.getElementById('reflectionModal');
    const reflectionMessage = document.getElementById('reflectionMessage');
    const reflectionOkBtn = document.getElementById('reflectionOkBtn');

    // Suggestion elements
    const quickBlockSuggestion = document.getElementById('quickBlockSuggestion');
    const suggestionBtn = document.getElementById('suggestionBtn');

    let currentUnblockUrl = null;
    let currentEditUrl = null;
    let reflectionShownThisSession = false;

    // Initialize quick block suggestion
    initQuickBlock();

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

        await performAddSite(url);
    }

    async function performAddSite(url) {
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
            quickBlockSuggestion.style.display = 'none';
            loadSites();
        } else {
            alert('Site already exists or error occurred');
        }
    }

    async function initQuickBlock() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url) return;

            const url = new URL(tab.url);

            // Don't suggest extension pages, chrome internal pages, or blank pages
            if (url.protocol.startsWith('chrome') || url.protocol === 'about:' || !url.hostname) {
                return;
            }

            const cleanDomain = url.hostname.replace('www.', '');

            // Check if site is already in the list
            const sites = await chrome.runtime.sendMessage({ action: 'getAllSites' });
            const alreadyExists = sites.some(s => s.url === cleanDomain);

            if (!alreadyExists) {
                suggestionBtn.textContent = `Block ${cleanDomain}?`;
                quickBlockSuggestion.style.display = 'flex';

                suggestionBtn.onclick = () => {
                    urlInput.value = cleanDomain;
                    performAddSite(cleanDomain);
                };
            }
        } catch (error) {
            console.error('Error initializing quick block:', error);
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
        const [history, stats] = await Promise.all([
            chrome.runtime.sendMessage({ action: 'getUnblockHistory' }),
            chrome.runtime.sendMessage({ action: 'getHistoryStats' })
        ]);

        historyGroups.innerHTML = '';

        if (!history || history.length === 0) {
            emptyHistoryMessage.style.display = 'block';
            document.getElementById('statsDashboard').style.display = 'none';
            return;
        }

        emptyHistoryMessage.style.display = 'none';
        document.getElementById('statsDashboard').style.display = 'block';

        // Update Stats Dashboard
        statTotal.textContent = stats.totalThisWeek;
        statAvg.textContent = stats.avgPerDay;
        statStreak.textContent = stats.streak > 0 ? `${stats.streak}🔥` : '0';

        if (stats.mostUnblocked.url && stats.mostUnblocked.count > 1) {
            statMostUnblocked.innerHTML = `⚠️ Most unblocked: <strong>${stats.mostUnblocked.url}</strong> (${stats.mostUnblocked.count}x)`;
        } else {
            statMostUnblocked.innerHTML = '';
        }

        // Show reflection modal if 5+ unblocks today
        if (stats.totalToday >= 5 && !reflectionShownThisSession) {
            reflectionShownThisSession = true;
            reflectionMessage.textContent = `You've unblocked ${stats.totalToday} sites today. Are you staying focused on what matters?`;
            reflectionModal.classList.add('active');
        }

        // Group history by date
        const groups = groupByDate(history);

        // Count per URL for repeat detection
        const urlCounts = {};
        history.forEach(e => {
            urlCounts[e.url] = (urlCounts[e.url] || 0) + 1;
        });

        // Render grouped history
        Object.entries(groups).forEach(([dateLabel, entries]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'history-date-group';

            const headerHtml = `
                <div class="date-header">
                    <span class="date-icon">📅</span>
                    <span>${dateLabel}</span>
                    <span class="unblock-count">${entries.length} unblock${entries.length > 1 ? 's' : ''}</span>
                </div>
            `;

            let entriesHtml = '';
            entries.forEach(entry => {
                const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const reasonClass = classifyReason(entry.reason);
                const isRepeat = urlCounts[entry.url] > 2;

                let badges = '';
                if (isRepeat) {
                    badges += `<span class="badge badge-repeat">🔥 ${urlCounts[entry.url]}x</span>`;
                }
                if (entry.wasAutoReblocked === true) {
                    badges += '<span class="badge badge-auto">⏱️ Auto</span>';
                } else if (entry.wasAutoReblocked === false) {
                    badges += '<span class="badge badge-manual">✋ Manual</span>';
                }

                entriesHtml += `
                    <div class="history-entry ${reasonClass}">
                        <div class="history-entry-header">
                            <span class="history-entry-url">🔓 ${entry.url}</span>
                            <div class="history-entry-badges">${badges}</div>
                        </div>
                        <div class="history-entry-reason">"${entry.reason}"</div>
                        <div class="history-entry-meta">
                            <span>${time}</span>
                            ${entry.unblockDuration ? `<span>⏱️ ${entry.unblockDuration} min allowed</span>` : ''}
                        </div>
                    </div>
                `;
            });

            groupDiv.innerHTML = headerHtml + entriesHtml;
            historyGroups.appendChild(groupDiv);
        });
    }

    // Group entries by date (Today, Yesterday, This Week, Older)
    function groupByDate(entries) {
        const groups = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        entries.forEach(entry => {
            const entryDate = new Date(entry.timestamp);
            const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

            let label;
            if (entryDay.getTime() === today.getTime()) {
                label = 'Today';
            } else if (entryDay.getTime() === yesterday.getTime()) {
                label = 'Yesterday';
            } else if (entryDay >= weekAgo) {
                label = 'This Week';
            } else {
                label = 'Older';
            }

            if (!groups[label]) {
                groups[label] = [];
            }
            groups[label].push(entry);
        });

        // Sort within each group by timestamp (newest first)
        Object.values(groups).forEach(group => {
            group.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        });

        // Return groups in order
        const orderedGroups = {};
        ['Today', 'Yesterday', 'This Week', 'Older'].forEach(label => {
            if (groups[label]) {
                orderedGroups[label] = groups[label];
            }
        });

        return orderedGroups;
    }

    // Classify reason quality (green/yellow/red)
    function classifyReason(reason) {
        const r = reason.toLowerCase();

        // Productive keywords
        const productiveKeywords = ['work', 'project', 'meeting', 'urgent', 'deadline', 'client', 'research', 'tutorial', 'learn', 'study'];
        if (productiveKeywords.some(kw => r.includes(kw))) {
            return 'reason-productive';
        }

        // Weak/vague reasons
        const weakKeywords = ['bored', 'just', 'quick', 'check', 'nothing', 'idk', 'why not', 'break'];
        if (weakKeywords.some(kw => r.includes(kw)) || r.length < 10) {
            return 'reason-weak';
        }

        return 'reason-neutral';
    }

    // Reflection modal handler
    reflectionOkBtn.addEventListener('click', () => {
        reflectionModal.classList.remove('active');
    });

    reflectionModal.addEventListener('click', (e) => {
        if (e.target === reflectionModal) {
            reflectionModal.classList.remove('active');
        }
    });

    // Initial load
    loadSites();

    // Refresh every 30 seconds to update timers
    setInterval(loadSites, 30000);
});

