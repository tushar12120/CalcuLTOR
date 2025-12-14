/**
 * CalcuLTOR - Payment Calculator
 * A billing calculator with UPI QR code payment collection
 * Connected to Supabase for transaction recording
 */

// Supabase Configuration
const SUPABASE_URL = 'https://kxdykwutrkdxnrbzhtnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZHlrd3V0cmtkeG5yYnpodG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MjUyNTcsImV4cCI6MjA4MTIwMTI1N30.KYmFMU7k7IdzCIeMtF6tG9eUtsLv6gEP5CO5SG3wM58';

// App Version - Update this when releasing new version
const APP_VERSION = '1.1.0';
// GitHub raw URL for version check
const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/tushar12120/CalcuLTOR/main/version.json';

class PaymentCalculator {
    constructor() {
        // State
        this.currentValue = '0';
        this.previousValue = '';
        this.operator = null;
        this.shouldResetDisplay = false;
        this.history = [];

        // Settings - Default UPI ID (hardcoded, no prompt needed)
        this.upiId = '8000795019@ybl';
        this.merchantName = 'CalcuLTOR';

        // DOM Elements
        this.resultDisplay = document.getElementById('result');
        this.expressionDisplay = document.getElementById('expression');
        this.historyDisplay = document.getElementById('history');

        // Modals
        this.settingsModal = document.getElementById('settingsModal');
        this.qrModal = document.getElementById('qrModal');
        this.cashModal = document.getElementById('cashModal');
        this.historyModal = document.getElementById('historyModal');

        // Transaction history (localStorage)
        this.transactions = JSON.parse(localStorage.getItem('calcultor-transactions')) || [];

        // Initialize
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.updateDisplay();
    }

