import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import DOMPurify from 'dompurify';
import {
  createIcons,
  Zap,
  Sparkles,
  RefreshCw,
  Settings,
  Search,
  Trash2,
  Trash,
  Send,
  Copy,
  Key,
  ExternalLink,
  MailOpen,
  Mail,
  Reply,
  Paperclip,
  Sliders,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  Wallet,
  Globe,
  Clock,
  Inbox,
  AlertCircle,
  ShieldCheck,
  Moon,
  Sun,
  Command,
  Volume2,
  VolumeX,
  Layout,
  FileText,
  Code,
  Plus,
  Droplet,
  Tag,
  Download,
  Link,
  ClipboardList,
  ChevronLeft,
  Maximize2,
  Minimize2,
  PanelLeft
} from 'lucide';

interface DomainInfo {
  name: string;
  isShared?: boolean;
}

interface EmailAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface EmailSummary {
  uid: number;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number;
  isRead: boolean;
  bodyPlain: string;
  bodyHtml: string;
  snippet: string;
  attachments: EmailAttachment[];
}

interface DisposableInbox {
  id: string;
  email: string;
  username: string;
  domain: string;
  password: string;
  tag?: string;
  createdAt: number;
  unreadCount: number;
  emails: EmailSummary[];
}

interface AppSettings {
  apiToken: string;
  selectedDomain: string;
  customPrefix: string;
  syncIntervalSec: number;
  soundEnabled: boolean;
  emailCanvasDark: boolean;
}

interface GeneratedCredentials {
  username: string;
  domain: string;
  email: string;
  password: string;
}

// State
let inboxes: DisposableInbox[] = [];
let activeInboxId: string | null = null;
let selectedEmailUid: number | null = null;
let availableDomains: DomainInfo[] = [];
let activeMessageFilter: 'all' | 'unread' | 'otp' = 'all';

let appSettings: AppSettings = {
  apiToken: '',
  selectedDomain: '',
  customPrefix: '',
  syncIntervalSec: 10,
  soundEnabled: true,
  emailCanvasDark: true,
};

let syncIntervalTimer: number | null = null;
let countdownTimer: number | null = null;
let secondsUntilNextSync = 10;
let isSyncing = false;

// DOM Elements
const domainSelect = document.getElementById('domain-select') as HTMLSelectElement;
const creditBadge = document.getElementById('credit-badge') as HTMLElement;
const creditAmount = document.getElementById('credit-amount') as HTMLElement;
const headerStatus = document.getElementById('header-status') as HTMLElement;
const btnGenerateEmail = document.getElementById('btn-generate-email') as HTMLButtonElement;
const btnSyncNow = document.getElementById('btn-sync-now') as HTMLButtonElement;
const syncIcon = document.getElementById('sync-icon') as HTMLElement;
const btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const btnSaveSettings = document.getElementById('btn-save-settings') as HTMLButtonElement;
const modalSettings = document.getElementById('modal-settings') as HTMLElement;
const settingApiToken = document.getElementById('setting-api-token') as HTMLInputElement;
const btnToggleTokenVisibility = document.getElementById('btn-toggle-token-visibility') as HTMLButtonElement;
const settingCustomPrefix = document.getElementById('setting-custom-prefix') as HTMLInputElement;
const settingSyncInterval = document.getElementById('setting-sync-interval') as HTMLSelectElement;
const btnTestConnection = document.getElementById('btn-test-connection') as HTMLButtonElement;
const connectionTestResult = document.getElementById('connection-test-result') as HTMLElement;
const btnToggleSound = document.getElementById('btn-toggle-sound') as HTMLButtonElement;
const soundIcon = document.getElementById('sound-icon') as HTMLElement;

const inboxesCountBadge = document.getElementById('inboxes-count') as HTMLElement;
const searchInboxesInput = document.getElementById('search-inboxes') as HTMLInputElement;
const inboxListContainer = document.getElementById('inbox-list') as HTMLElement;
const btnClearAllInboxes = document.getElementById('btn-clear-all-inboxes') as HTMLButtonElement;

const messagesCountBadge = document.getElementById('messages-count-badge') as HTMLElement;
const autoSyncTimer = document.getElementById('auto-sync-timer') as HTMLElement;
const activeAccountBar = document.getElementById('active-account-bar') as HTMLElement;
const activeEmailDisplay = document.getElementById('active-email-display') as HTMLElement;
const activeInboxTagInput = document.getElementById('active-inbox-tag-input') as HTMLInputElement;
const btnCopyActiveEmail = document.getElementById('btn-copy-active-email') as HTMLButtonElement;
const btnCopyActivePwd = document.getElementById('btn-copy-active-pwd') as HTMLButtonElement;
const btnCopyFullCreds = document.getElementById('btn-copy-full-creds') as HTMLButtonElement;
const btnOpenWebmail = document.getElementById('btn-open-webmail') as HTMLButtonElement;
const btnDeleteActiveInbox = document.getElementById('btn-delete-active-inbox') as HTMLButtonElement;
const searchMessagesInput = document.getElementById('search-messages') as HTMLInputElement;
const messagesListContainer = document.getElementById('messages-list') as HTMLElement;

// Filter Chips
const filterAll = document.getElementById('filter-all') as HTMLButtonElement;
const filterUnread = document.getElementById('filter-unread') as HTMLButtonElement;
const filterOtp = document.getElementById('filter-otp') as HTMLButtonElement;

const emailDetailEmpty = document.getElementById('email-detail-empty') as HTMLElement;
const emailDetailContainer = document.getElementById('email-detail-container') as HTMLElement;
const emailDetailSubject = document.getElementById('email-detail-subject') as HTMLElement;
const emailSenderAvatar = document.getElementById('email-sender-avatar') as HTMLElement;
const emailDetailFrom = document.getElementById('email-detail-from') as HTMLElement;
const emailDetailDate = document.getElementById('email-detail-date') as HTMLElement;
const emailDetailTo = document.getElementById('email-detail-to') as HTMLElement;
const btnReplyEmail = document.getElementById('btn-reply-email') as HTMLButtonElement;
const btnDeleteEmail = document.getElementById('btn-delete-email') as HTMLButtonElement;
const btnExportEml = document.getElementById('btn-export-eml') as HTMLButtonElement;
const btnToggleEmailTheme = document.getElementById('btn-toggle-email-theme') as HTMLButtonElement;
const themeToggleIcon = document.getElementById('theme-toggle-icon') as HTMLElement;
const themeToggleText = document.getElementById('theme-toggle-text') as HTMLElement;

