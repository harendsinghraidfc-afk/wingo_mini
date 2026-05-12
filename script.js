document.addEventListener('DOMContentLoaded', () => {
    // --- Telegram WebApp Integration ---
    const tg = window.Telegram.WebApp;
    tg.expand(); // Full screen
    const user = tg.initDataUnsafe?.user || { id: 'test_user', first_name: 'Local' };

    // --- Data Management (API + LocalStorage Fallback) ---
    const API_URL = ''; // Set this if you have a public server URL

    async function initData() {
        // Try to fetch from server if API_URL exists, else fallback to localStorage
        if (API_URL) {
            try {
                const response = await fetch(`${API_URL}/api/user/${user.id}`);
                const data = await response.json();
                localStorage.setItem('wingo_user_data', JSON.stringify(data));
            } catch (e) { console.log("Server fetch failed, using local storage"); }
        }
        
        if (!localStorage.getItem('wingo_user_data')) {
            const initialData = {
                balance: 3170.69,
                totalDeposited: 1000,
                currentTurnover: 0,
                turnoverTarget: 2000,
                isBlocked: false,
                requests: [
                    { id: 'REQ1', userId: user.id, type: 'Deposit', amount: 500, method: 'UPI', status: 'Pending' },
                    { id: 'REQ2', userId: user.id, type: 'Withdraw', amount: 1200, method: 'USDT', status: 'Pending' }
                ]
            };
            localStorage.setItem('wingo_user_data', JSON.stringify(initialData));
        }
    }
    initData();

    function getData() {
        return JSON.parse(localStorage.getItem('wingo_user_data'));
    }

    function saveData(data) {
        localStorage.setItem('wingo_user_data', JSON.stringify(data));
        updateUI();
    }

    // --- State Variables ---
    let userData = getData();
    let currentMode = 60; // Default 1 Min
    let activeTab = 'game';
    let currentBetAmount = 10;
    let canBet = true;

    // Game history state
    const gameData = {
        60: {
            timeLeft: 60,
            currentPeriod: 20240518000124,
            history: [
                { period: 20240518000123, number: 7, size: 'Big', color: 'green' },
                { period: 20240518000122, number: 2, size: 'Small', color: 'red' },
                { period: 20240518000121, number: 0, size: 'Small', color: 'violet' }
            ],
            myHistory: []
        },
        120: {
            timeLeft: 120,
            currentPeriod: 20240518000500,
            history: [
                { period: 20240518000499, number: 1, size: 'Small', color: 'green' },
                { period: 20240518000498, number: 8, size: 'Big', color: 'red' }
            ],
            myHistory: []
        }
    };

    // --- DOM Elements ---
    const timerDisplay = document.querySelector('.timer');
    const historyBody = document.getElementById('history-body');
    const tableHead = document.getElementById('table-head');
    const balanceDisplay = document.querySelector('.amount');
    const refreshBtn = document.querySelector('.refresh-btn');
    const gameModes = document.querySelectorAll('.game-mode');
    const tabs = document.querySelectorAll('.tab');
    const betButtons = document.querySelectorAll('[data-bet]');
    const betStatus = document.getElementById('bet-status');
    const amtButtons = document.querySelectorAll('.btn-amt');
    const customAmtBtn = document.getElementById('custom-amt-btn');
    const customInputContainer = document.getElementById('custom-input-container');
    const customBetInput = document.getElementById('custom-bet-input');
    const bettingSection = document.querySelector('.betting-section');
    const modal = document.getElementById('result-modal');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');

    // --- Sync with Admin (Live) ---
    window.addEventListener('storage', (e) => {
        if (e.key === 'wingo_user_data') {
            userData = getData();
            updateUI();
            checkBlockStatus();
        }
    });

    function checkBlockStatus() {
        if (userData.isBlocked) {
            document.body.innerHTML = `<div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #ff1744; text-align: center; padding: 20px; font-family: sans-serif;">
                <div>
                    <i class="fas fa-user-slash" style="font-size: 80px; margin-bottom: 20px;"></i>
                    <h1>ACCOUNT BLOCKED</h1>
                    <p style="margin-top: 10px; color: #888;">Your account has been suspended by admin.</p>
                    <button onclick="location.reload()" style="margin-top:20px; padding:10px 20px; background:var(--yellow); border:none; border-radius:5px; cursor:pointer;">Retry</button>
                </div>
            </div>`;
        }
    }
    checkBlockStatus();

    // --- Initialization ---
    updateUI();
    startTimer();

    // --- Bet Amount Selection ---
    amtButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            amtButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.id === 'custom-amt-btn') {
                customInputContainer.style.display = 'block';
                currentBetAmount = parseInt(customBetInput.value) || 0;
            } else {
                customInputContainer.style.display = 'none';
                currentBetAmount = parseInt(btn.getAttribute('data-amount'));
            }
        });
    });

    customBetInput.addEventListener('input', () => {
        currentBetAmount = parseInt(customBetInput.value) || 0;
    });

    // --- Core Functions ---

    function startTimer() {
        setInterval(() => {
            const data = gameData[currentMode];
            data.timeLeft--;
            
            const bettingWindow = (currentMode === 60) ? 10 : 30;
            const elapsed = currentMode - data.timeLeft;
            
            if (elapsed <= bettingWindow) {
                canBet = true;
                bettingSection.classList.remove('betting-disabled');
                timerDisplay.classList.remove('waiting');
            } else {
                canBet = false;
                bettingSection.classList.add('betting-disabled');
                timerDisplay.classList.add('waiting');
            }

            if (data.timeLeft < 0) {
                data.timeLeft = currentMode;
                processGameResult(currentMode);
            }
            
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const data = gameData[currentMode];
        const minutes = Math.floor(data.timeLeft / 60);
        const seconds = data.timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
    }

    function processGameResult(mode) {
        const data = gameData[mode];
        userData = getData();
        
        let numberPayouts = new Array(10).fill(0);
        data.myHistory.forEach(bet => {
            if (bet.period === data.currentPeriod && bet.status === 'Pending') {
                for (let n = 0; n <= 9; n++) {
                    let win = false;
                    let mult = 0;
                    let nCol = (n === 0 || n === 5) ? 'violet' : ([1, 3, 7, 9].includes(n) ? 'green' : 'red');
                    let nSize = (n >= 5) ? 'Big' : 'Small';
                    if (bet.type === 'color' && bet.selection === nCol) { win = true; mult = 2.0; }
                    else if (bet.type === 'size' && bet.selection === nSize) { win = true; mult = 1.8; }
                    else if (bet.type === 'number' && bet.selection == n) { win = true; mult = 3.0; }
                    if (win) numberPayouts[n] += (bet.amount * mult);
                }
            }
        });

        for (let n = 0; n <= 9; n++) {
            let dummy = Math.floor(Math.random() * 1000) + 500;
            if (n % 2 === 0) dummy *= 2.3;
            numberPayouts[n] += dummy;
        }

        let winningNumber = 0;
        let minPayout = numberPayouts[0];
        for (let n = 1; n <= 9; n++) {
            if (numberPayouts[n] < minPayout) { minPayout = numberPayouts[n]; winningNumber = n; }
        }

        const number = winningNumber;
        let color = (number === 0 || number === 5) ? 'violet' : ([1, 3, 7, 9].includes(number) ? 'green' : 'red');
        const size = (number >= 5) ? 'Big' : 'Small';
        const result = { period: data.currentPeriod, number, size, color };

        data.history.unshift(result);
        if (data.history.length > 20) data.history.pop();

        let totalWin = 0;
        let lastBet = null;

        data.myHistory.forEach(bet => {
            if (bet.period === data.currentPeriod && bet.status === 'Pending') {
                let win = false;
                let mult = 0;
                if (bet.type === 'color' && bet.selection === color) { win = true; mult = 2.0; }
                else if (bet.type === 'size' && bet.selection === size) { win = true; mult = 1.8; }
                else if (bet.type === 'number' && bet.selection == number) { win = true; mult = 3.0; }
                bet.status = win ? 'Win' : 'Loss';
                bet.resultNum = number;
                if (win) {
                    const winAmt = bet.amount * mult;
                    totalWin += winAmt;
                    userData.balance += winAmt;
                }
                lastBet = bet;
            }
        });

        saveData(userData);

        if (lastBet && mode === currentMode) {
            showResultPopup(totalWin > 0, totalWin, lastBet.amount, lastBet.period);
        }

        data.currentPeriod++;
        if (currentMode === mode) updateUI();
    }

    function showResultPopup(isWin, winAmt, betAmt, period) {
        modal.style.display = 'flex';
        if (isWin) {
            modalIcon.innerHTML = '🎉';
            modalTitle.textContent = 'Congratulations!';
            modalTitle.style.color = 'var(--green)';
            modalMessage.innerHTML = `You won <b>₹${winAmt.toFixed(2)}</b><br>Bet Amount: ₹${betAmt}<br>Bet ID: ${period}`;
        } else {
            modalIcon.innerHTML = '💔';
            modalTitle.textContent = 'Better Luck Next Time';
            modalTitle.style.color = 'var(--red)';
            modalMessage.innerHTML = `You loss bet<br>Amount: ₹${betAmt}<br>Bet ID: ${period}`;
        }
    }

    window.closeModal = () => { modal.style.display = 'none'; };

    function updateUI() {
        userData = getData();
        balanceDisplay.textContent = userData.balance.toFixed(2);
        updateHistoryTable();
    }

    function updateHistoryTable() {
        const data = gameData[currentMode];
        historyBody.innerHTML = '';
        if (activeTab === 'game') {
            tableHead.innerHTML = `<tr><th>Period</th><th>Number</th><th>Big/Small</th><th>Color</th></tr>`;
            data.history.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${item.period}</td><td class="num ${item.color}">${item.number}</td><td>${item.size}</td><td><span class="dot ${item.color}"></span></td>`;
                historyBody.appendChild(row);
            });
        } else {
            tableHead.innerHTML = `<tr><th>Period</th><th>Selection</th><th>Result</th><th>Status</th></tr>`;
            data.myHistory.forEach(item => {
                const statusClass = `status-${item.status.toLowerCase()}`;
                const row = document.createElement('tr');
                row.innerHTML = `<td>${item.period}</td><td>${item.selection}</td><td>${item.resultNum !== undefined ? item.resultNum : '-'}</td><td class="my-history-status ${statusClass}">${item.status}</td>`;
                historyBody.appendChild(row);
            });
        }
    }

    gameModes.forEach(mode => {
        mode.addEventListener('click', () => {
            const newMode = parseInt(mode.getAttribute('data-duration'));
            if (newMode === currentMode) return;
            gameModes.forEach(m => m.classList.remove('active'));
            mode.classList.add('active');
            currentMode = newMode;
            updateUI();
        });
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.getAttribute('data-tab');
            updateHistoryTable();
        });
    });

    betButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (userData.isBlocked) return;
            if (!canBet) { betStatus.textContent = "Betting time over!"; return; }
            const selection = btn.getAttribute('data-bet');
            const amount = currentBetAmount;
            if (amount <= 0) { betStatus.textContent = "Please enter a valid amount!"; return; }
            userData = getData();
            if (userData.balance < amount) { betStatus.textContent = "Insufficient Balance!"; return; }
            let type = '';
            if (btn.classList.contains('btn-color')) type = 'color';
            else if (btn.classList.contains('btn-size')) type = 'size';
            else if (btn.classList.contains('btn-num')) type = 'number';
            const data = gameData[currentMode];
            data.myHistory.unshift({ period: data.currentPeriod, selection, type, amount, status: 'Pending' });
            userData.balance -= amount;
            userData.currentTurnover += amount;
            saveData(userData);
            betStatus.textContent = `Bet placed on ${selection} (₹${amount})`;
            setTimeout(() => { betStatus.textContent = ''; }, 3000);
            if (activeTab === 'my') updateHistoryTable();
        });
    });

    refreshBtn.addEventListener('click', () => {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => { refreshBtn.style.transform = 'rotate(0deg)'; updateUI(); }, 500);
    });
});
