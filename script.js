document.addEventListener('DOMContentLoaded', () => {
    // --- Telegram WebApp Setup ---
    const tg = window.Telegram.WebApp;
    tg.expand();
    const tgUser = tg.initDataUnsafe?.user || { id: 'test_user', first_name: 'Local Player' };

    // --- Firebase Configuration (User needs to fill their actual config here) ---
    // NOTE: For now, I will use a logic that works with localStorage but is ready for Firebase.
    // To make it truly live with Firebase, user just needs to paste their config and initialize.
    
    /* 
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        databaseURL: "https://YOUR_PROJECT.firebaseio.com",
        projectId: "YOUR_PROJECT",
        storageBucket: "YOUR_PROJECT.appspot.com",
        messagingSenderId: "YOUR_ID",
        appId: "YOUR_APP_ID"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    */

    // --- Data Management (Automatic Authentication based on Telegram ID) ---
    async function loadUserData() {
        const userId = tgUser.id;
        console.log(`Authenticating user: ${tgUser.first_name} (${userId})`);

        // Check if user exists in localStorage (Simulating DB lookup by ID)
        let allUsers = JSON.parse(localStorage.getItem('wingo_all_users') || '{}');
        
        if (!allUsers[userId]) {
            // Create New Profile if not exists (Sign Up)
            allUsers[userId] = {
                id: userId,
                name: tgUser.first_name,
                balance: 100.00, // Initial bonus for new user
                totalDeposited: 0,
                currentTurnover: 0,
                turnoverTarget: 0,
                isBlocked: false,
                requests: []
            };
            localStorage.setItem('wingo_all_users', JSON.stringify(allUsers));
        }

        // Set current active user data
        const userData = allUsers[userId];
        localStorage.setItem('wingo_user_data', JSON.stringify(userData));
        return userData;
    }

    function updateUserData(data) {
        const userId = tgUser.id;
        let allUsers = JSON.parse(localStorage.getItem('wingo_all_users') || '{}');
        allUsers[userId] = data;
        localStorage.setItem('wingo_all_users', JSON.stringify(allUsers));
        localStorage.setItem('wingo_user_data', JSON.stringify(data));
        updateUI();
    }

    function getData() {
        return JSON.parse(localStorage.getItem('wingo_user_data'));
    }

    // --- State Variables ---
    let userData;
    let currentMode = 60;
    let activeTab = 'game';
    let currentBetAmount = 10;
    let canBet = true;

    const gameData = {
        60: { timeLeft: 60, currentPeriod: 20240518000124, history: [], myHistory: [] },
        120: { timeLeft: 120, currentPeriod: 20240518000500, history: [], myHistory: [] }
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

    // --- Initialization ---
    (async () => {
        userData = await loadUserData();
        checkBlockStatus();
        updateUI();
        startTimer();
    })();

    window.addEventListener('storage', (e) => {
        if (e.key === 'wingo_all_users') {
            userData = getData();
            updateUI();
            checkBlockStatus();
        }
    });

    function checkBlockStatus() {
        if (userData?.isBlocked) {
            document.body.innerHTML = `<div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #ff1744; text-align: center; padding: 20px; font-family: sans-serif;">
                <div><i class="fas fa-user-slash" style="font-size: 80px; margin-bottom: 20px;"></i><h1>ACCOUNT BLOCKED</h1><p style="margin-top: 10px; color: #888;">Your account has been suspended.</p></div>
            </div>`;
        }
    }

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
            if (data.timeLeft < 0) { data.timeLeft = currentMode; processGameResult(currentMode); }
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const data = gameData[currentMode];
        const min = Math.floor(data.timeLeft / 60);
        const sec = data.timeLeft % 60;
        timerDisplay.textContent = `${min.toString().padStart(2, '0')} : ${sec.toString().padStart(2, '0')}`;
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
        for (let n = 1; n <= 9; n++) { if (numberPayouts[n] < minPayout) { minPayout = numberPayouts[n]; winningNumber = n; } }

        const number = winningNumber;
        let color = (number === 0 || number === 5) ? 'violet' : ([1, 3, 7, 9].includes(number) ? 'green' : 'red');
        const size = (number >= 5) ? 'Big' : 'Small';
        data.history.unshift({ period: data.currentPeriod, number, size, color });
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
                if (win) { totalWin += bet.amount * mult; userData.balance += bet.amount * mult; }
                lastBet = bet;
            }
        });
        updateUserData(userData);
        if (lastBet && mode === currentMode) showResultPopup(totalWin > 0, totalWin, lastBet.amount, lastBet.period);
        data.currentPeriod++;
        if (currentMode === mode) updateUI();
    }

    function showResultPopup(isWin, winAmt, betAmt, period) {
        modal.style.display = 'flex';
        modalIcon.innerHTML = isWin ? '🎉' : '💔';
        modalTitle.textContent = isWin ? 'Congratulations!' : 'Better Luck Next Time';
        modalTitle.style.color = isWin ? 'var(--green)' : 'var(--red)';
        modalMessage.innerHTML = isWin ? `You won <b>₹${winAmt.toFixed(2)}</b><br>Bet Amount: ₹${betAmt}<br>Bet ID: ${period}` : `You loss bet<br>Amount: ₹${betAmt}<br>Bet ID: ${period}`;
    }

    window.closeModal = () => { modal.style.display = 'none'; };

    function updateUI() {
        if (!userData) return;
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
                const row = document.createElement('tr');
                row.innerHTML = `<td>${item.period}</td><td>${item.selection}</td><td>${item.resultNum !== undefined ? item.resultNum : '-'}</td><td class="${`status-${item.status.toLowerCase()}`}">${item.status}</td>`;
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
            if (userData.isBlocked || !canBet) return;
            const selection = btn.getAttribute('data-bet');
            const amount = currentBetAmount;
            if (amount <= 0 || userData.balance < amount) return;
            let type = btn.classList.contains('btn-color') ? 'color' : (btn.classList.contains('btn-size') ? 'size' : 'number');
            const data = gameData[currentMode];
            data.myHistory.unshift({ period: data.currentPeriod, selection, type, amount, status: 'Pending' });
            userData.balance -= amount;
            userData.currentTurnover += amount;
            updateUserData(userData);
            betStatus.textContent = `Bet placed: ₹${amount}`;
            setTimeout(() => { betStatus.textContent = ''; }, 2000);
            if (activeTab === 'my') updateHistoryTable();
        });
    });

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

    refreshBtn.addEventListener('click', () => {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => { refreshBtn.style.transform = 'rotate(0deg)'; updateUI(); }, 500);
    });
});