const btnToggleSidebar = document.getElementById('btn-toggle-sidebar') as HTMLButtonElement;
const btnToggleExpandReader = document.getElementById('btn-toggle-expand-reader') as HTMLButtonElement;
const btnRestoreColumns = document.getElementById('btn-restore-columns') as HTMLButtonElement;
const expandIcon = document.getElementById('expand-icon') as HTMLElement;
const expandBtnText = document.getElementById('expand-btn-text') as HTMLElement;
const workspace = document.getElementById('workspace') as HTMLElement;

let isReaderExpanded = false;
let isSidebarCollapsed = false;

function toggleReaderExpand(force?: boolean) {
  isReaderExpanded = force !== undefined ? force : !isReaderExpanded;
  if (isReaderExpanded) {
    workspace.classList.add('reading-expanded');
    btnRestoreColumns.classList.remove('hidden');
    expandIcon.setAttribute('data-lucide', 'minimize-2');
    if (expandBtnText) expandBtnText.textContent = 'Exit Full View';
  } else {
    workspace.classList.remove('reading-expanded');
    btnRestoreColumns.classList.add('hidden');
    expandIcon.setAttribute('data-lucide', 'maximize-2');
    if (expandBtnText) expandBtnText.textContent = 'Full View';
  }
  initIcons();
}

function toggleSidebar(force?: boolean) {
  isSidebarCollapsed = force !== undefined ? force : !isSidebarCollapsed;
  if (isSidebarCollapsed) {
    workspace.classList.add('sidebar-hidden');
  } else {
    workspace.classList.remove('sidebar-hidden');
  }
}

const otpHighlightBanner = document.getElementById('otp-highlight-banner') as HTMLElement;
const otpCodeValue = document.getElementById('otp-code-value') as HTMLElement;
const btnCopyOtp = document.getElementById('btn-copy-otp') as HTMLButtonElement;

const linkHighlightBanner = document.getElementById('link-highlight-banner') as HTMLElement;
const linkUrlPreview = document.getElementById('link-url-preview') as HTMLElement;
const btnOpenDetectedLink = document.getElementById('btn-open-detected-link') as HTMLButtonElement;

const tabRenderedHtml = document.getElementById('tab-rendered-html') as HTMLButtonElement;
const tabPlainText = document.getElementById('tab-plain-text') as HTMLButtonElement;
const tabRawHeaders = document.getElementById('tab-raw-headers') as HTMLButtonElement;
const viewRenderedHtml = document.getElementById('view-rendered-html') as HTMLElement;
const viewPlainText = document.getElementById('view-plain-text') as HTMLElement;
const viewRawHeaders = document.getElementById('view-raw-headers') as HTMLElement;
const emailHtmlFrame = document.getElementById('email-html-frame') as HTMLIFrameElement;
const emailPlainContent = document.getElementById('email-plain-content') as HTMLElement;
const emailHeadersContent = document.getElementById('email-headers-content') as HTMLElement;
const attachmentsContainer = document.getElementById('attachments-container') as HTMLElement;
const attachmentsList = document.getElementById('attachments-list') as HTMLElement;

const btnComposeMail = document.getElementById('btn-compose-mail') as HTMLButtonElement;
const modalCompose = document.getElementById('modal-compose') as HTMLElement;
const btnCloseCompose = document.getElementById('btn-close-compose') as HTMLButtonElement;
const btnCancelCompose = document.getElementById('btn-cancel-compose') as HTMLButtonElement;
const composeForm = document.getElementById('compose-form') as HTMLFormElement;
const composeFromInput = document.getElementById('compose-from') as HTMLInputElement;
const composeToInput = document.getElementById('compose-to') as HTMLInputElement;
const composeSubjectInput = document.getElementById('compose-subject') as HTMLInputElement;
const composeBodyInput = document.getElementById('compose-body') as HTMLTextAreaElement;
const btnSendEmailSubmit = document.getElementById('btn-send-email-submit') as HTMLButtonElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;

// Confirmation Modal Elements
const modalConfirm = document.getElementById('modal-confirm') as HTMLElement;
const confirmModalTitle = document.getElementById('confirm-modal-title') as HTMLElement;
const confirmModalMessage = document.getElementById('confirm-modal-message') as HTMLElement;
const confirmModalBtnText = document.getElementById('confirm-modal-btn-text') as HTMLElement;
const btnActionConfirm = document.getElementById('btn-action-confirm') as HTMLButtonElement;
const btnCancelConfirm = document.getElementById('btn-cancel-confirm') as HTMLButtonElement;
const btnCloseConfirm = document.getElementById('btn-close-confirm') as HTMLButtonElement;

// Shortcuts Modal Elements
const modalShortcuts = document.getElementById('modal-shortcuts') as HTMLElement;
const btnOpenShortcuts = document.getElementById('btn-open-shortcuts') as HTMLButtonElement;
const btnCloseShortcuts = document.getElementById('btn-close-shortcuts') as HTMLButtonElement;
const btnDismissShortcuts = document.getElementById('btn-dismiss-shortcuts') as HTMLButtonElement;

let confirmResolver: ((val: boolean) => void) | null = null;
let detectedLinkUrl: string | null = null;

// Sound Synthesizer via Web Audio API
function playChime(type: 'receive' | 'copy' | 'create' = 'receive') {
  if (!appSettings.soundEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;

    if (type === 'receive') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880.0, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now + 0.12);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.4);
    } else if (type === 'create') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'copy') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (err) {
    // AudioContext blocked before first gesture
  }
}