    setupEventListeners() {
        // Number buttons
        document.querySelectorAll('.calc-btn.number').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hapticFeedback(btn);
                this.inputNumber(btn.dataset.value);
            });
        });

        // Operator buttons
        document.querySelectorAll('.calc-btn.operator').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hapticFeedback(btn);
                this.handleOperator(btn.dataset.action);
            });
        });

        // Function buttons
        document.querySelectorAll('.calc-btn.function').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hapticFeedback(btn);
                this.handleFunction(btn.dataset.action);
            });
        });

        // Clear button
        document.querySelector('.calc-btn.clear').addEventListener('click', (e) => {
            this.hapticFeedback(e.target);
            this.clear();
        });

        // Backspace button
        document.querySelector('.calc-btn.backspace').addEventListener('click', (e) => {
            this.hapticFeedback(e.target);
            this.backspace();
        });

        // Equals button
        document.querySelector('.calc-btn.equals').addEventListener('click', (e) => {
            this.hapticFeedback(e.target);
            this.calculate();
        });

        // Payment buttons
        document.getElementById('cashBtn').addEventListener('click', () => this.handleCashPayment());
        document.getElementById('upiBtn').addEventListener('click', () => this.handleUpiPayment());

        // Settings (optional - can still access if needed)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closeSettings());
        }
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => this.saveSettings());
        }

        // Theme options
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });

        // QR Modal
        document.getElementById('closeQr').addEventListener('click', () => this.closeQrModal());
        document.getElementById('paymentDone').addEventListener('click', () => this.paymentReceived());

        // Cash Modal
        document.getElementById('closeCash').addEventListener('click', () => this.closeCashModal());
        document.getElementById('cashDone').addEventListener('click', () => this.cashPaymentDone());
        document.getElementById('cashReceived').addEventListener('input', (e) => this.calculateChange(e.target.value));

        // History Modal
        document.getElementById('historyBtn').addEventListener('click', () => this.openHistory());
        document.getElementById('closeHistory').addEventListener('click', () => this.closeHistory());
        document.getElementById('clearHistory').addEventListener('click', () => this.clearTransactionHistory());
        document.getElementById('prevDate').addEventListener('click', () => this.changeDate(-1));
        document.getElementById('nextDate').addEventListener('click', () => this.changeDate(1));
        document.getElementById('historyDate').addEventListener('change', (e) => this.setDate(e.target.value));
        document.getElementById('goToday').addEventListener('click', () => this.goToToday());

        // Close modals on overlay click
        if (this.settingsModal) {
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) this.closeSettings();
            });
        }
        this.qrModal.addEventListener('click', (e) => {
            if (e.target === this.qrModal) this.closeQrModal();
        });
        this.cashModal.addEventListener('click', (e) => {
            if (e.target === this.cashModal) this.closeCashModal();
        });
        if (this.historyModal) {
            this.historyModal.addEventListener('click', (e) => {
                if (e.target === this.historyModal) this.closeHistory();
            });
        }

        // Keyboard support
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    hapticFeedback(button) {
        button.classList.add('pressed');
        setTimeout(() => button.classList.remove('pressed'), 150);

        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
    }

    inputNumber(value) {
        if (this.shouldResetDisplay) {
            this.currentValue = value === '.' ? '0.' : value;
            this.shouldResetDisplay = false;
        } else {
            if (value === '.' && this.currentValue.includes('.')) return;
            if (this.currentValue === '0' && value !== '.') {
                this.currentValue = value;
            } else {
                if (this.currentValue.length >= 12) return;
                this.currentValue += value;
            }
        }
        this.updateDisplay();
    }

    handleOperator(action) {
        const operators = {
            'add': '+',
            'subtract': '-',
            'multiply': '×',
            'divide': '÷'
        };

        if (this.operator && !this.shouldResetDisplay) {
            this.calculate(false);
        }

        this.previousValue = this.currentValue;
        this.operator = operators[action];
        this.shouldResetDisplay = true;
        this.updateExpression();
    }

    handleFunction(action) {
        const num = parseFloat(this.currentValue);

        switch (action) {
            case 'plusMinus':
                this.currentValue = (num * -1).toString();
                break;
            case 'percent':
                this.currentValue = (num / 100).toString();
                break;
        }

        this.updateDisplay();
    }

    calculate(addToHistory = true) {
        if (!this.operator || !this.previousValue) return;

        const prev = parseFloat(this.previousValue);
        const current = parseFloat(this.currentValue);
        let result;

        const expression = `${this.previousValue} ${this.operator} ${this.currentValue}`;

        switch (this.operator) {
            case '+':
                result = prev + current;
                break;
            case '-':
                result = prev - current;
                break;
            case '×':
                result = prev * current;
                break;
            case '÷':
                if (current === 0) {
                    this.showError('Cannot divide by zero');
                    return;
                }
                result = prev / current;
                break;
        }

        if (addToHistory) {
            this.addToHistory(expression, result);
        }

        this.currentValue = this.formatResult(result);
        this.operator = null;
        this.previousValue = '';
        this.shouldResetDisplay = true;

        this.resultDisplay.classList.add('success-animation');
        setTimeout(() => this.resultDisplay.classList.remove('success-animation'), 500);

        this.updateDisplay();
        this.updateExpression();
    }

    formatResult(num) {
        if (!isFinite(num)) return 'Error';
        if (isNaN(num)) return 'Error';

        // Round to 2 decimal places for currency
        const rounded = Math.round(num * 100) / 100;
        return rounded.toString();
    }

    clear() {
        this.currentValue = '0';
        this.previousValue = '';
        this.operator = null;
        this.shouldResetDisplay = false;
        this.resultDisplay.classList.remove('error');
        this.updateDisplay();
        this.updateExpression();
    }

    backspace() {
        if (this.shouldResetDisplay) {
            this.clear();
            return;
        }

        if (this.currentValue.length === 1 ||
            (this.currentValue.length === 2 && this.currentValue.startsWith('-'))) {
            this.currentValue = '0';
        } else {
            this.currentValue = this.currentValue.slice(0, -1);
        }

        this.updateDisplay();
    }

    showError(message = 'Error') {
        this.resultDisplay.textContent = message;
        this.resultDisplay.classList.add('error');

        if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50]);
        }

        setTimeout(() => this.clear(), 1500);
    }

    addToHistory(expression, result) {
        this.history.unshift({ expression, result: this.formatResult(result) });
        if (this.history.length > 10) {
            this.history.pop();
        }
        this.updateHistory();
    }

    updateDisplay() {
        // Format with commas for readability
        const num = parseFloat(this.currentValue);
        if (!isNaN(num) && this.currentValue !== '' && !this.currentValue.endsWith('.')) {
            this.resultDisplay.textContent = this.formatWithCommas(this.currentValue);
        } else {
            this.resultDisplay.textContent = this.currentValue;
        }
        this.resultDisplay.classList.remove('error');
    }

    formatWithCommas(value) {
        const parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    updateExpression() {
        if (this.previousValue && this.operator) {
            this.expressionDisplay.textContent = `${this.previousValue} ${this.operator}`;
        } else {
            this.expressionDisplay.textContent = '';
        }
    }

    updateHistory() {
        if (this.history.length > 0) {
            const latest = this.history[0];
            this.historyDisplay.textContent = `${latest.expression} = ₹${latest.result}`;
        }
    }

    // === Payment Functions ===

    handleCashPayment() {
        const amount = parseFloat(this.currentValue);
        if (amount <= 0 || isNaN(amount)) {
            this.showError('Enter amount first');
            return;
        }

        document.getElementById('cashAmount').textContent = `₹${this.formatWithCommas(amount.toFixed(2))}`;
        document.getElementById('cashReceived').value = '';
        document.getElementById('changeAmount').textContent = '₹0';
        this.cashModal.classList.add('active');

        setTimeout(() => {
            document.getElementById('cashReceived').focus();
        }, 300);
    }

    calculateChange(received) {
        const amount = parseFloat(this.currentValue);
        const receivedAmount = parseFloat(received) || 0;
        const change = receivedAmount - amount;

        if (change >= 0) {
            document.getElementById('changeAmount').textContent = `₹${this.formatWithCommas(change.toFixed(2))}`;
            document.getElementById('changeSection').style.background = 'rgba(74, 222, 128, 0.1)';
        } else {
            document.getElementById('changeAmount').textContent = `-₹${this.formatWithCommas(Math.abs(change).toFixed(2))}`;
            document.getElementById('changeSection').style.background = 'rgba(239, 68, 68, 0.1)';
        }
    }

    cashPaymentDone() {
        const amount = parseFloat(this.currentValue);
        const received = parseFloat(document.getElementById('cashReceived').value) || 0;
        const change = received - amount;

        // Record transaction to Supabase
        this.recordTransaction('CASH', amount, received, change);

        // Play success sound
        this.playPaymentSound();

        this.closeCashModal();
        this.clear();

        // Show success feedback
        this.showPaymentSuccess('CASH', amount);

        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    closeCashModal() {
        this.cashModal.classList.remove('active');
    }

    handleUpiPayment() {
        const amount = parseFloat(this.currentValue);
        if (amount <= 0 || isNaN(amount)) {
            this.showError('Enter amount first');
            return;
        }

        // Direct QR - no settings prompt needed
        document.getElementById('qrAmount').textContent = `₹${this.formatWithCommas(amount.toFixed(2))}`;
        this.generateQRCode(amount);
        this.qrModal.classList.add('active');
    }

    generateQRCode(amount) {
        const container = document.getElementById('qrContainer');
        container.innerHTML = '<p style="color: #888;">Generating QR...</p>';

        // Create UPI payment URL
        const upiUrl = this.createUpiUrl(amount);

        // Use Google Charts API to generate QR code (works reliably)
        const qrApiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(upiUrl)}&choe=UTF-8`;

        // Create image element
        const qrImage = document.createElement('img');
        qrImage.src = qrApiUrl;
        qrImage.alt = 'UPI QR Code';
        qrImage.style.width = '220px';
        qrImage.style.height = '220px';
        qrImage.style.borderRadius = '12px';

        qrImage.onload = () => {
            container.innerHTML = '';
            container.appendChild(qrImage);
        };

        qrImage.onerror = () => {
            // Fallback to another QR API
            const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
            qrImage.src = fallbackUrl;

            qrImage.onerror = () => {
                // Final fallback - show UPI link
                container.innerHTML = `
                    <div style="padding: 20px; text-align: center; background: #f5f5f5; border-radius: 12px;">
                        <p style="font-size: 0.9rem; color: #333; margin-bottom: 10px;">Scan nahi ho raha? UPI app mein manually enter karo:</p>
                        <p style="font-weight: bold; color: #6366f1;">${this.upiId}</p>
                        <p style="font-size: 1.2rem; font-weight: bold; color: #22c55e;">₹${amount.toFixed(2)}</p>
                    </div>
                `;
            };
        };
    }

    createUpiUrl(amount) {
        const params = new URLSearchParams({
            pa: this.upiId,                    // Payee address (UPI ID)
            pn: this.merchantName,             // Payee name
            am: amount.toFixed(2),             // Amount
            cu: 'INR',                         // Currency
            tn: `Payment of Rs.${amount}`      // Transaction note
        });

        return `upi://pay?${params.toString()}`;
    }

    paymentReceived() {
        const amount = parseFloat(this.currentValue);

        // Record UPI transaction to Supabase
        this.recordTransaction('UPI', amount, amount, 0);

        // Play success sound
        this.playPaymentSound();

        this.closeQrModal();
        this.clear();

        // Show success feedback
        this.showPaymentSuccess('UPI', amount);

        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    closeQrModal() {
        this.qrModal.classList.remove('active');
    }

    // === Payment Sound & Success Feedback ===

    playPaymentSound() {
        try {
            // Create audio context for generating sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create a pleasant "cha-ching" success sound
            const playTone = (frequency, startTime, duration) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };

            const now = audioContext.currentTime;

            // Play ascending tones for success feeling
            playTone(523.25, now, 0.15);        // C5
            playTone(659.25, now + 0.1, 0.15);  // E5
            playTone(783.99, now + 0.2, 0.2);   // G5

            console.log('Payment sound played');
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    showPaymentSuccess(type, amount) {
        // Create success toast notification
        const toast = document.createElement('div');
        toast.className = 'payment-success-toast';
        toast.innerHTML = `
            <span class="toast-icon">${type === 'CASH' ? '💵' : '📱'}</span>
            <span class="toast-text">₹${this.formatWithCommas(amount.toFixed(2))} received!</span>
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // === Supabase Transaction Recording ===

    async recordTransaction(paymentType, amount, received = null, change = null) {
        try {
            const transaction = {
                payment_type: paymentType,
                amount: amount,
                received_amount: received,
                change_amount: change,
                upi_id: paymentType === 'UPI' ? this.upiId : null,
                created_at: new Date().toISOString()
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(transaction)
            });

            if (response.ok) {
                console.log('Transaction recorded to Supabase');
            } else {
                console.log('Supabase recording failed:', response.status);
            }
        } catch (error) {
            console.log('Supabase error:', error);
        }

        // Always save to localStorage (works offline)
        this.saveTransactionLocal(paymentType, amount, received, change);
    }

    saveTransactionLocal(paymentType, amount, received, change) {
        const transaction = {
            id: Date.now(),
            type: paymentType,
            amount: amount,
            received: received,
            change: change,
            timestamp: new Date().toISOString()
        };

        this.transactions.unshift(transaction);

        // Keep only last 100 transactions
        if (this.transactions.length > 100) {
            this.transactions = this.transactions.slice(0, 100);
        }

        localStorage.setItem('calcultor-transactions', JSON.stringify(this.transactions));
    }

    // === Transaction History Functions ===

    openHistory() {
        // Set to today's date by default
        this.selectedDate = new Date();
        this.updateDateDisplay();
        this.renderHistory();
        this.historyModal.classList.add('active');
    }

    closeHistory() {
        this.historyModal.classList.remove('active');
    }

    updateDateDisplay() {
        const dateInput = document.getElementById('historyDate');
        const dateDisplay = document.getElementById('dateDisplay');
        const summaryLabel = document.getElementById('summaryDateLabel');

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Format for date input (YYYY-MM-DD)
        const year = this.selectedDate.getFullYear();
        const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(this.selectedDate.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;

        // Display text
        if (this.selectedDate.toDateString() === today.toDateString()) {
            dateDisplay.textContent = 'Today';
            summaryLabel.textContent = "Today's Total";
        } else if (this.selectedDate.toDateString() === yesterday.toDateString()) {
            dateDisplay.textContent = 'Yesterday';
            summaryLabel.textContent = "Yesterday's Total";
        } else {
            dateDisplay.textContent = this.selectedDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            summaryLabel.textContent = "Day's Total";
        }
    }

    changeDate(delta) {
        this.selectedDate.setDate(this.selectedDate.getDate() + delta);
        this.updateDateDisplay();
        this.renderHistory();
    }

    setDate(dateString) {
        this.selectedDate = new Date(dateString);
        this.updateDateDisplay();
        this.renderHistory();
    }

    goToToday() {
        this.selectedDate = new Date();
        this.updateDateDisplay();
        this.renderHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('historyList');
        const todayTotal = document.getElementById('todayTotal');
        const cashTotal = document.getElementById('cashTotal');
        const upiTotal = document.getElementById('upiTotal');
        const totalCount = document.getElementById('totalCount');

        // Filter transactions for selected date
        const selectedDateStr = this.selectedDate.toDateString();
        const filteredTransactions = this.transactions.filter(t =>
            new Date(t.timestamp).toDateString() === selectedDateStr
        );

        // Calculate totals
        let total = 0;
        let cashSum = 0;
        let upiSum = 0;

        filteredTransactions.forEach(t => {
            total += t.amount;
            if (t.type === 'CASH') {
                cashSum += t.amount;
            } else {
                upiSum += t.amount;
            }
        });

        todayTotal.textContent = `₹${this.formatWithCommas(total.toFixed(2))}`;
        cashTotal.textContent = `₹${this.formatWithCommas(cashSum.toFixed(2))}`;
        upiTotal.textContent = `₹${this.formatWithCommas(upiSum.toFixed(2))}`;
        totalCount.textContent = filteredTransactions.length;

        // Render transaction list
        if (filteredTransactions.length === 0) {
            historyList.innerHTML = '<p class="no-history">No transactions on this date</p>';
            return;
        }

        historyList.innerHTML = filteredTransactions.map(t => {
            const date = new Date(t.timestamp);
            const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const icon = t.type === 'CASH' ? '💵' : '📱';

            return `
                <div class="history-item ${t.type.toLowerCase()}">
                    <div class="history-item-left">
                        <span class="history-item-type">${icon} ${t.type}</span>
                        <span class="history-item-time">${timeStr}</span>
                    </div>
                    <span class="history-item-amount">₹${this.formatWithCommas(t.amount.toFixed(2))}</span>
                </div>
            `;
        }).join('');
    }

    clearTransactionHistory() {
        if (confirm('Clear ALL transaction history?')) {
            this.transactions = [];
            localStorage.removeItem('calcultor-transactions');
            this.renderHistory();

            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }
        }
    }

    // === Settings Functions (Optional) ===

    openSettings() {
        if (!this.settingsModal) return;
        document.getElementById('upiId').value = this.upiId;
        document.getElementById('merchantName').value = this.merchantName;

        // Update theme buttons
        const isDark = !document.body.classList.contains('light-theme');
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === (isDark ? 'dark' : 'light'));
        });

        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        if (this.settingsModal) {
            this.settingsModal.classList.remove('active');
        }
    }

    saveSettings() {
        const upiInput = document.getElementById('upiId');
        const merchantInput = document.getElementById('merchantName');

        if (upiInput) this.upiId = upiInput.value.trim() || '8000795019@ybl';
        if (merchantInput) this.merchantName = merchantInput.value.trim() || 'CalcuLTOR';

        localStorage.setItem('calcultor-upi', this.upiId);
        localStorage.setItem('calcultor-merchant', this.merchantName);

        this.closeSettings();

        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        localStorage.setItem('calcultor-theme', theme);

        // Update active state
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('calcultor-theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }

    handleKeyboard(e) {
        // Don't handle if modal is open with input focused
        if (document.activeElement.tagName === 'INPUT') return;

        if (/^[0-9.]$/.test(e.key)) {
            e.preventDefault();
            this.inputNumber(e.key);
        }

        switch (e.key) {
            case '+':
                e.preventDefault();
                this.handleOperator('add');
                break;
            case '-':
                e.preventDefault();
                this.handleOperator('subtract');
                break;
            case '*':
                e.preventDefault();
                this.handleOperator('multiply');
                break;
            case '/':
                e.preventDefault();
                this.handleOperator('divide');
                break;
            case '%':
                e.preventDefault();
                this.handleFunction('percent');
                break;
            case 'Enter':
            case '=':
                e.preventDefault();
                this.calculate();
                break;
            case 'Backspace':
                e.preventDefault();
                this.backspace();
                break;
            case 'Escape':
                e.preventDefault();
                this.clear();
                break;
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new PaymentCalculator();

    // Check for updates after app loads
    setTimeout(() => {
        checkForUpdate();
    }, 2000);
});

// Service Worker Registration for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            console.log('Service Worker not available');
        });
    });
}

// === Auto Update System ===

async function checkForUpdate() {
    try {
        // Check if user dismissed update recently (within 24 hours)
        const lastDismissed = localStorage.getItem('update-dismissed');
        if (lastDismissed) {
            const dismissedTime = parseInt(lastDismissed);
            const now = Date.now();
            const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
            if (hoursSinceDismissed < 24) {
                console.log('Update check skipped - dismissed recently');
                return;
            }
        }

        const response = await fetch(VERSION_CHECK_URL + '?t=' + Date.now(), {
            cache: 'no-store'
        });

        if (!response.ok) {
            console.log('Version check failed');
            return;
        }

        const versionInfo = await response.json();

        // Compare versions
        if (isNewerVersion(versionInfo.version, APP_VERSION)) {
            showUpdateModal(versionInfo);
        } else {
            console.log('App is up to date');
        }
    } catch (error) {
        console.log('Update check error:', error);
    }
}

function isNewerVersion(newVersion, currentVersion) {
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
        const newPart = newParts[i] || 0;
        const currentPart = currentParts[i] || 0;

        if (newPart > currentPart) return true;
        if (newPart < currentPart) return false;
    }

    return false;
}

function showUpdateModal(versionInfo) {
    document.getElementById('currentVersion').textContent = APP_VERSION;
    document.getElementById('newVersion').textContent = versionInfo.version;
    document.getElementById('releaseNotes').textContent = versionInfo.releaseNotes;

    const updateModal = document.getElementById('updateModal');
    updateModal.classList.add('active');

    // Update Now button
    document.getElementById('updateNow').onclick = () => {
        window.open(versionInfo.downloadUrl, '_blank');
        updateModal.classList.remove('active');
    };

    // Later button
    document.getElementById('updateLater').onclick = () => {
        localStorage.setItem('update-dismissed', Date.now().toString());
        updateModal.classList.remove('active');
    };

    // Close on overlay click
    updateModal.onclick = (e) => {
        if (e.target === updateModal) {
            localStorage.setItem('update-dismissed', Date.now().toString());
            updateModal.classList.remove('active');
        }
    };
}
