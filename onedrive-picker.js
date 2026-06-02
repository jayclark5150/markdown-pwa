// ══════════════════════════════════════════════════════════════════════════════
// OneDrive File Picker
// ══════════════════════════════════════════════════════════════════════════════
//
// Modal UI for browsing and selecting files from OneDrive.
// Used by "Open from OneDrive" and "Save to OneDrive as..." actions.
//

class OnedrivePicker {
  constructor() {
    this.currentFolderId = 'root';
    this.breadcrumbs = [{ id: 'root', name: 'OneDrive' }];
    this.items = [];
    this.selectedItem = null;
    this.mode = 'open'; // 'open' or 'save'
    this.initialFilename = '';
  }

  /**
   * Open the file picker modal in "open file" mode
   * @returns {Promise<Object>} - Selected file object { id, name } or null if cancelled
   */
  async pickFile() {
    this.mode = 'open';
    this.selectedItem = null;
    return this.show();
  }

  /**
   * Open the file picker modal in "save file" mode
   * @param {string} suggestedName - Default filename
   * @returns {Promise<Object>} - New file object { filename, parentFolderId } or null if cancelled
   */
  async pickSaveLocation(suggestedName = 'Untitled') {
    this.mode = 'save';
    this.selectedItem = null;
    this.initialFilename = suggestedName;
    return this.show();
  }

  /**
   * Show the modal and manage interaction
   */
  async show() {
    this.createModal();

    try {
      await this.loadFolder('root');
      return new Promise((resolve, reject) => {
        document.getElementById('onedrive-picker-confirm')
          .addEventListener('click', () => {
            this.cleanup();
            resolve(this.getResult());
          });

        document.getElementById('onedrive-picker-cancel')
          .addEventListener('click', () => {
            this.cleanup();
            resolve(null);
          });

        document.getElementById('onedrive-picker-backdrop')
          .addEventListener('click', (e) => {
            if (e.target.id === 'onedrive-picker-backdrop') {
              this.cleanup();
              resolve(null);
            }
          });
      });
    } catch (error) {
      this.cleanup();
      showToast(`OneDrive picker error: ${error.message}`, 5000);
      throw error;
    }
  }

  /**
   * Create the modal DOM
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'onedrive-picker-backdrop';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      ">
        <!-- Header -->
        <div style="
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h2 style="margin: 0; font-size: 1.25rem;">
            ${this.mode === 'open' ? 'Open from OneDrive' : 'Save to OneDrive'}
          </h2>
          <button
            id="onedrive-picker-close"
            style="
              background: none;
              border: none;
              font-size: 1.5rem;
              cursor: pointer;
              padding: 0;
              width: 2rem;
              height: 2rem;
              display: flex;
              align-items: center;
              justify-content: center;
            "
          >×</button>
        </div>

        <!-- Breadcrumbs -->
        <div id="onedrive-picker-breadcrumbs" style="
          padding: 0.5rem 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          background: #f9f9f9;
          font-size: 0.9rem;
          display: flex;
          gap: 0.5rem;
          align-items: center;
          overflow-x: auto;
        "></div>

        <!-- File list -->
        <div id="onedrive-picker-list" style="
          flex: 1;
          overflow-y: auto;
          border-bottom: 1px solid #e0e0e0;
        "></div>

        <!-- Save filename input (only in save mode) -->
        ${this.mode === 'save' ? `
          <div style="
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #e0e0e0;
            background: #f9f9f9;
          ">
            <label style="
              display: block;
              font-size: 0.9rem;
              margin-bottom: 0.5rem;
              color: #666;
            ">Filename:</label>
            <input
              id="onedrive-picker-filename"
              type="text"
              placeholder="document.md"
              style="
                width: 100%;
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: monospace;
                box-sizing: border-box;
              "
            />
          </div>
        ` : ''}

        <!-- Footer buttons -->
        <div style="
          padding: 1rem 1.5rem;
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        ">
          <button id="onedrive-picker-cancel" style="
            padding: 0.5rem 1.5rem;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
          ">Cancel</button>
          <button id="onedrive-picker-confirm" style="
            padding: 0.5rem 1.5rem;
            border: none;
            background: #0078d4;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
          ">
            ${this.mode === 'open' ? 'Open' : 'Save'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    document.getElementById('onedrive-picker-close')
      .addEventListener('click', () => {
        document.getElementById('onedrive-picker-confirm').click();
      });

    // In save mode, populate filename
    if (this.mode === 'save') {
      const filenameInput = document.getElementById('onedrive-picker-filename');
      filenameInput.value = this.initialFilename;
      filenameInput.select();
    }
  }

  /**
   * Load and display folder contents
   */
  async loadFolder(folderId) {
    const listEl = document.getElementById('onedrive-picker-list');
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding: 1rem; color: #666;">Loading...</div>';

    try {
      this.items = await window.onedriveClient.listFolder(folderId);
      this.currentFolderId = folderId;
      this.renderFileList();
      this.renderBreadcrumbs();
    } catch (error) {
      listEl.innerHTML = `<div style="padding: 1rem; color: #cf222e;">Error: ${error.message}</div>`;
    }
  }