// Smart OTP / Verification Code Extractor
function extractOtpCode(subject: string, body: string): string | null {
  const text = `${subject} ${body}`;
  const patterns = [
    /(?:verification|security|confirm|auth|login|one-time|otp|code|pin)(?:\s+is|\s*:\s*|\s+code\s+is|\s+)(\b\d{4,8}\b)/i,
    /(?:enter|use)\s+(\b\d{4,8}\b)\s+(?:to|as|for|to verify)/i,
    /\b(\d{6})\b/,
    /\b(\d{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Primary Confirmation / Activation Link Extractor
function extractPrimaryLink(bodyHtml: string, bodyPlain: string): string | null {
  // Check HTML for <a> tags with verify / confirm keywords
  if (bodyHtml) {
    const linkMatches = Array.from(bodyHtml.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi));
    for (const match of linkMatches) {
      const href = match[1];
      const anchorText = match[2].toLowerCase();
      if (
        href.startsWith('http') &&
        (anchorText.includes('verify') ||
          anchorText.includes('confirm') ||
          anchorText.includes('activate') ||
          anchorText.includes('login') ||
          anchorText.includes('click here') ||
          anchorText.includes('authenticate') ||
          href.includes('verify') ||
          href.includes('confirm') ||
          href.includes('token='))
      ) {
        return href;
      }
    }
  }

  // Check Plain text URLs
  const urlMatches = bodyPlain.match(/https?:\/\/[^\s<>"')]+/gi);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (
        url.includes('verify') ||
        url.includes('confirm') ||
        url.includes('activate') ||
        url.includes('token=') ||
        url.includes('auth')
      ) {
        return url;
      }
    }
    // Return first link if only 1-2 links exist
    if (urlMatches.length <= 2) {
      return urlMatches[0];
    }
  }

  return null;
}

function showConfirmDialog(
  title: string,
  message: string,
  btnText = 'Confirm',
  isDanger = true
): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalBtnText.textContent = btnText;
    if (isDanger) {
      btnActionConfirm.className = 'btn btn-primary btn-sm text-danger';
    } else {
      btnActionConfirm.className = 'btn btn-primary btn-sm';
    }
    modalConfirm.classList.remove('hidden');
    initIcons();
  });
}

function closeConfirmDialog(result: boolean) {
  modalConfirm.classList.add('hidden');
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function initIcons() {
  createIcons({
    icons: {
      Zap,
      Sparkles,
      RefreshCw,
      Settings,
      Search,
      Trash2,
      Trash,
      Send,
      Copy,
      Key,
      ExternalLink,
      MailOpen,
      Mail,
      Reply,
      Paperclip,
      Sliders,
      Eye,
      EyeOff,
      CheckCircle2,
      Save,
      Wallet,
      Globe,
      Clock,
      Inbox,
      AlertCircle,
      ShieldCheck,
      Moon,
      Sun,
      Command,
      Volume2,
      VolumeX,
      Layout,
      FileText,
      Code,
      Plus,
      Droplet,
      Tag,
      Download,
      Link,
      ClipboardList,
      ChevronLeft,
      Maximize2,
      Minimize2,
      PanelLeft
    }
  });
}

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

function formatRelativeTime(timestampMs: number): string {
  const diffSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function saveState() {
  localStorage.setItem('tempmail_inboxes', JSON.stringify(inboxes));
  localStorage.setItem('tempmail_active_inbox_id', activeInboxId || '');
  localStorage.setItem('tempmail_settings', JSON.stringify(appSettings));
}

function loadState() {
  try {
    const savedInboxes = localStorage.getItem('tempmail_inboxes');
    if (savedInboxes) inboxes = JSON.parse(savedInboxes);
    const savedActiveId = localStorage.getItem('tempmail_active_inbox_id');
    if (savedActiveId && inboxes.some((i) => i.id === savedActiveId)) {
      activeInboxId = savedActiveId;
    } else if (inboxes.length > 0) {
      activeInboxId = inboxes[0].id;
    }
    const savedSettings = localStorage.getItem('tempmail_settings');
    if (savedSettings) {
      appSettings = { ...appSettings, ...JSON.parse(savedSettings) };
    }
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

async function loadCredit() {
  if (!appSettings.apiToken) return;
  try {
    const credit = await invoke<string>('purelymail_check_credit', {
      apiToken: appSettings.apiToken,
    });
    creditBadge.classList.remove('hidden');
    const num = parseFloat(credit);
    creditAmount.textContent = isNaN(num) ? credit : `$${num.toFixed(2)}`;
  } catch (err) {
    console.warn('Failed to load credit:', err);
  }
}

async function loadDomains(showAlert = false): Promise<boolean> {
  if (!appSettings.apiToken) {
    domainSelect.innerHTML = '<option value="">(No API Key Set)</option>';
    return false;
  }

  try {
    const domains = await invoke<DomainInfo[]>('purelymail_list_domains', {
      apiToken: appSettings.apiToken,
      includeShared: false,
    });

    availableDomains = domains;
    domainSelect.innerHTML = '';

    if (domains.length === 0) {
      domainSelect.innerHTML = '<option value="">No domains found</option>';
      if (showAlert) showToast('No domains found under this Purelymail account', 'error');
      return false;
    }

    domains.forEach((dom) => {
      const opt = document.createElement('option');
      opt.value = dom.name;
      opt.textContent = dom.name;
      if (dom.name === appSettings.selectedDomain) opt.selected = true;
      domainSelect.appendChild(opt);
    });

    if (!appSettings.selectedDomain || !domains.some((d) => d.name === appSettings.selectedDomain)) {
      appSettings.selectedDomain = domains[0].name;
      domainSelect.value = domains[0].name;
      saveState();
    }

    loadCredit();
    if (showAlert) showToast(`Loaded ${domains.length} domain(s)!`, 'success');
    return true;
  } catch (err) {
    console.error('Failed to load domains:', err);
    domainSelect.innerHTML = '<option value="">Failed to load domains</option>';
    if (showAlert) showToast(`API Error: ${err}`, 'error');
    return false;
  }
}

function renderInboxesList() {
  const searchTerm = searchInboxesInput.value.toLowerCase().trim();
  const filtered = inboxes.filter((i) => {
    const matchesEmail = i.email.toLowerCase().includes(searchTerm);
    const matchesTag = i.tag ? i.tag.toLowerCase().includes(searchTerm) : false;
    return matchesEmail || matchesTag;
  });

  inboxesCountBadge.textContent = `${inboxes.length}`;
  inboxListContainer.innerHTML = '';

  if (filtered.length === 0) {
    inboxListContainer.innerHTML = `
      <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-dim); font-size: 0.76rem;">
        ${inboxes.length === 0 ? 'No mailboxes yet.<br/>Click <b>New Disposable</b> to create one.' : 'No matching inboxes.'}
      </div>
    `;
    return;
  }

  filtered.forEach((inbox) => {
    const card = document.createElement('div');
    card.className = `mailbox-card ${inbox.id === activeInboxId ? 'active' : ''}`;
    card.onclick = () => selectInbox(inbox.id);

    card.innerHTML = `
      <div class="mailbox-card-header">
        <span class="mailbox-email" title="${inbox.email}">${inbox.email}</span>
        ${inbox.unreadCount > 0 ? `<span class="mailbox-badge">${inbox.unreadCount}</span>` : ''}
      </div>
      ${inbox.tag ? `<div class="mailbox-card-tag"><i data-lucide="tag" class="xs-icon"></i><span>${inbox.tag}</span></div>` : ''}
      <div class="mailbox-card-meta">
        <span class="mailbox-time">
          <i data-lucide="clock" class="xs-icon"></i>
          <span>${formatRelativeTime(inbox.createdAt)}</span>
        </span>
        <div class="mailbox-actions">
          <button class="btn-card-action" title="Copy Address" data-action="copy-email" data-id="${inbox.id}">
            <i data-lucide="copy" class="xs-icon"></i>
          </button>
          <button class="btn-card-action" title="Copy Password" data-action="copy-pwd" data-id="${inbox.id}">
            <i data-lucide="key" class="xs-icon"></i>
          </button>
          <button class="btn-card-action text-danger" title="Delete from Server" data-action="delete" data-id="${inbox.id}">
            <i data-lucide="trash" class="xs-icon"></i>
          </button>
        </div>
      </div>
    `;

    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        const targetInbox = inboxes.find((i) => i.id === inbox.id);
        if (!targetInbox) return;

        if (action === 'copy-email') {
          navigator.clipboard.writeText(targetInbox.email);
          playChime('copy');
          showToast(`Copied ${targetInbox.email}`, 'success');
        } else if (action === 'copy-pwd') {
          navigator.clipboard.writeText(targetInbox.password);
          playChime('copy');
          showToast('Copied inbox password!', 'success');
        } else if (action === 'delete') {
          deleteInbox(targetInbox);
        }
      });
    });

    inboxListContainer.appendChild(card);
  });

  initIcons();
}

