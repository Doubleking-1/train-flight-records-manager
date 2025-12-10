/**
 * Cloud Sync Feature (Shared)
 * Syncs ALL data (Trains + Planes + Cache + Settings) to JSONBin.io
 */
class CloudSync {
    constructor() {
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.configKey = 'cloudSyncConfig';
        this.config = JSON.parse(localStorage.getItem(this.configKey)) || { apiKey: '', binId: '' };

        // UI Elements IDs (Must exist in the DOM)
        this.ui = {
            settingsBtn: 'cloudSettingsBtn',
            uploadBtn: 'cloudUploadBtn',
            downloadBtn: 'cloudDownloadBtn',
            modalOverlay: 'cloudSettingsModalOverlay',
            apiKeyInput: 'cloudApiKey',
            binIdInput: 'cloudBinId',
            saveBtn: 'cloudSettingsSaveBtn',
            cancelBtn: 'cloudSettingsCancelBtn'
        };

        this.initUI();
    }

    $(id) { return document.getElementById(id); }

    initUI() {
        const btnSettings = this.$(this.ui.settingsBtn);
        const btnUpload = this.$(this.ui.uploadBtn);
        const btnDownload = this.$(this.ui.downloadBtn);
        const btnSave = this.$(this.ui.saveBtn);
        const btnCancel = this.$(this.ui.cancelBtn);

        if (btnSettings) btnSettings.addEventListener('click', () => this.openSettings());
        if (btnUpload) btnUpload.addEventListener('click', () => this.uploadData());
        if (btnDownload) btnDownload.addEventListener('click', () => this.downloadData());
        if (btnSave) btnSave.addEventListener('click', () => this.saveSettings());
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeSettings());
    }

    openSettings() {
        const modal = this.$(this.ui.modalOverlay);
        const inputKey = this.$(this.ui.apiKeyInput);
        const inputBin = this.$(this.ui.binIdInput);

        if (inputKey) inputKey.value = this.config.apiKey || '';
        if (inputBin) inputBin.value = this.config.binId || '';
        if (modal) modal.style.display = 'flex';
    }

    closeSettings() {
        const modal = this.$(this.ui.modalOverlay);
        if (modal) modal.style.display = 'none';
    }

    saveSettings() {
        const inputKey = this.$(this.ui.apiKeyInput);
        const inputBin = this.$(this.ui.binIdInput);

        const apiKey = inputKey ? inputKey.value.trim() : '';
        const binId = inputBin ? inputBin.value.trim() : '';

        if (!apiKey) {
            alert('请输入 Master Key');
            return;
        }

        this.config = { apiKey, binId };
        localStorage.setItem(this.configKey, JSON.stringify(this.config));
        this.closeSettings();
        alert('配置已保存');
    }

    // Collect all data similar to "Backup All"
    getAllData() {
        return {
            backupDate: new Date().toISOString(),
            version: '2.0',
            trains: JSON.parse(localStorage.getItem('trainRecords') || '[]'),
            planes: JSON.parse(localStorage.getItem('planeRecords') || '[]'),
            geocodeCache: JSON.parse(localStorage.getItem('geocodeCache') || '{}'),
            settings: {
                theme: localStorage.getItem('theme') || 'light',
                sidebarCollapsed: localStorage.getItem('sidebarCollapsed')
            }
        };
    }

    // Restore all data
    restoreAllData(data) {
        if (!data || (!Array.isArray(data.trains) && !Array.isArray(data.planes))) {
            throw new Error('数据格式不正确');
        }

        localStorage.setItem('trainRecords', JSON.stringify(data.trains || []));
        localStorage.setItem('planeRecords', JSON.stringify(data.planes || []));

        if (data.geocodeCache) {
            localStorage.setItem('geocodeCache', JSON.stringify(data.geocodeCache));
        }

        if (data.settings) {
            if (data.settings.theme) localStorage.setItem('theme', data.settings.theme);
            if (data.settings.sidebarCollapsed) localStorage.setItem('sidebarCollapsed', data.settings.sidebarCollapsed);
        }
    }

    async uploadData() {
        if (!this.config.apiKey) {
            alert('请先配置 Cloud Sync (Master Key)');
            this.openSettings();
            return;
        }

        if (!confirm('确定要将 [全部数据] (火车+飞机+缓存) 上传到云端吗？\n这将覆盖云端已有的备份。')) return;

        const btn = this.$(this.ui.uploadBtn);
        const originalText = btn ? btn.textContent : '上传';
        if (btn) {
            btn.textContent = '⏳ 上传中...';
            btn.disabled = true;
        }

        try {
            const data = this.getAllData();

            let url = this.baseUrl;
            let method = 'POST';
            const headers = {
                'Content-Type': 'application/json',
                'X-Master-Key': this.config.apiKey,
                'X-Bin-Name': 'TravelRecords_FullBackup'
            };

            if (this.config.binId) {
                url = `${this.baseUrl}/${this.config.binId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (method === 'POST' && result.metadata && result.metadata.id) {
                this.config.binId = result.metadata.id;
                localStorage.setItem(this.configKey, JSON.stringify(this.config));
                alert(`上传成功！\n已自动保存 Bin ID: ${this.config.binId}`);
            } else {
                alert('上传成功！');
            }

        } catch (error) {
            console.error('Upload failed:', error);
            alert(`上传失败: ${error.message}`);
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }

    async downloadData() {
        if (!this.config.apiKey || !this.config.binId) {
            alert('请先配置 Cloud Sync (Master Key 和 Bin ID)');
            this.openSettings();
            return;
        }

        if (!confirm('确定要从云端恢复 [全部数据] 吗？\n这将覆盖本地所有的火车、飞机记录和设置！')) return;

        const btn = this.$(this.ui.downloadBtn);
        const originalText = btn ? btn.textContent : '下载';
        if (btn) {
            btn.textContent = '⏳ 下载中...';
            btn.disabled = true;
        }

        try {
            const url = `${this.baseUrl}/${this.config.binId}/latest`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Master-Key': this.config.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const cloudData = result.record;

            this.restoreAllData(cloudData);

            alert(`恢复成功！\n云端时间: ${cloudData.backupDate || '未知'}\n即将刷新页面...`);
            location.reload();

        } catch (error) {
            console.error('Download failed:', error);
            alert(`下载失败: ${error.message}`);
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    }
}
