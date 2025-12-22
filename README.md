# 🛡️ Reason Blocker

A Chrome extension that helps you stay focused by blocking distracting websites. When you need to unblock a site, you must provide a reason — creating accountability and mindful browsing habits.

## ✨ Features

- **Block Any Website** — Add domains to your blocklist with a single click
- **Timed Unblock** — Temporarily unblock sites (2 min to 1 hour)
- **Reason Tracking** — Must provide a reason before unblocking (accountability!)
- **Unblock History** — View all your past unblock reasons
- **Auto Re-block** — Sites automatically get blocked again after timer expires
- **Notifications** — Get notified when your unblock timer is about to expire

## 📥 Installation

### Method 1: Load as Unpacked Extension (Developer Mode)

1. **Download the extension**
   ```bash
   git clone https://github.com/yourusername/reason-blocker.git
   ```
   Or download and extract the ZIP file.

2. **Open Chrome Extensions page**
   - Go to `chrome://extensions/` in your browser
   - Or click Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `reason-blocker` folder

5. **Pin the extension** (optional)
   - Click the puzzle icon in the toolbar
   - Click the pin icon next to "Reason Blocker"

## 🚀 How to Use

### Adding a Site to Block

1. Click on the Reason Blocker icon in your toolbar
2. Enter the domain you want to block (e.g., `youtube.com`, `twitter.com`)
3. Set the default unblock duration (how long you can access the site when unblocking)
4. Click **+ Add**

### When You Visit a Blocked Site

When you try to visit a blocked site, you'll see a "Site Blocked" page with:
- A text area to enter your reason for unblocking
- An "Unblock & Continue" button (enabled only after entering a reason)
- A "Go Back" button to stay focused

### Unblocking from the Popup

1. Click the Reason Blocker icon
2. Find the site in "My Sites" tab
3. Click the **🔓** unlock button
4. Enter your reason for unblocking
5. Click **Unblock**

The site will be accessible for the set duration, then automatically blocked again.

### Managing Your Sites

| Action | How to Do It |
|--------|--------------|
| **Edit duration** | Click the ⏱️ button next to a site |
| **Delete a site** | Click the 🗑️ button next to a site |
| **View history** | Click the "Unblock History" tab |

### Viewing Unblock History

Switch to the "Unblock History" tab to see:
- Which sites you unblocked
- When you unblocked them
- The reason you provided

## 🔒 Privacy

- **100% Local** — All data is stored locally in your browser
- **No Analytics** — Zero tracking or data collection
- **No Server** — The extension works completely offline

## 📁 Project Structure

```
reason-blocker/
├── manifest.json        # Extension configuration
├── background/
│   └── background.js    # Service worker for blocking logic
├── popup/
│   ├── popup.html       # Extension popup UI
│   ├── popup.css        # Popup styles
│   └── popup.js         # Popup logic
├── blocked/
│   ├── blocked.html     # Blocked site page
│   ├── blocked.css      # Blocked page styles
│   └── blocked.js       # Blocked page logic
├── database/
│   └── db.js            # Local storage operations
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🛠️ Permissions Used

| Permission | Why It's Needed |
|------------|-----------------|
| `storage` | Save your blocked sites and history locally |
| `tabs` | Detect when you visit a blocked site |
| `webNavigation` | Redirect blocked sites to the blocked page |
| `declarativeNetRequest` | Block website requests |
| `notifications` | Alert you when unblock timer is expiring |
| `alarms` | Schedule re-blocking after timer expires |

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📄 License

MIT License — feel free to use and modify as you like.

---

**Stay focused. Stay productive. 🚀**