function selectInbox(inboxId: string) {
  activeInboxId = inboxId;
  selectedEmailUid = null;
  saveState();
  renderInboxesList();
  renderActiveAccountBar();
  renderMessagesList();
  renderEmailDetail();
  syncActiveInbox();
}

function renderActiveAccountBar() {
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox) {
    activeAccountBar.classList.add('hidden');
    return;
  }

  activeAccountBar.classList.remove('hidden');
  activeEmailDisplay.textContent = activeInbox.email;
  activeEmailDisplay.title = activeInbox.email;
  activeInboxTagInput.value = activeInbox.tag || '';

  activeInboxTagInput.oninput = () => {
    activeInbox.tag = activeInboxTagInput.value.trim();
    saveState();
    renderInboxesList();
  };

  btnCopyActiveEmail.onclick = () => {
    navigator.clipboard.writeText(activeInbox.email);
    playChime('copy');
    showToast(`Copied ${activeInbox.email}`, 'success');
  };

  btnCopyActivePwd.onclick = () => {
    navigator.clipboard.writeText(activeInbox.password);
    playChime('copy');
    showToast('Copied mailbox password!', 'success');
  };

  btnCopyFullCreds.onclick = () => {
    const credText = `Email: ${activeInbox.email}\nPassword: ${activeInbox.password}`;
    navigator.clipboard.writeText(credText);
    playChime('copy');
    showToast('Copied email & password credentials!', 'success');
  };

  btnOpenWebmail.onclick = () => {
    openUrl('https://purelymail.com/manage/login');
  };

  btnDeleteActiveInbox.onclick = () => {
    deleteInbox(activeInbox);
  };
}

function renderMessagesList() {
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox) {
    messagesCountBadge.textContent = '0';
    messagesListContainer.innerHTML = `
      <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-dim);">
        <i data-lucide="inbox" style="width: 28px; height: 28px; margin: 0 auto 0.5rem auto; display: block; opacity: 0.4;"></i>
        <p style="font-size: 0.78rem;">No active inbox selected.</p>
      </div>
    `;
    initIcons();
    return;
  }

  const emails = activeInbox.emails || [];
  const searchTerm = searchMessagesInput.value.toLowerCase().trim();

  const filtered = emails.filter((m) => {
    const matchesSearch =
      m.subject.toLowerCase().includes(searchTerm) ||
      m.from.toLowerCase().includes(searchTerm) ||
      m.snippet.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    if (activeMessageFilter === 'unread') {
      return !m.isRead;
    } else if (activeMessageFilter === 'otp') {
      const otp = extractOtpCode(m.subject, m.bodyPlain);
      const link = extractPrimaryLink(m.bodyHtml, m.bodyPlain);
      return Boolean(otp || link);
    }
    return true;
  });

  messagesCountBadge.textContent = `${emails.length}`;
  messagesListContainer.innerHTML = '';

  if (filtered.length === 0) {
    messagesListContainer.innerHTML = `
      <div style="padding: 3rem 1.25rem; text-align: center; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 0.35rem;">
        <i data-lucide="inbox" style="width: 30px; height: 30px; opacity: 0.35;"></i>
        <p style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted);">Inbox is empty</p>
        <p style="font-size: 0.72rem; max-width: 220px; line-height: 1.4;">Listening for mail to <br/><b style="color: var(--text-primary); font-family: var(--font-mono);">${activeInbox.email}</b></p>
      </div>
    `;
    initIcons();
    return;
  }

  filtered.forEach((email) => {
    const card = document.createElement('div');
    card.className = `message-card ${!email.isRead ? 'unread' : ''} ${email.uid === selectedEmailUid ? 'active' : ''}`;
    card.onclick = () => selectEmail(email.uid);

    const otp = extractOtpCode(email.subject, email.bodyPlain);

    card.innerHTML = `
      <div class="message-card-top">
        <span class="message-sender" title="${email.from}">${email.from}</span>
        <span class="message-date">${formatRelativeTime(email.timestamp * 1000)}</span>
      </div>
      <div class="message-subject">${email.subject || '(No Subject)'}</div>
      ${otp ? `<div style="display: inline-flex; align-items: center; gap: 0.25rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 3px; padding: 1px 5px; font-size: 0.68rem; font-family: var(--font-mono); color: var(--accent-emerald); font-weight: 600; width: fit-content; margin-top: 2px;"><i data-lucide="shield-check" class="xs-icon"></i>OTP: ${otp}</div>` : ''}
      <div class="message-snippet">${email.snippet || ''}</div>
    `;

    messagesListContainer.appendChild(card);
  });

  initIcons();
}

