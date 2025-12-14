# 🚀 NotebookLM Saver

> **Supercharge your research.** Instantly copy, save, and export notes from Google NotebookLM with formatting preserved. 100% Offline & Private.

![Version](https://img.shields.io/badge/version-3.0.1-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

**NotebookLM Saver** is a Chrome Extension designed to bridge the gap between Google's AI notebook and your local workflow. It injects a smart "Copy Note" button directly into the NotebookLM interface, allowing you to save insights to a local history vault, export them to PDF/Word, and paste them into other apps without losing bolding, headers, or lists.

---

## ✨ Key Features

* **Smart Injection**: Automatically detects the NotebookLM footer and injects a seamless "Copy Note" button that fits the native UI design.
* **Rich Text Copying**: Copies notes to your clipboard in both **HTML** (for Word/Docs) and **Plain Text** (for Notepad/Markdown) simultaneously.
* **Local History Vault**: Every copied note is saved to `chrome.storage.local`. It stores up to **500 items** with deduplication logic to prevent clutter.
* **Robust Selectors**: Uses a "waterfall" of CSS selectors to find note titles and content, ensuring the extension keeps working even if Google changes the website's code.
* **Export Options**:
    * 📄 **PDF**: Generates a clean, printable view for saving as PDF.
    * 📝 **DOC**: Exports the note as a `.doc` file compatible with Microsoft Word.
* **Search & Organize**: A popup dashboard lets you search through your saved history by title or content.

---

## 🛠 Installation (Developer Mode)

Since this project is open-source, you can install it manually in your browser:

1.  **Download the Code**: Clone this repository or download the ZIP.
    ```bash
    git clone [https://github.com/your-username/notebooklm-saver.git](https://github.com/your-username/notebooklm-saver.git)
    ```
2.  **Open Extensions**: In Chrome, go to `chrome://extensions/`.
3.  **Enable Developer Mode**: Toggle the switch in the top-right corner.
4.  **Load Unpacked**: Click the button and select the folder containing `manifest.json`.
5.  **Pin It**: Pin the extension icon to your toolbar for easy access.

---

## 📖 Usage Guide

1.  **Open NotebookLM**: Navigate to [notebooklm.google.com](https://notebooklm.google.com) and open any notebook.
2.  **Copy a Note**: You will see a new **"Copy Note"** button near the bottom of the note editor. Click it!
    * *Feedback*: The button will change to "Copied" and a toast notification will appear.
3.  **View History**: Click the extension icon in your browser toolbar to see the **Popup Dashboard**.
    * Here you can see your recent notes, search them, or copy them again.
4.  **Full View & Export**: Click the "Open" icon next to any note in the popup to enter **Reader Mode**.
    * Use the toolbar to **Download PDF** or **Download .doc**.

---

## 🏗 Project Structure

* **`manifest.json`**: The configuration file. Defines permissions (`storage`, `clipboardWrite`) and scripts.
* **`content_script.js`**: The logic that runs on `notebooklm.google.com`.
    * *Key Function*: `injectButton()` adds the UI element.
    * *Key Function*: `findContent()` scrapes the text using multiple fallback selectors.
* **`background.js`**: A service worker that handles opening the full-page "View" tab.
* **`popup.js` / `.html`**: The small window that appears when clicking the extension icon. Handles the search and list rendering.
* **`view.js` / `.html`**: The full-page read mode. Contains the logic for generating blobs for file downloads.

---

## 🔒 Privacy & Permissions

This extension is built with a **Local-First** philosophy.

* **`storage`**: Used solely to save your note history on your own device (`chrome.storage.local`). No data is sent to the cloud.
* **`clipboardWrite`**: Required to place the rich text content into your system clipboard.
* **`scripting`**: Used to inject the button and scrape the specific note text when you ask for it.
* **Host Permissions**: The extension is strictly scoped to run only on `notebooklm.google.com` (Note: Ensure your `manifest.json` reflects this for security).

---

## 🤝 Contributing

Contributions are welcome! If you find a bug or want to add a feature (like Markdown export):

1.  Fork the Project.
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the Branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Disclaimer: This project is an independent open-source extension and is not affiliated with, endorsed by, or connected to Google or NotebookLM.*