  /**
   * Render file/folder list
   */
  renderFileList() {
    const listEl = document.getElementById('onedrive-picker-list');
    if (!listEl) return;

    if (this.items.length === 0) {
      listEl.innerHTML = '<div style="padding: 1rem; color: #999;">Empty folder</div>';
      return;
    }

    let html = '';
    for (const item of this.items) {
      const isSelected = this.selectedItem?.id === item.id;
      const isClickable = item.isFolder || this.mode === 'open';

      html += `
        <div
          class="onedrive-picker-item"
          data-item-id="${item.id}"
          data-is-folder="${item.isFolder}"
          style="
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: ${isClickable ? 'pointer' : 'default'};
            background: ${isSelected ? '#e7f3ff' : 'transparent'};
            transition: background 0.1s;
          "
        >
          <span style="font-size: 1.2rem;">
            ${item.isFolder ? '📁' : '📄'}
          </span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(item.name)}
            </div>
            <div style="font-size: 0.85rem; color: #999;">
              ${item.isFolder ? '' : this.formatFileSize(item.size)}
              ${item.lastModified ? ` • ${new Date(item.lastModified).toLocaleDateString()}` : ''}
            </div>
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Attach handlers
    const items = listEl.querySelectorAll('.onedrive-picker-item');
    items.forEach(el => {
      el.addEventListener('click', () => this.handleItemClick(el));
      el.addEventListener('dblclick', () => this.handleItemDoubleClick(el));
    });
  }

  /**
   * Render breadcrumb navigation
   */
  renderBreadcrumbs() {
    const breadEl = document.getElementById('onedrive-picker-breadcrumbs');
    if (!breadEl) return;

    let html = '';
    for (let i = 0; i < this.breadcrumbs.length; i++) {
      const crumb = this.breadcrumbs[i];
      const isLast = i === this.breadcrumbs.length - 1;

      if (i > 0) {
        html += '<span style="color: #999;">/</span>';
      }

      if (isLast) {
        html += `<span style="color: #333;">${this.escapeHtml(crumb.name)}</span>`;
      } else {
        html += `
          <button
            data-folder-id="${crumb.id}"
            style="
              background: none;
              border: none;
              color: #0078d4;
              cursor: pointer;
              padding: 0;
              font-size: inherit;
              text-decoration: underline;
            "
          >${this.escapeHtml(crumb.name)}</button>
        `;
      }
    }

    breadEl.innerHTML = html;

    // Breadcrumb handlers
    breadEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-folder-id');
        // Trim breadcrumbs to this point
        const idx = this.breadcrumbs.findIndex(c => c.id === targetId);
        this.breadcrumbs = this.breadcrumbs.slice(0, idx + 1);
        this.loadFolder(targetId);
      });
    });
  }

  /**
   * Handle single click (select item)
   */
  handleItemClick(el) {
    const itemId = el.getAttribute('data-item-id');
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    // In save mode, can't select folders
    if (this.mode === 'save' && item.isFolder) return;

    this.selectedItem = item;
    this.renderFileList(); // Update UI
  }

  /**
   * Handle double click (open folder or select file)
   */
  handleItemDoubleClick(el) {
    const itemId = el.getAttribute('data-item-id');
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    if (item.isFolder) {
      // Navigate into folder
      this.breadcrumbs.push({ id: item.id, name: item.name });
      this.loadFolder(item.id);
    } else if (this.mode === 'open') {
      // Select file and close
      this.selectedItem = item;
      document.getElementById('onedrive-picker-confirm').click();
    }
  }

  /**
   * Get the result based on mode
   */
  getResult() {
    if (!this.selectedItem) return null;

    if (this.mode === 'open') {
      return {
        id: this.selectedItem.id,
        name: this.selectedItem.name
      };
    } else {
      // save mode
      const filenameInput = document.getElementById('onedrive-picker-filename');
      const filename = filenameInput?.value?.trim() || 'Untitled.md';

      return {
        filename: filename,
        parentFolderId: this.currentFolderId
      };
    }
  }

  /**
   * Cleanup modal and event listeners
   */
  cleanup() {
    const modal = document.getElementById('onedrive-picker-backdrop');
    if (modal) modal.remove();
  }

  /**
   * Utility: escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export for use in app.js
window.OnedrivePicker = OnedrivePicker;