function selectEmail(uid: number) {
  selectedEmailUid = uid;
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (activeInbox) {
    const email = activeInbox.emails.find((e) => e.uid === uid);
    if (email && !email.isRead) {
      email.isRead = true;
      activeInbox.unreadCount = Math.max(0, activeInbox.unreadCount - 1);
      saveState();
      renderInboxesList();
      invoke('mark_email_read', {
        email: activeInbox.email,
        password: activeInbox.password,
        uid: email.uid,
        read: true,
      }).catch(console.error);
    }
  }

  renderMessagesList();
  renderEmailDetail();
}

function updateEmailThemeDisplay() {
  if (appSettings.emailCanvasDark) {
    viewRenderedHtml.className = 'body-view email-canvas-dark';
    themeToggleIcon.setAttribute('data-lucide', 'sun');
    themeToggleText.textContent = 'Light Canvas';
  } else {
    viewRenderedHtml.className = 'body-view email-canvas-light';
    themeToggleIcon.setAttribute('data-lucide', 'moon');
    themeToggleText.textContent = 'Dark Canvas';
  }
  initIcons();
}

function renderEmailDetail() {
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox || selectedEmailUid === null) {
    emailDetailEmpty.classList.remove('hidden');
    emailDetailContainer.classList.add('hidden');
    return;
  }

  const email = activeInbox.emails.find((e) => e.uid === selectedEmailUid);
  if (!email) {
    emailDetailEmpty.classList.remove('hidden');
    emailDetailContainer.classList.add('hidden');
    return;
  }

  emailDetailEmpty.classList.add('hidden');
  emailDetailContainer.classList.remove('hidden');

  emailDetailSubject.textContent = email.subject || '(No Subject)';
  emailDetailFrom.textContent = email.from;
  emailDetailTo.textContent = email.to || activeInbox.email;
  emailDetailDate.textContent = email.date;

  const senderChar = (email.from.replace(/["'<]/g, '').trim()[0] || 'U').toUpperCase();
  emailSenderAvatar.textContent = senderChar;

  // Auto detect OTP / Verification Code
  const detectedOtp = extractOtpCode(email.subject, email.bodyPlain);
  if (detectedOtp) {
    otpHighlightBanner.classList.remove('hidden');
    otpCodeValue.textContent = detectedOtp;
    btnCopyOtp.onclick = () => {
      navigator.clipboard.writeText(detectedOtp);
      playChime('copy');
      showToast(`Copied OTP code: ${detectedOtp}`, 'success');
    };
  } else {
    otpHighlightBanner.classList.add('hidden');
  }

  // Auto detect Primary Action / Confirmation Link
  detectedLinkUrl = extractPrimaryLink(email.bodyHtml, email.bodyPlain);
  if (detectedLinkUrl) {
    linkHighlightBanner.classList.remove('hidden');
    linkUrlPreview.textContent = detectedLinkUrl;
    linkUrlPreview.title = detectedLinkUrl;
    btnOpenDetectedLink.onclick = () => {
      if (detectedLinkUrl) openUrl(detectedLinkUrl);
    };
  } else {
    linkHighlightBanner.classList.add('hidden');
  }

  // Export / Download EML handler
  btnExportEml.onclick = () => {
    const rawEml = `From: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nSubject: ${email.subject}\nMessage-ID: ${email.messageId}\nMIME-Version: 1.0\nContent-Type: text/html; charset=UTF-8\n\n${email.bodyHtml || email.bodyPlain}`;
    const blob = new Blob([rawEml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(email.subject || 'message').replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded .eml file', 'success');
  };

  // Plain Text Content
  emailPlainContent.textContent = email.bodyPlain || '(No plain text version available)';

  // Headers Content
  emailHeadersContent.innerHTML = `
    <div><b>Message-ID:</b> ${email.messageId || 'N/A'}</div>
    <div><b>Date:</b> ${email.date}</div>
    <div><b>From:</b> ${email.from}</div>
    <div><b>To:</b> ${email.to}</div>
    <div><b>Subject:</b> ${email.subject}</div>
    <div><b>UID:</b> ${email.uid}</div>
  `;

  // Rendered HTML View with DOMPurify
  const rawHtml = email.bodyHtml || `<pre style="font-family: inherit; white-space: pre-wrap;">${email.bodyPlain}</pre>`;
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'],
  });

  const isDark = appSettings.emailCanvasDark;
  const fullFrameHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <base target="_blank" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13.5px;
            line-height: 1.55;
            color: ${isDark ? '#e2e8f0' : '#1e293b'};
            padding: 1.15rem;
            margin: 0;
            background: ${isDark ? '#0d1117' : '#ffffff'};
            word-break: break-word;
          }
          img { max-width: 100%; height: auto; }
          a { color: #3b82f6; }
          pre, code { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; }
        </style>
      </head>
      <body>
        ${cleanHtml}
      </body>
    </html>
  `;
  emailHtmlFrame.srcdoc = fullFrameHtml;

  // Attachments
  if (email.attachments && email.attachments.length > 0) {
    attachmentsContainer.classList.remove('hidden');
    attachmentsList.innerHTML = '';
    email.attachments.forEach((att) => {
      const badge = document.createElement('div');
      badge.className = 'attachment-badge';
      const sizeKb = (att.sizeBytes / 1024).toFixed(1);
      badge.innerHTML = `
        <i data-lucide="paperclip" class="xs-icon"></i>
        <span>${att.filename} (${sizeKb} KB)</span>
      `;
      attachmentsList.appendChild(badge);
    });
  } else {
    attachmentsContainer.classList.add('hidden');
  }

  // Reply button handler
  btnReplyEmail.onclick = () => {
    openComposeModal({
      to: extractEmailAddress(email.from),
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- On ${email.date}, ${email.from} wrote:\n> ${email.bodyPlain.split('\n').join('\n> ')}`,
    });
  };

  // Delete message button handler
  btnDeleteEmail.onclick = async () => {
    const confirmed = await showConfirmDialog(
      'Delete Email',
      'Are you sure you want to permanently delete this email from your mailbox?',
      'Delete Email'
    );
    if (!confirmed) return;
    try {
      await invoke('delete_email', {
        email: activeInbox.email,
        password: activeInbox.password,
        uid: email.uid,
      });
      activeInbox.emails = activeInbox.emails.filter((e) => e.uid !== email.uid);
      selectedEmailUid = null;
      saveState();
      renderMessagesList();
      renderEmailDetail();
      showToast('Email deleted', 'info');
    } catch (err) {
      showToast(`Failed to delete email: ${err}`, 'error');
    }
  };

  initIcons();
}

function extractEmailAddress(str: string): string {
  const match = str.match(/<([^>]+)>/);
  if (match) return match[1];
  return str.trim();
}

async function syncActiveInbox(silent = false) {
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox || isSyncing) return;

  isSyncing = true;
  syncIcon.classList.add('spin');
  if (!silent) headerStatus.textContent = 'Syncing...';

  try {
    const fetchedEmails = await invoke<EmailSummary[]>('fetch_inbox', {
      email: activeInbox.email,
      password: activeInbox.password,
      limit: 50,
    });

    const previousCount = activeInbox.emails.length;
    activeInbox.emails = fetchedEmails;
    activeInbox.unreadCount = fetchedEmails.filter((e) => !e.isRead).length;

    if (fetchedEmails.length > previousCount && previousCount > 0) {
      playChime('receive');
      showToast(`New email in ${activeInbox.email}!`, 'success');
    }

    saveState();
    renderInboxesList();
    renderMessagesList();
    if (selectedEmailUid) renderEmailDetail();

    if (!silent) {
      headerStatus.textContent = 'Connected';
    }
  } catch (err) {
    console.error('IMAP sync failed:', err);
    if (!silent) {
      headerStatus.textContent = 'Sync error';
      showToast(`Sync error: ${err}`, 'error');
    }
  } finally {
    isSyncing = false;
    syncIcon.classList.remove('spin');
  }
}

async function generateThrowawayAccount() {
  if (!appSettings.apiToken) {
    openSettingsModal();
    showToast('Please set your Purelymail API Token first', 'error');
    return;
  }

  const domain = domainSelect.value || appSettings.selectedDomain;
  if (!domain) {
    showToast('No domain selected. Please configure a domain in settings.', 'error');
    return;
  }

  btnGenerateEmail.disabled = true;
  btnGenerateEmail.innerHTML = `<i data-lucide="refresh-cw" class="btn-icon spin"></i><span>Creating...</span>`;
  initIcons();

  try {
    const creds = await invoke<GeneratedCredentials>('generate_credentials', {
      customPrefix: appSettings.customPrefix || null,
      domain: domain,
    });

    await invoke<string>('purelymail_create_user', {
      apiToken: appSettings.apiToken,
      username: creds.username,
      domain: creds.domain,
      password: creds.password,
    });

    const newInbox: DisposableInbox = {
      id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email: creds.email,
      username: creds.username,
      domain: creds.domain,
      password: creds.password,
      createdAt: Date.now(),
      unreadCount: 0,
      emails: [],
    };

    inboxes.unshift(newInbox);
    activeInboxId = newInbox.id;
    selectedEmailUid = null;
    saveState();

    renderInboxesList();
    renderActiveAccountBar();
    renderMessagesList();
    renderEmailDetail();

    navigator.clipboard.writeText(newInbox.email);
    playChime('create');
    showToast(`Created & copied: ${newInbox.email}`, 'success');

    loadCredit();
    syncActiveInbox();
  } catch (err) {
    console.error('Failed to create account:', err);
    showToast(`Account creation failed: ${err}`, 'error');
  } finally {
    btnGenerateEmail.disabled = false;
    btnGenerateEmail.innerHTML = `<i data-lucide="plus" class="btn-icon"></i><span>New Disposable</span><span class="btn-kbd">⌘N</span>`;
    initIcons();
  }
}

async function deleteInbox(inbox: DisposableInbox) {
  const confirmed = await showConfirmDialog(
    'Delete Mailbox',
    `Are you sure you want to permanently delete "${inbox.email}" from Purelymail? This will remove all emails and wipe the account from the server.`,
    'Delete Account'
  );
  if (!confirmed) return;

  let apiWarning: string | null = null;
  if (appSettings.apiToken) {
    try {
      await invoke('purelymail_delete_user', {
        apiToken: appSettings.apiToken,
        fullUsername: inbox.email,
      });
    } catch (err) {
      console.warn('Purelymail delete API error:', err);
      apiWarning = `${err}`;
    }
  }

  inboxes = inboxes.filter((i) => i.id !== inbox.id);
  if (activeInboxId === inbox.id) {
    activeInboxId = inboxes.length > 0 ? inboxes[0].id : null;
    selectedEmailUid = null;
  }

  saveState();
  renderInboxesList();
  renderActiveAccountBar();
  renderMessagesList();
  renderEmailDetail();
  loadCredit();

  if (apiWarning) {
    showToast(`Removed from app (API: ${apiWarning})`, 'info');
  } else {
    showToast(`Deleted ${inbox.email}`, 'info');
  }
}

async function clearAllInboxes() {
  if (inboxes.length === 0) return;
  const confirmed = await showConfirmDialog(
    'Purge All Inboxes',
    `Are you sure you want to permanently delete all ${inboxes.length} temporary inboxes from Purelymail?`,
    'Purge All'
  );
  if (!confirmed) return;

  const toDelete = [...inboxes];
  for (const inbox of toDelete) {
    if (appSettings.apiToken) {
      try {
        await invoke('purelymail_delete_user', {
          apiToken: appSettings.apiToken,
          fullUsername: inbox.email,
        });
      } catch (err) {
        console.warn('API error deleting', inbox.email, err);
      }
    }
  }

  inboxes = [];
  activeInboxId = null;
  selectedEmailUid = null;
  saveState();

  renderInboxesList();
  renderActiveAccountBar();
  renderMessagesList();
  renderEmailDetail();
  loadCredit();
  showToast('All inboxes purged', 'info');
}

function openSettingsModal() {
  settingApiToken.value = appSettings.apiToken || '';
  settingCustomPrefix.value = appSettings.customPrefix || '';
  settingSyncInterval.value = `${appSettings.syncIntervalSec}`;
  connectionTestResult.textContent = '';
  modalSettings.classList.remove('hidden');
}

function closeSettingsModal() {
  modalSettings.classList.add('hidden');
}

function openComposeModal(preset?: { to?: string; subject?: string; body?: string }) {
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox) {
    showToast('Please create or select an active mailbox first', 'error');
    return;
  }

  composeFromInput.value = activeInbox.email;
  composeToInput.value = preset?.to || '';
  composeSubjectInput.value = preset?.subject || '';
  composeBodyInput.value = preset?.body || '';

  modalCompose.classList.remove('hidden');
}

function closeComposeModal() {
  modalCompose.classList.add('hidden');
}

async function handleSendEmailSubmit(e: Event) {
  e.preventDefault();
  const activeInbox = inboxes.find((i) => i.id === activeInboxId);
  if (!activeInbox) return;

  const to = composeToInput.value.trim();
  const subject = composeSubjectInput.value.trim();
  const body = composeBodyInput.value.trim();

  if (!to || !subject || !body) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  btnSendEmailSubmit.disabled = true;
  btnSendEmailSubmit.innerHTML = `<i data-lucide="refresh-cw" class="btn-icon spin"></i><span>Sending...</span>`;
  initIcons();

  try {
    await invoke('send_email', {
      fromEmail: activeInbox.email,
      password: activeInbox.password,
      toEmail: to,
      subject: subject,
      bodyText: body,
      bodyHtml: null,
    });

    playChime('create');
    showToast('Email sent successfully!', 'success');
    closeComposeModal();
  } catch (err) {
    showToast(`Failed to send email: ${err}`, 'error');
  } finally {
    btnSendEmailSubmit.disabled = false;
    btnSendEmailSubmit.innerHTML = `<i data-lucide="send" class="btn-icon"></i><span>Send</span>`;
    initIcons();
  }
}

function setupAutoSync() {
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  if (countdownTimer) clearInterval(countdownTimer);

  const intervalSec = appSettings.syncIntervalSec;
  if (intervalSec <= 0) {
    autoSyncTimer.textContent = 'Sync: off';
    return;
  }

  secondsUntilNextSync = intervalSec;
  autoSyncTimer.textContent = `Sync: ${secondsUntilNextSync}s`;

  countdownTimer = window.setInterval(() => {
    secondsUntilNextSync -= 1;
    if (secondsUntilNextSync <= 0) {
      secondsUntilNextSync = intervalSec;
      syncActiveInbox(true);
    }
    autoSyncTimer.textContent = `Sync: ${secondsUntilNextSync}s`;
  }, 1000);
}

// Global Keyboard Shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') {
        (e.target as HTMLElement).blur();
      }
      return;
    }

    if (e.key === 'Escape') {
      if (isReaderExpanded) {
        toggleReaderExpand(false);
        return;
      }
      closeSettingsModal();
      closeComposeModal();
      modalShortcuts.classList.add('hidden');
      closeConfirmDialog(false);
      return;
    }

    if (e.key === '\\') {
      e.preventDefault();
      toggleReaderExpand();
      return;
    }

    if (e.key === '[') {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      generateThrowawayAccount();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      syncActiveInbox(false);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal();
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      modalShortcuts.classList.remove('hidden');
      return;
    }

    if (e.key.toLowerCase() === 'g') {
      e.preventDefault();
      generateThrowawayAccount();
      return;
    }

    if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      syncActiveInbox(false);
      return;
    }

    if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      openComposeModal();
      return;
    }

    const activeInbox = inboxes.find((i) => i.id === activeInboxId);
    if (!activeInbox || activeInbox.emails.length === 0) return;

    if (e.key.toLowerCase() === 'j') {
      e.preventDefault();
      const currentIdx = activeInbox.emails.findIndex((em) => em.uid === selectedEmailUid);
      const nextIdx = currentIdx < activeInbox.emails.length - 1 ? currentIdx + 1 : 0;
      selectEmail(activeInbox.emails[nextIdx].uid);
    } else if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const currentIdx = activeInbox.emails.findIndex((em) => em.uid === selectedEmailUid);
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : activeInbox.emails.length - 1;
      selectEmail(activeInbox.emails[prevIdx].uid);
    } else if (e.key === 'Backspace' || e.key.toLowerCase() === 'e') {
      if (selectedEmailUid !== null) {
        e.preventDefault();
        btnDeleteEmail.click();
      }
    }
  });
}

// Draggable Pane Resizing Engine
function setupPaneResizers() {
  const resizer1 = document.getElementById('resizer-1') as HTMLElement;
  const resizer2 = document.getElementById('resizer-2') as HTMLElement;

  if (!resizer1 || !resizer2) return;

  const savedSidebar = localStorage.getItem('tempmail_sidebar_width');
  if (savedSidebar) {
    document.documentElement.style.setProperty('--sidebar-width', `${savedSidebar}px`);
  }
  const savedMessages = localStorage.getItem('tempmail_messages_width');
  if (savedMessages) {
    document.documentElement.style.setProperty('--messages-width', `${savedMessages}px`);
  }

  resizer1.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    resizer1.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(moveEvent.clientX, 180), 450);
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    };

    const onMouseUp = () => {
      resizer1.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const computed = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '240',
        10
      );
      localStorage.setItem('tempmail_sidebar_width', `${computed}`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  resizer2.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    resizer2.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const sidebarWidth = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '240',
        10
      );
      const newMessagesWidth = Math.min(
        Math.max(moveEvent.clientX - sidebarWidth - 5, 240),
        600
      );
      document.documentElement.style.setProperty('--messages-width', `${newMessagesWidth}px`);
    };

    const onMouseUp = () => {
      resizer2.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const computed = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--messages-width') || '320',
        10
      );
      localStorage.setItem('tempmail_messages_width', `${computed}`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// Event Listeners
btnGenerateEmail.addEventListener('click', generateThrowawayAccount);
btnSyncNow.addEventListener('click', () => {
  secondsUntilNextSync = appSettings.syncIntervalSec;
  syncActiveInbox(false);
});
btnOpenSettings.addEventListener('click', openSettingsModal);
btnCloseSettings.addEventListener('click', closeSettingsModal);
btnClearAllInboxes.addEventListener('click', clearAllInboxes);

btnToggleSound.addEventListener('click', () => {
  appSettings.soundEnabled = !appSettings.soundEnabled;
  if (appSettings.soundEnabled) {
    soundIcon.setAttribute('data-lucide', 'volume-2');
    showToast('Sound alerts enabled', 'info');
    playChime('copy');
  } else {
    soundIcon.setAttribute('data-lucide', 'volume-x');
    showToast('Sound alerts muted', 'info');
  }
  saveState();
  initIcons();
});

btnToggleEmailTheme.addEventListener('click', () => {
  appSettings.emailCanvasDark = !appSettings.emailCanvasDark;
  saveState();
  updateEmailThemeDisplay();
  renderEmailDetail();
});

btnOpenShortcuts.addEventListener('click', () => modalShortcuts.classList.remove('hidden'));
btnCloseShortcuts.addEventListener('click', () => modalShortcuts.classList.add('hidden'));
btnDismissShortcuts.addEventListener('click', () => modalShortcuts.classList.add('hidden'));

// Filter Chips Handlers
filterAll.addEventListener('click', () => {
  activeMessageFilter = 'all';
  filterAll.classList.add('active');
  filterUnread.classList.remove('active');
  filterOtp.classList.remove('active');
  renderMessagesList();
});

filterUnread.addEventListener('click', () => {
  activeMessageFilter = 'unread';
  filterAll.classList.remove('active');
  filterUnread.classList.add('active');
  filterOtp.classList.remove('active');
  renderMessagesList();
});

filterOtp.addEventListener('click', () => {
  activeMessageFilter = 'otp';
  filterAll.classList.remove('active');
  filterUnread.classList.remove('active');
  filterOtp.classList.add('active');
  renderMessagesList();
});

btnToggleTokenVisibility.addEventListener('click', () => {
  if (settingApiToken.type === 'password') {
    settingApiToken.type = 'text';
    btnToggleTokenVisibility.innerHTML = '<i data-lucide="eye-off" class="sm-icon"></i>';
  } else {
    settingApiToken.type = 'password';
    btnToggleTokenVisibility.innerHTML = '<i data-lucide="eye" class="sm-icon"></i>';
  }
  initIcons();
});

btnTestConnection.addEventListener('click', async () => {
  const token = settingApiToken.value.trim();
  if (!token) {
    connectionTestResult.className = 'test-feedback error';
    connectionTestResult.textContent = 'Please enter an API token.';
    return;
  }

  connectionTestResult.className = 'test-feedback';
  connectionTestResult.textContent = 'Testing...';

  try {
    appSettings.apiToken = token;
    const success = await loadDomains(true);
    if (success) {
      connectionTestResult.className = 'test-feedback success';
      connectionTestResult.textContent = `Connected! ${availableDomains.length} domains found.`;
    } else {
      connectionTestResult.className = 'test-feedback error';
      connectionTestResult.textContent = 'Connected, but no active domains.';
    }
  } catch (err) {
    connectionTestResult.className = 'test-feedback error';
    connectionTestResult.textContent = `Error: ${err}`;
  }
});

btnSaveSettings.addEventListener('click', async () => {
  appSettings.apiToken = settingApiToken.value.trim();
  appSettings.customPrefix = settingCustomPrefix.value.trim();
  appSettings.syncIntervalSec = parseInt(settingSyncInterval.value, 10) || 10;
  saveState();
  closeSettingsModal();
  showToast('Settings saved', 'success');
  await loadDomains();
  setupAutoSync();
});

domainSelect.addEventListener('change', () => {
  appSettings.selectedDomain = domainSelect.value;
  saveState();
});

searchInboxesInput.addEventListener('input', renderInboxesList);
searchMessagesInput.addEventListener('input', renderMessagesList);

tabRenderedHtml.addEventListener('click', () => {
  tabRenderedHtml.classList.add('active');
  tabPlainText.classList.remove('active');
  tabRawHeaders.classList.remove('active');
  viewRenderedHtml.classList.remove('hidden');
  viewPlainText.classList.add('hidden');
  viewRawHeaders.classList.add('hidden');
});

tabPlainText.addEventListener('click', () => {
  tabRenderedHtml.classList.remove('active');
  tabPlainText.classList.add('active');
  tabRawHeaders.classList.remove('active');
  viewRenderedHtml.classList.add('hidden');
  viewPlainText.classList.remove('hidden');
  viewRawHeaders.classList.add('hidden');
});

tabRawHeaders.addEventListener('click', () => {
  tabRenderedHtml.classList.remove('active');
  tabPlainText.classList.remove('active');
  tabRawHeaders.classList.add('active');
  viewRenderedHtml.classList.add('hidden');
  viewPlainText.classList.add('hidden');
  viewRawHeaders.classList.remove('hidden');
});

btnComposeMail.addEventListener('click', () => openComposeModal());
btnCloseCompose.addEventListener('click', closeComposeModal);
btnCancelCompose.addEventListener('click', closeComposeModal);
composeForm.addEventListener('submit', handleSendEmailSubmit);

btnActionConfirm.addEventListener('click', () => closeConfirmDialog(true));
btnCancelConfirm.addEventListener('click', () => closeConfirmDialog(false));
btnCloseConfirm.addEventListener('click', () => closeConfirmDialog(false));

if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener('click', () => toggleSidebar());
}
if (btnToggleExpandReader) {
  btnToggleExpandReader.addEventListener('click', () => toggleReaderExpand());
}
if (btnRestoreColumns) {
  btnRestoreColumns.addEventListener('click', () => toggleReaderExpand(false));
}

// Native Window Dragging for Top Bar
function setupWindowDragging() {
  const dragRegions = document.querySelectorAll('[data-tauri-drag-region]');
  dragRegions.forEach((el) => {
    el.addEventListener('mousedown', (e: any) => {
      // Only drag on left mouse button and not on interactive buttons/inputs
      if (e.button === 0 && !e.target.closest('button, input, select, textarea, a, .pane-resizer, .icon-btn-tiny, .link-btn-tiny')) {
        getCurrentWindow().startDragging();
      }
    });
  });
}

// App Initialization
window.addEventListener('DOMContentLoaded', async () => {
  initIcons();
  loadState();
  updateEmailThemeDisplay();
  setupWindowDragging();
  setupPaneResizers();
  setupKeyboardShortcuts();
  renderInboxesList();
  renderActiveAccountBar();
  renderMessagesList();
  renderEmailDetail();

  const hasDomains = await loadDomains();
  if (!hasDomains && !appSettings.apiToken) {
    setTimeout(() => {
      openSettingsModal();
    }, 500);
  }

  setupAutoSync();
  if (activeInboxId) {
    syncActiveInbox(true);
  }
});
