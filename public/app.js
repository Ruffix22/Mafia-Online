const socket = io();

let playerId = null;
socket.on('connect', () => {
    playerId = socket.id;
});

let currentPhase = 'Dzień';
let isHost = false;
let hasVoted = false;
let votedFor = null;
let votes = {};
let playersCache = [];
let mutedPlayers = {};
let activePrivateChat = null;
let currentWhisperTarget = null;
let gameTimer = null;
let readyCount = 0;
let amIReady = false;
let roleShown = false;
let spyingPlayerId = null;
let firstLoverId = null;
let confusionActive = false;

// --- LOGIKA LOGOWANIA ---
const joinBtn = document.getElementById('join-btn-new');
const loginContainer = document.getElementById('login-container');
const nicknameInput = document.getElementById('nickname-input');
const hostCheckbox = document.getElementById('is-host-check');
const bgMusic = new Audio('sounds/ambient_main.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.05; // Głośność ustawiona na 15%

if (joinBtn) {
    joinBtn.onclick = () => {
        const playerName = nicknameInput.value.trim();
        isHost = hostCheckbox.checked;

        if (playerName === "") {
            alert("Musisz podać imię, agencie!");
            return;
        }

        // Ustawienie roli gospodarza wizualnie
        if (isHost) {
            document.body.classList.add('is-host');
        }
		
		// 🔥 START MUZYKI (Zaraz po walidacji imienia)
        bgMusic.play().catch(error => {
            console.log("Autoplay zablokowany lub brak pliku:", error);
        });

        // Wysłanie danych do serwera
        socket.emit('joinGame', { name: playerName, isHost: isHost });
        socket.emit('requestMyCards', playerName);

        // Efektowne przejście
        loginContainer.style.opacity = "0";
        loginContainer.style.transition = "opacity 0.5s ease";

        setTimeout(() => {
            loginContainer.style.display = 'none';
            document.body.classList.remove('phase-lobby');
            document.body.classList.add('phase-day');
            
            // Pokazujemy główne elementy gry
            document.querySelector('.main-game-area').style.display = 'flex';
            document.getElementById('inventory-center').style.display = 'block'; 
            
            // --- LOGIKA PANELI BOCZNYCH I NARZĘDZI ---
            const sideBar = document.getElementById('coin-toss-container');
            const utilityTools = document.getElementById('utility-tools');

            if (isHost) {
                // HOST: Widzi wszystko
                if (sideBar) sideBar.style.display = 'grid';
                if (utilityTools) utilityTools.style.display = 'flex';
                document.getElementById('top-bar').style.display = 'flex';
            } else {
                // GRACZ: Całkowicie ukrywamy czarny pasek (sidebar)
                if (sideBar) {
                    sideBar.style.display = 'none'; // To usuwa czarny pasek u gracza
                }

                // Ukrywamy pasek górny
                const topBar = document.getElementById('top-bar');
                if (topBar) topBar.style.display = 'none';

                // Pokazujemy narzędzia (Notatnik/Skip), które teraz są pod czatem
                if (utilityTools) {
                    utilityTools.style.display = 'flex';
                }

                // Dodatkowe upewnienie się, że przyciski wewnątrz są widoczne
                const noteBtn = document.getElementById('notebook-btn');
                const skipBtn = document.getElementById('skip-phase-btn');
                if (noteBtn) noteBtn.style.display = 'flex';
                if (skipBtn) skipBtn.style.display = 'flex';
            }
        }, 500);
    };
}

// --- LOGIKA KOŃCZENIA GRY (Dla Hosta) ---
const endGameBtn = document.getElementById('end-game-btn');
const winnerModal = document.getElementById('winner-selection-modal');
const winCityBtn = document.getElementById('win-city-btn');
const winMafiaBtn = document.getElementById('win-mafia-btn');
const closeWinnerModal = document.getElementById('close-winner-modal');

if (endGameBtn) {
    endGameBtn.onclick = () => {
        if (isHost) winnerModal.style.display = 'flex';
    };
}

if (closeWinnerModal) {
    closeWinnerModal.onclick = () => {
        winnerModal.style.display = 'none';
    };
}

if (winCityBtn) {
    winCityBtn.onclick = () => {
        socket.emit('endGameRequest', 'Miasto');
        winnerModal.style.display = 'none';
    };
}

if (winMafiaBtn) {
    winMafiaBtn.onclick = () => {
        socket.emit('endGameRequest', 'Mafia');
        winnerModal.style.display = 'none';
    };
}

const wheelBtn = document.getElementById('wheel-btn');
const wheelOverlay = document.getElementById('wheel-overlay');
const wheelCanvas = document.getElementById('wheel-canvas');
const winnerText = document.getElementById('wheel-winner-text');
const wheelControls = document.getElementById('wheel-controls');

const aliveDiv = document.getElementById('alive-players');
const deadDiv = document.getElementById('dead-players');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');

const dayBtn = document.getElementById('day-btn');
const nightBtn = document.getElementById('night-btn');
const startVotingBtn = document.getElementById('start-voting-btn');
const endVotingBtn = document.getElementById('end-voting-btn');
const startGameBtn = document.getElementById('start-game-btn');

const chatTabsContainer = document.querySelector('.chat-tabs');
const cardsPanel = document.getElementById('cards-panel');

// MONETA
const coinContainer = document.getElementById('coin-toss-container');
const coinBtn = document.getElementById('coin-btn');

if (isHost) {
    if (coinContainer) coinContainer.style.display = 'flex';
	if (coinBtn) coinBtn.style.display = 'block';
	if (wheelBtn) wheelBtn.style.display = 'block';
	
	const deadTalkBtn = document.getElementById('dead-talk-btn');
	if (deadTalkBtn) deadTalkBtn.style.display = 'block';
}

// app.js - Obsługa przycisku monety u Hosta
if (coinBtn) {
    coinBtn.onclick = () => {
        // Tworzymy proste menu wyboru typu rzutu
        const menu = document.createElement('div');
        menu.id = 'coin-selector-menu';
        menu.className = 'modal-overlay';
        menu.style.zIndex = "10002"; // Nad innymi elementami

        menu.innerHTML = `
            <div class="modal-content" style="border: 2px solid gold; background: #1a1a1a;">
                <h3 style="color: gold; margin-bottom: 20px;">WYBIERZ RODZAJ RZUTU</h3>
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <div onclick="startCoinToss('don')" style="cursor:pointer; text-align:center;">
                        <div style="width:100px; height:140px; background-image:url('cards/don_decision.png'); background-size:cover; border-radius:10px; border:1px solid #555;"></div>
                        <p style="font-size:12px; margin-top:5px;">DECYZJA DONA</p>
                    </div>
                    <div onclick="startCoinToss('luck')" style="cursor:pointer; text-align:center;">
                        <div style="width:100px; height:140px; background-image:url('cards/luck_shot.png'); background-size:cover; border-radius:10px; border:1px solid #555;"></div>
                        <p style="font-size:12px; margin-top:5px;">ŁUT SZCZĘŚCIA</p>
                    </div>
                </div>
                <button onclick="document.getElementById('coin-selector-menu').remove()" style="margin-top:20px; background:#444; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">Anuluj</button>
            </div>
        `;
        document.body.appendChild(menu);
    };
}

// Funkcja pomocnicza do wysłania sygnału
window.startCoinToss = function(type) {
    socket.emit('tossCoin', { hostId: playerId, type: type });
    const menu = document.getElementById('coin-selector-menu');
    if (menu) menu.remove();
    if (coinBtn) coinBtn.classList.add('coin-spin');
    setTimeout(() => { if(coinBtn) coinBtn.classList.remove('coin-spin') }, 600);
};

// Obiekt przechowujący nasze dźwięki
const gameSounds = {
    day: new Audio('sounds/day.mp3'),
    night: new Audio('sounds/night.mp3')
};

// Funkcja pomocnicza do puszczania dźwięku
function playPhaseSound(phase) {
    if (gameSounds[phase]) {
        // Resetujemy dźwięk do początku (na wypadek, gdyby faza zmieniła się szybko)
        gameSounds[phase].currentTime = 0;
        // Odtwarzamy
        gameSounds[phase].play().catch(e => console.log("Autoplay zablokowany: Gracz musi kliknąć coś na stronie najpierw."));
    }
}

// Obsługa przycisku Trybuny (czaszki)
const deadTalkBtn = document.getElementById('dead-talk-btn');
if (deadTalkBtn) {
    deadTalkBtn.onclick = () => {
        socket.emit('toggleDeadTalk');
    };
}

// KOŁO FORTUNY
if (isHost && wheelBtn) {
    wheelBtn.style.display = 'block';
}

// app.js - Podmień obsługę kliknięcia wheelBtn
if (wheelBtn) {
    wheelBtn.onclick = () => {
        // Tworzymy menu wyboru grupy do losowania
        const menu = document.createElement('div');
        menu.id = 'wheel-selector-menu';
        menu.className = 'modal-overlay';
        menu.style.zIndex = "10002";

        menu.innerHTML = `
            <div class="modal-content" style="border: 2px solid #5c1cff; background: #1a1a1a; padding: 30px;">
                <h3 style="color: #5c1cff; margin-bottom: 20px;">KOGO LOSUJEMY?</h3>
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <div onclick="initiateWheel('alive')" style="cursor:pointer; text-align:center;">
                        <div style="width:120px; height:120px; border: 3px solid #2ecc71; border-radius:50%; display:flex; align-items:center; justify-content:center; background: rgba(46, 204, 113, 0.1);">
                            <span style="font-size: 40px;">👥</span>
                        </div>
                        <p style="color:#2ecc71; margin-top:10px; font-weight:bold;">ŻYWI</p>
                    </div>
                    <div onclick="initiateWheel('dead')" style="cursor:pointer; text-align:center;">
                        <div style="width:120px; height:120px; border: 3px solid #e74c3c; border-radius:50%; display:flex; align-items:center; justify-content:center; background: rgba(231, 76, 60, 0.1);">
                            <span style="font-size: 40px;">💀</span>
                        </div>
                        <p style="color:#e74c3c; margin-top:10px; font-weight:bold;">MARTWI</p>
                    </div>
                </div>
                <button onclick="document.getElementById('wheel-selector-menu').remove()" style="margin-top:20px; background:#444; color:white; border:none; padding:8px 20px; border-radius:5px; cursor:pointer;">Anuluj</button>
            </div>
        `;
        document.body.appendChild(menu);
    };
}

// Funkcja wywołująca właściwe losowanie
window.initiateWheel = function(group) {
    let filteredPlayers = [];
    if (group === 'alive') {
        filteredPlayers = playersCache.filter(p => p.alive && !p.isHost);
    } else {
        filteredPlayers = playersCache.filter(p => !p.alive && !p.isHost);
    }

    if (filteredPlayers.length === 0) {
        alert("Brak graczy w wybranej grupie!");
        return;
    }

    // Usuwamy menu i otwieramy koło
    document.getElementById('wheel-selector-menu').remove();
    wheelOverlay.style.display = 'flex';
    drawWheel(filteredPlayers);

    const randomAngle = Math.floor(Math.random() * 360) + 1440;
    socket.emit('startWheelSpin', {
        alivePlayers: filteredPlayers, // nazwa klucza zostaje stara, żeby nie psuć reszty kodu
        finalAngle: randomAngle
    });
};

// Obsługa przycisku zamknij
const closeWheelBtn = document.getElementById('close-wheel-btn');
if (closeWheelBtn) {
    closeWheelBtn.onclick = () => {
        wheelOverlay.style.display = 'none';
    };
}

function runPhaseTimer(seconds, label) {
    clearInterval(gameTimer);
    
    const topTimer = document.getElementById('top-timer');
    const timerValue = document.getElementById('timer-value');
    const timerLabel = document.getElementById('timer-label');

    // 1. Resetujemy widok przed animacją
    topTimer.style.display = 'block'; // Pokazujemy
    topTimer.classList.remove('move-to-top'); // Usuwamy klasę góry (wraca na środek)
    
    // Ustawiamy tekst i początkowy czas
    if (timerLabel) timerLabel.innerText = label; 
    let timeLeft = seconds;

    const updateDisplay = (time) => {
        let mins = Math.floor(time / 60);
        let secs = time % 60;
        timerValue.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    updateDisplay(timeLeft);

    // Odpalamy licznik
    gameTimer = setInterval(() => {
        timeLeft--;
        updateDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            if (isHost) {
                // Host przesuwa fazę po czasie
                if (label === "Dyskusja") socket.emit('startVoting', playerId);
                if (label === "Głosowanie") socket.emit('changePhase', 'Noc', playerId);
                if (label === "Noc") socket.emit('changePhase', 'Dzień', playerId);
            }
        }
    }, 1000);

    // --- KLUCZOWY MOMENT ANIMACJI ---
    // Po 4 sekundach "wyrzucamy" timer na górę ekranu
    setTimeout(() => {
        topTimer.classList.add('move-to-top');
    }, 4000); // 4000ms = 4 sekundy
}

//////////////////////////////////////////////////////
// 🔥 WYSYŁANIE WIADOMOŚCI Z BLOKADĄ WYCIŚNIĘCIA
//////////////////////////////////////////////////////
sendBtn.onclick = async ()=>{
    let msg = messageInput.value.trim();
    if(!msg) return;

    const me = playersCache.find(p => p.id === playerId);
	if(me && !me.alive && !deadTalkActive){
		await showModal("Błąd!", "Nie żyjesz — nie możesz pisać na czacie!", false);
		return;
	}
	
    // 🔇 Sprawdzenie wyciszenia
    if(mutedPlayers[playerId]){
        await showModal("Wyciszenie!", "Jesteś wyciszony i nie możesz pisać na czatach!", false);
        return;
    }

    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    let to=null;

    if(activeTab==='private' && activePrivateChat){
        to = activePrivateChat.playerId;
    }

    if(!isHost && activeTab==='city' && currentPhase!=='Dzień'){
        await showModal("Możesz pisać tylko w dzień!", false);
        return;
    }

    if(!isHost && activeTab==='mafia' && currentPhase!=='Noc'){
        await showModal("Możesz pisać tylko w nocy!", false);
        return;
    }

    socket.emit('sendMessage',{
        msg,
        from:playerName,
        type:activeTab,
        to
    });

    messageInput.value='';
};

function showRoleReveal(role) {
    const overlay = document.getElementById('role-reveal-overlay');
    const textElement = document.getElementById('role-reveal-text');
    
    // Tworzymy dużą kartę do prezentacji, jeśli nie istnieje
    let cardImg = document.getElementById('role-reveal-card');
    if (!cardImg) {
        cardImg = document.createElement('div');
        cardImg.id = 'role-reveal-card';
        cardImg.style.width = '240px';
        cardImg.style.height = '340px';
        cardImg.style.marginTop = '20px';
        cardImg.style.backgroundSize = 'cover';
        cardImg.style.backgroundPosition = 'center';
        cardImg.style.borderRadius = '15px';
        cardImg.style.transition = 'all 0.8s ease-in-out'; // Płynne przejście
        overlay.appendChild(cardImg);
    }

	// Konfiguracja kolorów i ścieżek
    let imgPath, roleColor;
	const currentRole = role ? role.toLowerCase() : "";

    if (currentRole === 'gospodarz' || currentRole === 'host') {
        imgPath = 'images/host.png';
        roleColor = '#d4af37'; // Złoty
    } else if (role === 'Mafia') {
        imgPath = 'images/mafia.png';
        roleColor = '#e74c3c';
    } else {
        imgPath = 'images/city.png';
        roleColor = '#3498db';
    }

    textElement.innerText = `TWOJA ROLA: ${role.toUpperCase()}`;
    textElement.style.color = roleColor;
    cardImg.style.backgroundImage = `url('${imgPath}')`;
    cardImg.style.border = `2px solid ${roleColor}`;
    cardImg.style.boxShadow = `0 0 40px ${roleColor}66`;

    // Start animacji (pojawienie się)
    cardImg.style.transform = 'scale(0.5)';
    cardImg.style.opacity = '0';
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';

    setTimeout(() => {
        cardImg.style.transform = 'scale(1)';
        cardImg.style.opacity = '1';
    }, 100);

    // --- KLUCZOWY MOMENT: PRZEJŚCIE DO MINIATURKI ---
    setTimeout(() => {
        // 1. Znajdujemy pozycję docelową mini-karty (nawet jeśli jest ukryta)
        let miniCard = document.getElementById('mini-role-card');
        if (!miniCard) {
            miniCard = document.createElement('div');
            miniCard.id = 'mini-role-card';
            document.body.appendChild(miniCard);
        }

        // 2. Animujemy dużą kartę w stronę miejsca miniatury
        const rect = miniCard.getBoundingClientRect();
        cardImg.style.position = 'fixed';
        cardImg.style.left = `${rect.left}px`;
        cardImg.style.top = `${rect.top}px`;
        cardImg.style.width = '120px';
        cardImg.style.height = '170px';
        cardImg.style.transform = 'scale(1)';
        cardImg.style.opacity = '0'; // Powolne wygaszanie w locie

        overlay.style.opacity = '0';

        setTimeout(() => {
            overlay.style.display = 'none';
            
            // 3. Pokazujemy właściwą mini-kartę na stałe
            miniCard.style.display = 'block';
            miniCard.style.backgroundImage = `url('${imgPath}')`;
            miniCard.style.borderColor = roleColor;
            miniCard.style.boxShadow = `0 0 15px ${roleColor}44`;
        }, 800);

    }, 4000); // Czas pokazywania roli
}

//////////////////////////////////////////////////////
// 🔥 ZAKŁADKI CZATU - NAPRAWIONE
//////////////////////////////////////////////////////
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.getAttribute('data-tab');

        // 1. Przełączanie klasy na przyciskach
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 2. Ukrywanie wszystkich czatów (usuwamy klasę active)
        document.querySelectorAll('.chat-messages').forEach(div => div.classList.remove('active'));

        // 3. Wyznaczenie ID i pokazanie właściwego czatu
        const divId = (btn.dataset.tab === 'private' && typeof activePrivateChat !== 'undefined' && activePrivateChat)
            ? 'chat-messages-private-' + activePrivateChat.playerId
            : 'chat-messages-' + btn.dataset.tab;

        const targetDiv = document.getElementById(divId);
        if (targetDiv) {
            targetDiv.classList.add('active'); // Dodajemy klasę, którą obsłuży CSS
            targetDiv.scrollTop = targetDiv.scrollHeight;
        }
    };
});

function renderPlayersWithVotes() {
    if (!aliveDiv || !deadDiv) return;
    aliveDiv.innerHTML = '';
    deadDiv.innerHTML = '';

    playersCache.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player' + (p.alive ? '' : ' dead');
        const iconBaseStyle = 'cursor:pointer; font-size: 1.3em; display: inline-block; transform: scale(1.2); margin: 0 2px; transition: transform 0.2s;';

        let roleLabel = '', roleClass = '', roleEmoji = '';
        const meLocal = playersCache.find(ptr => ptr.id === playerId);
        const isMyLover = meLocal && meLocal.isInLove && p.id === meLocal.loverId;
        
        if (p.exposed) { roleLabel = 'MAFIA 🔍'; roleClass = 'role-mafia'; roleEmoji = '🔴'; }
        else if (p.isPurified) { roleLabel = 'MIASTO ✨'; roleClass = 'role-city'; roleEmoji = '🟢'; }
        else if (p.isHost && p.id === playerId) { roleLabel = 'HOST'; roleClass = 'role-host'; roleEmoji = '👑'; }
        else if (isHost) {
            if (p.role === 'Mafia') { roleLabel = 'MAFIA'; roleClass = 'role-mafia'; roleEmoji = '🔴'; }
            else if (p.role === 'Miasto') { roleLabel = 'MIASTO'; roleClass = 'role-city'; roleEmoji = '🟢'; }
            else if (p.role === 'Gospodarz') { roleLabel = 'HOST'; roleClass = 'role-host'; roleEmoji = '👑'; }
            else { roleLabel = 'Brak roli'; roleClass = 'role-none'; }
        } else {
            if (p.id === playerId || isMyLover) {
                if (p.role === 'Mafia') { roleLabel = isMyLover ? 'MAFIA (KOCHANEK)' : 'MAFIA'; roleClass = 'role-mafia'; roleEmoji = '🔴'; }
                else if (p.role === 'Miasto') { roleLabel = isMyLover ? 'MIASTO (KOCHANEK)' : 'MIASTO'; roleClass = 'role-city'; roleEmoji = '🟢'; }
                else { roleLabel = 'Brak roli'; roleClass = 'role-none'; }
            } else if (p.isHost) { roleLabel = 'HOST'; roleClass = 'role-host'; roleEmoji = '👑'; }
            else { roleLabel = ''; }
        }

        const voteCounts = {};
        Object.entries(votes).forEach(([voterId, targetId]) => {
            const voter = playersCache.find(v => v.id === voterId);
            const weight = (voter && voter.doubleVote) ? 2 : 1;
            voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
        });
        let voteCount = voteCounts[p.id] ? ` 🗳️(${voteCounts[p.id]})` : '';

        let loveHeart = '';
        if (p.isInLove) {
            if (isHost || (meLocal && meLocal.isInLove && (p.id === meLocal.loverId || p.id === playerId))) {
                loveHeart = ' <span style="color: #ff69b4; text-shadow: 0 0 5px #ff69b4;">🩷</span>';
            }
        }
		
		let statusIcons = '';
        if (p.protected) statusIcons += ' <span title="Chroniony">🛡️</span>';
        if (p.doubleVote) statusIcons += ' <span title="Podwójny głos">⚖️</span>';
        if (p.isMuted) statusIcons += ' <span title="Wyciszony">🔇</span>';
		if (p.canGhostTalk) statusIcons += ' ✨';
        if (p.isGodfather) statusIcons += ' <span title="Ojciec Chrzestny">🎩</span>';

        div.innerHTML = `<span>${p.name}${loveHeart}${statusIcons} <span class="${roleClass}"> ${roleEmoji} ${roleLabel} </span> ${voteCount}</span>`;

        if (!isHost && p.alive && p.id !== playerId && !p.isHost && !(meLocal && meLocal.isMuted)) {
            const vBtn = document.createElement('span');
            vBtn.innerHTML = ' 🗳️'; vBtn.style.marginLeft = '10px'; vBtn.style.cursor = 'pointer';
            vBtn.onclick = () => vote(p.id, p.name);
            div.appendChild(vBtn);
        }
		
		if (currentPhase === 'Noc' && meLocal.role === 'Mafia' && p.role !== 'Mafia' && p.alive) {
			const amIGodfather = (godfatherId === playerId);
			const isAnyGodfatherSet = (godfatherId !== null && godfatherId !== undefined);
			
			if (!isAnyGodfatherSet || amIGodfather) {
				const mBtn = document.createElement('span');
				mBtn.innerHTML = ' 🎯';
				mBtn.style.marginLeft = '10px';
				mBtn.style.cursor = 'pointer';
				mBtn.title = "Wybierz cel dla Mafii";
				mBtn.onclick = () => socket.emit('mafiaVote', p.id);
				div.appendChild(mBtn);
			}
		}

        if (isHost && !p.isHost) {
            const mutedIcon = p.isMuted ? '🔇' : '🎤';
            const eyeStyle = (spyingPlayerId === p.id) ? `${iconBaseStyle} color: #ff4d4d; filter: drop-shadow(0 0 5px red);` : `${iconBaseStyle} opacity: 0.8;`;
            const protectStyle = p.protected ? `${iconBaseStyle} color: #fff; filter: drop-shadow(0 0 8px #00d4ff);` : `${iconBaseStyle} opacity: 0.5;`;
            const vStyle = p.doubleVote ? `${iconBaseStyle} color: gold; filter: drop-shadow(0 0 8px yellow); opacity: 1;` : `${iconBaseStyle} opacity: 0.5;`;
            const seanceStyle = p.canGhostTalk ? `${iconBaseStyle} color: #9b59b6; filter: drop-shadow(0 0 8px #9b59b6); opacity: 1;` : `${iconBaseStyle} opacity: 0.5;`;
            const godfatherStyle = (p.id === godfatherId) ? `${iconBaseStyle} color: #fff; filter: drop-shadow(0 0 8px #000); transform: scale(1.5);` : `${iconBaseStyle} opacity: 0.5;`;
            const loveStyle = p.isInLove ? `${iconBaseStyle} color: #ff69b4; filter: drop-shadow(0 0 8px #ff69b4); opacity: 1;` : (firstLoverId === p.id ? `${iconBaseStyle} color: #ff69b4; opacity: 0.6; transform: scale(1.4);` : `${iconBaseStyle} opacity: 0.5;`);

            div.innerHTML += `
			    <div class="player-buttons" style="display: flex; align-items: center; margin-left: 20px;">
				    <span onclick="openHostPanel('${p.id}')" style="cursor:pointer; font-size: 1.5em;" title="Zarządzaj graczem">⚙️</span>
				</div>`;

            setTimeout(() => {
                const lBtn = document.getElementById(`love-btn-${p.id}`);
                if (lBtn) lBtn.onclick = () => handleLoveClick(p.id);
            }, 0);
        }

        if (p.alive) aliveDiv.appendChild(div);
        else deadDiv.appendChild(div);
    });
}

function handleEyeClick(targetId) {
    const cardsPanel = document.getElementById('cards-panel');

    if (spyingPlayerId === targetId) {
        // Jeśli klikamy w tę samą osobę -> WYŁĄCZAMY
        spyingPlayerId = null;
        if (cardsPanel) cardsPanel.innerHTML = ''; 
        // Wyświetlamy info w konsoli lub systemie, że zamknięto podgląd
        console.log("Podgląd zamknięty.");
    } else {
        // Jeśli klikamy w nową osobę -> OTWIERAMY
        spyingPlayerId = targetId;
        socket.emit('hostRequestPlayerCards', targetId);
    }
    
    // Odświeżamy listę, żeby ikonka oka zmieniła kolor na czerwony/zwykły
    renderPlayersWithVotes();
}

//////////////////////////////////////////////////////
// 🔥 UPDATE PLAYERS
//////////////////////////////////////////////////////
socket.on('updatePlayers', players => {
    playersCache = players;
	
	const gf = players.find(p => p.isGodfather);
	godfatherId = gf ? gf.id : null;

    // Znajdź "mnie" na liście serwerowej
    const me = players.find(p => p.id === socket.id);

    if (me) {
		// --- LOGIKA STATUSÓW (KLĄTW I DARÓW) ---
        const myStatuses = [];
		
		if (me.protected) myStatuses.push('shield');        
		if (me.exposed || me.isPurified) myStatuses.push('revealed'); 
		if (me.isGodfather) myStatuses.push('godfather');    
		if (me.isMuted) myStatuses.push('muted');          
		if (me.isInLove) myStatuses.push('loved');           
		if (me.doubleVote) myStatuses.push('rep');
		
		updatePlayerStatuses(myStatuses);
		
		
        // Jeśli nie żyjesz (alive === false)
        if (!me.alive) {
            // Dodaj efekty tylko, jeśli jeszcze ich nie ma (żeby nie powtarzać błysku)
            if (!document.body.classList.contains('is-dead')) {
                document.body.classList.add('just-died'); // Czerwony błysk (animacja)
                document.body.classList.add('is-dead');   // Grayscale (stały efekt)
                
                // Po 1.5s usuwamy klasę błysku, żeby nie wisiała w kodzie, 
                // ale is-dead zostaje na stałe
                setTimeout(() => {
                    document.body.classList.remove('just-died');
                }, 1500);
            }
        } else {
            // Jeśli żyjesz (np. po wskrzeszeniu), przywracamy kolory
            document.body.classList.remove('is-dead');
        }
    }

    renderPlayersWithVotes();
});

function openBlackmailMenu(victimId) {
    const victim = playersCache.find(p => p.id === victimId);
    if (!victim) return;

    // Tworzymy tymczasowy panel wyboru celu
    const targetSelector = document.createElement('div');
    targetSelector.id = 'blackmail-target-selector';
    targetSelector.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10001; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
    `;

    let playersHtml = playersCache
        .filter(p => p.alive && !p.isHost && p.id !== victimId)
        .map(p => `
            <button onclick="confirmBlackmail('${victimId}', '${p.id}')" 
                style="width: 300px; padding: 15px; margin: 5px; background: #222; border: 1px solid #c5a059; color: white; cursor: pointer; border-radius: 8px; font-weight: bold;">
                ${p.name}
            </button>
        `).join('');

    targetSelector.innerHTML = `
        <h2 style="color: #c5a059; margin-bottom: 20px;">WYBIERZ CEL SZANTAŻU DLA ${victim.name.toUpperCase()}</h2>
        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 70vh; overflow-y: auto;">
            ${playersHtml}
        </div>
        <button onclick="document.getElementById('blackmail-target-selector').remove()" 
            style="margin-top: 20px; background: #c0392b; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            Anuluj
        </button>
    `;

    document.body.appendChild(targetSelector);
}

// Funkcja pomocnicza do wysłania wyboru
window.confirmBlackmail = function(victimId, targetId) {
    socket.emit('setBlackmail', { victimId, targetId });
    const el = document.getElementById('blackmail-target-selector');
    if (el) el.remove();
    closeHostPanel();
};

function updatePlayerStatuses(activeStatuses) {
    const container = document.getElementById('status-effects-container');
    if (!container) return;

    container.innerHTML = ''; // Czyścimy stare ikony

    const statusMap = {
        'shield': { img: 'shield.png', tip: 'Tarcza: Jesteś chroniony.' },
        'revealed': { img: 'eye.png', tip: 'Ujawniony: Miasto zna Twoją rolę.' },
        'godfather': { img: 'godfather.png', tip: 'Ojciec Chrzestny: Twój głos decyduje w nocy.' },
        'muted': { img: 'mute.png', tip: 'Wyciszony: Nie możesz pisać na czacie.' },
        'loved': { img: 'heart.png', tip: 'Zakochany: Giniesz razem z partnerem.' },
        'rep': { img: 'scales.png', tip: 'Przedstawiciel: Masz podwójny głos.' }
    };

    activeStatuses.forEach(statusKey => {
        const data = statusMap[statusKey];
        if (data) {
            const iconDiv = document.createElement('div');
            iconDiv.className = `status-icon ${statusKey}`;
            iconDiv.style.backgroundImage = `url('icons/${data.img}')`;
            iconDiv.setAttribute('data-tooltip', data.tip);
            container.appendChild(iconDiv);
        }
    });
}

//////////////////////////////////////////////////////
// 🔥 LIVE GŁOSY
//////////////////////////////////////////////////////
socket.on('updateVotes', (allVotes) => {
    const oldVote = votes[playerId]; // sprawdzamy czy mieliśmy głos
    votes = allVotes; 
    
    if(!oldVote && votes[playerId] && votes[playerId] !== 'invalid') {
        const target = playersCache.find(p => p.id === votes[playerId]);
        if(target) showVoteInfo(target.name);
    }

    renderPlayersWithVotes(); 
});

//////////////////////////////////////////////////////
// 🔥 GŁOSOWANIE
//////////////////////////////////////////////////////
function vote(targetId, targetName) {
    // Jeśli serwer przysłał nam już jakiś głos i nie jest to 'invalid', to blokujemy
    if (votes[playerId] && votes[playerId] !== 'invalid') {
        showModal("Już oddałeś głos!", `Twój głos na ${targetName} został już zarejestrowany.`, false);
        return;
    }

    // Wysyłamy prośbę do serwera. Nie ustawiamy nic lokalnie!
    socket.emit('vote', {
        voterId: playerId,
        targetId: targetId
    });
}

function showVoteInfo(name){
    let info = document.getElementById('vote-info');

    if(!info){
        info = document.createElement('div');
        info.id = 'vote-info';
        info.style.position = 'fixed';
        info.style.top = '20px';
        info.style.right = '20px';
        info.style.background = '#222';
        info.style.color = '#fff';
        info.style.padding = '10px 20px';
        info.style.borderRadius = '10px';
        info.style.zIndex = '9999';
		info.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        document.body.appendChild(info);
    }

    info.textContent = `Oddałeś głos na: ${name}`;
	setTimeout(()=>{
		if(info){
			info.remove();
		}
	}, 4000);
}

socket.on('roleRevealed', (role) => {
    console.log("Otrzymano nową rolę od serwera:", role);
    showRoleReveal(role);
});

socket.on('votingStarted', ()=>{
    hasVoted = false;
    votedFor = null;
    votes = {};
	runPhaseTimer(60, "GŁOSOWANIE!");

    const info = document.getElementById('vote-info');
    if(info) info.remove();
	
	renderPlayersWithVotes();
});

//////////////////////////////////////////////////////
// 🔥 TRYBUNAŁ STANU
//////////////////////////////////////////////////////

socket.on('tribunalStarted', async (data) => {
    const btn = document.getElementById('end-tribunal-btn');

    if (isHost) {
        // HOST: Nie głosuje, tylko widzi przycisk z licznikiem
        if (btn) {
            btn.style.display = 'flex';
            btn.innerHTML = '📯 (0)';
            console.log("Przycisk Trybunału aktywowany dla Hosta.");
        }
        addChatMessage("System", `Trybunał rozpoczęty dla: ${data.targetName}. Czekaj na głosy.`, "system");
        
        // Host wychodzi z funkcji tutaj, żeby nie pokazało mu się okno głosowania
        return; 
    }

    // GRACZ: Pokazuje okno głosowania (tylko żywym)
    const me = playersCache.find(p => p.id === playerId);
    if (me && me.alive) {
        const isGuilty = await showModal(
            "🏛️ TRYBUNAŁ STANU",
            `Czy uważasz, że ${data.targetName} jest WINNY zarzucanych mu czynów?`,
            true
        );

        const decision = isGuilty ? 'guilty' : 'innocent';
        socket.emit('castTribunalVote', decision);
        addChatMessage("System", `Oddałeś głos: ${isGuilty ? "WINNY" : "NIEWINNY"}`, "system");
    }
});

// AKTUALIZACJA LICZNIKA DLA HOSTA
socket.on('updateTribunalStatus', (count) => {
    const btn = document.getElementById('end-tribunal-btn');
    if (isHost && btn) {
        btn.innerHTML = `📯 (${count})`;
    }
});

// CHOWANIE PRZYCISKU PO ZAKOŃCZENIU
socket.on('tribunalEnded', () => {
    const btn = document.getElementById('end-tribunal-btn');
    if (btn) btn.style.display = 'none';
});

// Funkcja wywoływana przez kliknięcie ikonki ⚖️ na liście graczy
window.triggerTribunal = function(targetId) {
    const target = playersCache.find(p => p.id === targetId);
    if (!target) return;
    
    showModal("Potwierdzenie", `Czy na pewno chcesz postawić gracza ${target.name} przed Trybunałem Stanu?`, true)
    .then(confirmed => {
        if (confirmed) {
            socket.emit('startTribunal', targetId);
        }
    });
};

// Obsługa kliknięcia w Róg 📯 przez Hosta
const endTribunalBtn = document.getElementById('end-tribunal-btn');
if (endTribunalBtn) {
    endTribunalBtn.onclick = () => {
        socket.emit('endTribunal');
        // Przycisk schowa się automatycznie przez socket 'tribunalEnded'
    };
}

//////////////////////////////////////////////////////
// 🔥 HOST - PRZYCISKI
//////////////////////////////////////////////////////
function toggleAlive(id){ socket.emit('toggleAlive',id,playerId); }
function revive(id){ socket.emit('revive',id,playerId); }
function changeRole(id){ socket.emit('changeRole',id,playerId); }
function toggleProtect(id){ socket.emit('toggleProtect', id, playerId); }

// --- NOWA LOGIKA STARTU GRY Z WYBOREM MAFII ---
startGameBtn.onclick = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'mafia-selector-overlay';

    overlay.innerHTML = `
        <div class="modal-content" style="border: 2px solid #ff5252; min-width: 400px; background: #111;">
            <h2 style="color: #ff5252; margin-top: 0; letter-spacing: 2px;">WYBÓR LICZBY MAFII</h2>
            <p style="color: #ccc; margin-bottom: 25px;">Ilu morderców ma grasować w mieście?</p>
            <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 30px;">
                <button onclick="confirmStartWithMafia(1)" style="background: #222; border: 1px solid #ff5252; color: white; padding: 15px 25px; cursor: pointer; border-radius: 8px; font-weight: bold; font-size: 20px;">1</button>
                <button onclick="confirmStartWithMafia(2)" style="background: #222; border: 1px solid #ff5252; color: white; padding: 15px 25px; cursor: pointer; border-radius: 8px; font-weight: bold; font-size: 20px;">2</button>
                <button onclick="confirmStartWithMafia(3)" style="background: #222; border: 1px solid #ff5252; color: white; padding: 15px 25px; cursor: pointer; border-radius: 8px; font-weight: bold; font-size: 20px;">3</button>
            </div>
            <button onclick="document.getElementById('mafia-selector-overlay').remove()" class="cancel-btn" style="background: #444; border: none; color: white; padding: 10px 20px; border-radius: 5px; cursor: pointer;">ANULUJ</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

// Funkcja wywoływana przez przyciski w panelu
window.confirmStartWithMafia = function(count) {
    socket.emit('startGame', { hostId: playerId, manualMafiaCount: count });
    const overlay = document.getElementById('mafia-selector-overlay');
    if (overlay) overlay.remove();
};
// ----------------------------------------------

dayBtn.onclick = ()=>socket.emit('changePhase','Dzień',playerId);
nightBtn.onclick = ()=>socket.emit('changePhase','Noc',playerId);
startVotingBtn.onclick = ()=>socket.emit('startVoting',playerId);
endVotingBtn.onclick = ()=>socket.emit('endVoting',playerId);

//////////////////////////////////////////////////////
// 🔥 WYCIŚNIĘCIE/ODCIŚNIĘCIE
//////////////////////////////////////////////////////
function toggleMute(id){
    const newState = !mutedPlayers[id];
    mutedPlayers[id] = newState;
    renderPlayersWithVotes();
    socket.emit('toggleMute', {playerId:id, muted:newState});
}

socket.on('updateMute', ({playerId: mutedId, muted})=>{
    mutedPlayers[mutedId] = muted;
    renderPlayersWithVotes();
});

socket.on('gameFinished', ({ winner, finalPlayers }) => {
    const summaryOverlay = document.getElementById('game-summary-overlay');
    const summaryWinnerText = document.getElementById('summary-winner-text');
    const summaryList = document.getElementById('summary-players-list');

    // 1. Filtrowanie: Usuwamy Hosta z końcowej listy
    const playersToDisplay = finalPlayers.filter(p => p.role !== "Gospodarz");

    // 2. Kolory napisu głównego (Zielony dla Miasta, Czerwony dla Mafii)
    summaryWinnerText.innerText = `${winner.toUpperCase()} WYGRYWA!`;
    summaryWinnerText.style.color = winner === 'Mafia' ? '#e74c3c' : '#2ecc71';

    // 3. SORTOWANIE: Zwycięzcy na górę
    const sortedPlayers = [...playersToDisplay].sort((a, b) => {
        const aIsWinner = (winner === 'Mafia' && a.faction === 'Mafia') || (winner === 'Miasto' && a.faction === 'Miasto');
        const bIsWinner = (winner === 'Mafia' && b.faction === 'Mafia') || (winner === 'Miasto' && b.faction === 'Miasto');
        
        if (aIsWinner && !bIsWinner) return -1;
        if (!aIsWinner && bIsWinner) return 1;
        return 0;
    });

    // 4. Budowanie listy HTML
    summaryList.innerHTML = '';
    sortedPlayers.forEach(p => {
        const isWinner = (winner === 'Mafia' && p.faction === 'Mafia') || 
                         (winner === 'Miasto' && p.faction === 'Miasto');
        
        const playerDiv = document.createElement('div');
        playerDiv.className = "summary-item";
        
        // Kolor roli (podpowiedź wizualna)
        const factionColor = p.faction === 'Mafia' ? '#e74c3c' : '#2ecc71';
        
        playerDiv.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${isWinner ? '<span style="color:gold; margin-right:10px; font-size:20px;">👑</span>' : '<span style="margin-right:25px;"></span>'}
                <span style="font-size:18px; font-weight:bold; color: white;">${p.name}</span>
            </div>
            <span style="color:${factionColor}; font-weight:bold; font-size:14px; text-transform:uppercase;">${p.role}</span>
        `;
        summaryList.appendChild(playerDiv);
    });

    // 5. Wyświetlenie całego ekranu
    summaryOverlay.style.display = 'flex';
});


// 1. ODBIERANIE (Zgodne z Twoim server.js linia 159)
socket.off('chatMessage'); // Czyścimy stare nasłuchy
socket.on('chatMessage', (data) => {
    // data to obiekt {msg, from, type}
    if (data && data.msg) {
        appendMessageToChat(data.from, data.msg, data.type || 'city', data.senderId);
    }
});

// 2. FUNKCJA RYSUJĄCA (Zintegrowana z Duchami na Linii)
function appendMessageToChat(sender, text, type = 'city', senderId = null) {
    let targetId = (type === 'private') ? 'chat-messages-private' : 
                   (type === 'mafia' ? 'chat-messages-mafia' : 'chat-messages-city');

    const chatBox = document.getElementById(targetId);
    if (!chatBox) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';

    // --- LOGIKA WYRÓŻNIENIA NADAWCY ---
    let displaySender = sender;
    let senderColor = '#3498db'; // Domyślny niebieski
    let fontWeight = 'bold';
    let isGhost = false;

    // 1. Sprawdzamy czy nadawca jest DUCHEM (martwy z pozwoleniem na mówienie)
    // Szukamy w cache graczy po ID lub nazwie
    const senderData = playersCache.find(p => (senderId && p.id === senderId) || p.name === sender);
    if (senderData && !senderData.alive && senderData.canGhostTalk) {
        isGhost = true;
        senderColor = '#00d4ff'; // Neonowy błękit ducha
        msgDiv.classList.add('ghost-message');
    }

    // 2. Sprawdzamy czy to SYSTEM
    if (type === 'system' || sender === 'System' || sender === 'SYSTEM') {
        displaySender = 'SYSTEM';
        senderColor = '#ff4d4d'; 
        msgDiv.classList.add('system');
    } 
    // 3. Sprawdzamy czy to GOSPODARZ
    else if (sender === 'Gospodarz' || sender === 'GOSPODARZ') {
        displaySender = 'GOSPODARZ';
        senderColor = '#f1c40f'; 
    }

    // 4. Sprawdzanie własnej wiadomości
    const myNickname = nicknameInput ? nicknameInput.value.trim() : "";
    if (sender === myNickname || (isHost && sender === "Gospodarz")) {
        msgDiv.classList.add('own-message');
    }

    // Logika klikania dla Hosta
    if (isHost && type === 'private' && displaySender !== "GOSPODARZ" && senderId) {
        msgDiv.style.border = "1px dashed #777";
        msgDiv.style.cursor = "pointer";
        msgDiv.onclick = () => {
            currentWhisperTarget = senderId;
            const inputField = document.getElementById('message');
            if(inputField) inputField.placeholder = "Szepczesz do: " + sender + "...";
        };
    }

    // --- BUDOWANIE HTML ---
    // Jeśli to duch, dodajemy poświatę do tekstu za pomocą klasy z CSS
    msgDiv.innerHTML = `
        <span class="message-sender" style="color:${senderColor}; font-weight:${fontWeight}; display:block; text-transform: uppercase; letter-spacing: 1px;">
            ${displaySender}:
        </span>
        <span class="message-text" style="color:#fff;">${text}</span>
    `;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

socket.off('systemMessage');
socket.on('systemMessage', (message) => {
    appendMessageToChat('System', message, 'system');
});

// 3. WYSYŁANIE (Zaktualizowane o system szeptów Hosta)
function sendMessage() {
    const msgInput = document.getElementById('message');
    if (!msgInput) return;
    
    const text = msgInput.value.trim();
    if (text === "") return;
	
    const me = playersCache.find(ptr => ptr.id === playerId);
    if (me && !me.alive && !me.canGhostTalk) {
        appendMessageToChat('System', 'Nie żyjesz - nie możesz pisać na czacie miasta!', 'system');
        return;
    }

    const activeTabBtn = document.querySelector('.tab-btn.active');
    const chatType = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'city';
    
    const myName = nicknameInput?.value.trim() || "Gracz";

    // Budujemy obiekt danych
    const payload = { 
        msg: text, 
        // Jeśli jesteś hostem, wysyłaj jako "Gospodarz", w innym przypadku użyj imienia
        from: isHost ? "Gospodarz" : myName, 
        type: chatType 
    };

    // Jeśli Host jest na zakładce prywatnej, dodajemy ID celu
    if (isHost && chatType === 'private') {
        if (!currentWhisperTarget) {
            // Zmieniliśmy treść komunikatu, bo teraz można też wybrać gracza z panelu
            appendMessageToChat('System', 'Wybierz gracza z panelu (zębatka) lub kliknij jego wiadomość, by szepnąć!', 'system');
            return;
        }
        payload.to = currentWhisperTarget;
    }

    socket.emit('sendMessage', payload);
    msgInput.value = "";
}

// 4. PODPIĘCIE (Uruchamiane od razu)
const sBtn = document.getElementById('send-btn');
const mInput = document.getElementById('message');

if (sBtn) sBtn.onclick = sendMessage;
if (mInput) {
    mInput.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
}

socket.on('phaseChanged', p => {
    currentPhase = p;
    amIReady = false;
    const chatContainer = document.getElementById('chat-container');
    
    if (chatContainer) chatContainer.classList.remove('phase-day-chat', 'phase-night-chat', 'dead-talk-active');
    document.body.classList.remove('phase-lobby', 'phase-day', 'phase-night');
    
    // --- POPRAWIONA LOGIKA WYŚWIETLANIA ROLI (Z BLOKADĄ DLA HOSTA) ---
    if (p === 'Dzień' && !roleShown) {
        // Małe opóźnienie, żeby upewnić się, że updatePlayers dotarło
        setTimeout(() => {
            // SPRAWDZAMY: Jeśli jesteś hostem, w ogóle nie szukamy roli i nie pokazujemy okna
            if (isHost) {
                console.log("Jesteś Gospodarzem - blokada wyświetlania roli.");
                roleShown = true; // Ustawiamy na true, żeby nie próbowało ponownie
                return;
            }

            const me = playersCache.find(ptr => ptr.id === socket.id);
            console.log("Moja rola to:", me ? me.role : "nie znaleziono"); 
            
            // Pokazujemy tylko jeśli rola istnieje i nie jest pusta
            if (me && me.role && me.role !== 'Brak roli' && me.role !== 'Gospodarz' && me.role !== '') {
                showRoleReveal(me.role);
                roleShown = true; 
            }
        }, 200);
    }
    // ---------------------------------------------------------------

    if (p === 'Lobby') {
        roleShown = false;
    }

    const skipBtn = document.getElementById('skip-phase-btn');
    const counterDisplay = document.getElementById('ready-counter');
    if (skipBtn) {
        skipBtn.classList.remove('is-ready');
        skipBtn.style.opacity = "1";
        skipBtn.style.background = ""; // Przywraca domyślny kolor z CSS
    }
    if (counterDisplay) {
        counterDisplay.innerText = "0/0";
    }

    // --- 3. OBSŁUGA FAZ (DŹWIĘKI I TIMERY) ---
    if (p === 'Dzień') {
        document.body.classList.add('phase-day');
        if (chatContainer) chatContainer.classList.add('phase-day-chat');
        playPhaseSound('day');
        runPhaseTimer(600, "DYSKUSJA!");
    } else if (p === 'Noc') {
        document.body.classList.add('phase-night');
        if (chatContainer) chatContainer.classList.add('phase-night-chat');
        playPhaseSound('night');
        runPhaseTimer(180, "NOC!");
    }
    
    if (typeof deadTalkActive !== 'undefined' && deadTalkActive) {
        if (chatContainer) chatContainer.classList.add('dead-talk-active');
    }
    
    // --- 4. CZYSZCZENIE GŁOSÓW ---
    hasVoted = false;
    votedFor = null;
    const info = document.getElementById('vote-info');
    if(info) info.remove();
    renderPlayersWithVotes();
});

// --- POWIADOMIENIE O ROLI ---
socket.on('yourRole', (data) => {
	// --- NOWA LOGIKA UKRYWANIA ZAKŁADKI ---
	const mafiaTab = document.querySelector('.tab-btn[data-tab="mafia"]');
    if (mafiaTab) {
		// Zakładka pojawia się TYLKO jeśli frakcja to Mafia
        if (data.faction === 'Mafia') {
			mafiaTab.style.display = 'inline-block';
		} else {
			mafiaTab.style.display = 'none';
		}
	}
	
	showRoleReveal(data.role);
    const revealOverlay = document.getElementById('role-reveal-overlay');
    const revealText = document.getElementById('role-reveal-text');

    if (revealOverlay && revealText) {
		revealOverlay.style.display = 'flex';
		revealOverlay.style.opacity = '1';

        // Ukrywamy po 4 sekundach
        setTimeout(() => {
            revealOverlay.style.opacity = '0';
            setTimeout(() => {
                revealOverlay.style.display = 'none';
            }, 800);
        }, 4000);
    }
});

const misfireBtn = document.getElementById('misfire-btn');
if (misfireBtn) {
    misfireBtn.onclick = () => {
        socket.emit('toggleConfusion');
    };
}

socket.on('updateConfusionState', (state) => {
    const btn = document.getElementById('misfire-btn');
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #00ffcc)'; // Morski Akwamaryn
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

function showCardMenu(targetId) {
    if (!isHost) return;

    let menu = document.getElementById('card-menu');
    if (menu) menu.remove();

    menu = document.createElement('div');
    menu.id = 'card-menu';
	
    // Style pozycjonowania (muszą być tutaj, jeśli nie ma ich w CSS)
    menu.style.position = 'fixed';
    menu.style.top = '50%';
    menu.style.left = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
    menu.style.zIndex = '9999';
    menu.style.display = 'flex';          // Zmieniamy na flex
    menu.style.flexDirection = 'column';  // Napis góra, reszta dół
    menu.style.alignItems = 'center';      // Centrujemy w pionie
    menu.style.minWidth = '600px';        // Szerokość dopasowana do 3 kolumn kart
    menu.style.background = '#1a1a1a';
    menu.style.padding = '20px';
    menu.style.border = '2px solid gold';
    menu.style.borderRadius = '10px';

    // --- 1. TYTUŁ (Na stałe w menu) ---
    const title = document.createElement('div');
    title.innerText = "PRZYZNAJ KARTĘ MOCY";
    title.style.color = '#5c1cff';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '22px';
    title.style.letterSpacing = '2px';
    title.style.marginBottom = '20px';
    title.style.textAlign = 'center';
    menu.appendChild(title);

    // --- 2. DYNAMICZNY KONTENER (Tu trafiają przyciski) ---
    const contentWrapper = document.createElement('div');
    contentWrapper.style.width = '100%';
    contentWrapper.style.display = 'flex'; 
    menu.appendChild(contentWrapper);

    const cards = [
		{id:'ally', name:'Sojusznik', type: 'private', targetRole: 'both'},
        {id:'anarchist', name:'Anarchista', type: 'public', targetRole: 'both'},
		{id:'archive_leak', name:'Przeciek z Archiwum', type: 'private', targetRole: 'city'},
		{id:'avenger', name:'Mściciel', type: 'public', targetRole: 'both'},
		{id:'blood_legacy', name:'Dziedzictwo Krwi', type: 'public', targetRole: 'mafia'},
		{id:'bodyguard', name:'Ochroniarz', type: 'public', targetRole: 'both'},
		{id:'boss_mama', name:'Boss Mama', type: 'public', targetRole: 'both'},
		{id:'blackmailer', name:'Szantażysta', type: 'private', targetRole: 'mafia'},
		{id:'cancel_power', name:'Karta Anulacji Mocy', type: 'public', targetRole: 'both'},
		{id:'chosen_of_dead', name:'Wybraniec Umarłych', type: 'public', targetRole: 'both'},
		{id:'citizen_rep', name:'Przedstawiciel Obywateli', type: 'public', targetRole: 'both'},
		{id:'common_interest', name:'Wspólny Interes', type: 'private', targetRole: 'city'},
		{id:'confiscation', name:'Konfiskata', type: 'public', targetRole: 'both'},
		{id:'corrupt_cop', name:'Skorumpowany Gliniarz', type: 'public', targetRole: 'both'},
		{id:'crown_witness', name:'Świadek Koronny', type: 'public', targetRole: 'both'},
		{id:'dark_pact', name:'Mroczny Pakt', type: 'private', targetRole: 'both'},
		{id:'delayed_execution', name:'Oddalona Egzekucja', type: 'public', targetRole: 'both'},
		{id:'delayed_poison', name:'Opóźniona Trucizna', type: 'public', targetRole: 'both'},
		{id:'doctor', name:'Lekarz', type: 'private', targetRole: 'city'},
		{id:'don_decision', name:'Decyzja Dona', type: 'public', targetRole: 'both'},
		{id:'duplication', name:'Cynk od Informatora', type: 'public', targetRole: 'both'},
		{id:'fair_judge', name:'Sprawiedliwy Sędzia', type: 'public', targetRole: 'both'},
		{id:'faked_death', name:'Upozorowana Śmierć', type: 'private', targetRole: 'both'},
		{id:'false_evidence', name:'Fałszywy Trop', type: 'private', targetRole: 'mafia'},
		{id:'final_judgment', name:'Sąd Ostateczny', type: 'public', targetRole: 'both'},
		{id:'fog_of_war', name:'Mgła Wojny', type: 'private', targetRole: 'mafia'},
		{id:'forced_sacrifice', name:'Wymuszona Ofiara', type: 'public', targetRole: 'both'},
        {id:'full_moon', name:'Pełnia Księżyca', type: 'private', targetRole: 'both'},
		{id:'gambler', name:'Hazardzista', type: 'private', targetRole: 'both'},
		{id:'godfather', name:'Ojciec Chrzestny', type: 'private', targetRole: 'mafia'},
		{id:'grove_whisper', name:'Grobowy Szept', type: 'public', targetRole: 'both'},
		{id:'hidden_victim', name:'Ukryta Ofiara', type: 'private', targetRole: 'mafia'},
		{id:'in_broad_daylight', name:'W Biały Dzień', type: 'public', targetRole: 'mafia'},
		{id:'investigative_report', name:'Raport Śledczy', type: 'private', targetRole: 'city'},
		{id:'iron_alibi', name:'Żelazne Alibi', type: 'private', targetRole: 'both'},
		{id:'jury', name:'Ława Przysięgłych', type: 'private', targetRole: 'both'},
		{id:'kamikaze', name:'Kamikadze', type: 'public', targetRole: 'both'},
		{id:'last_will', name:'Ostatnia Wola', type: 'private', targetRole: 'both'},
		{id:'lazarus_protocol', name:'Protokół Łazarz', type: 'public', targetRole: 'both'},
		{id:'life_insurance', name:'Polisa na Życie', type: 'private', targetRole: 'both'},
		{id:'list_of_the_damned', name:'Lista Potępionych', type: 'public', targetRole: 'both'},
		{id:'logistical_support', name:'Wsparcie Logistyczne', type: 'private', targetRole: 'both'},
		{id:'lovers', name:'Anioł Miłości', type: 'private', targetRole: 'both'},
        {id:'luck_shot', name:'Łut Szczęścia', type: 'public', targetRole: 'both'},
        {id:'madman', name:'Szaleniec', type: 'private', targetRole: 'both'},
        {id:'miracle_worker', name:'Cudotwórca', type: 'public', targetRole: 'both'},
        {id:'misfire', name:'Błędny Strzał', type: 'private', targetRole: 'city'},
		{id:'poison_blade', name:'Zatrute Ostrze', type: 'private', targetRole: 'mafia'},
		{id:'power_for_selected', name:'Moc Dla Wybranych', type: 'public', targetRole: 'both'},
		{id:'power_theft', name:'Kradzież Mocy', type: 'public', targetRole: 'both'},
		{id:'purification', name:'Oczyszczenie', type: 'public', targetRole: 'city'},
		{id:'rebound', name:'Rykoszet', type: 'private', targetRole: 'both'},
		{id:'recruit', name:'Rekrut', type: 'private', targetRole: 'both'},
		{id:'rigged_vote', name:'Fałszywy Wynik', type: 'private', targetRole: 'mafia'},
		{id:'second_chance', name:'Druga Szansa', type: 'public', targetRole: 'both'},
		{id:'secret_alliance', name:'Tajne Porozumienie', type: 'private', targetRole: 'city'},
		{id:'silence_card', name:'Wyciszenie', type: 'public', targetRole: 'both'},
        {id:'silent_sabotage', name:'Zmowa Milczenia', type: 'private', targetRole: 'mafia'},
        {id:'sniper', name:'Snajper', type: 'public', targetRole: 'both'},
        {id:'spiritual_seance', name:'Seans Spirytystyczny', type: 'public', targetRole: 'both'},
		{id:'spying', name:'Echo Zamachu', type: 'private', targetRole: 'city'},
		{id:'support', name:'Wsparcie', type: 'private', targetRole: 'city'},
        {id:'suspect_profile', name:'Profil Podejrzanego', type: 'public', targetRole: 'both'},
        {id:'tribunal_of_state', name:'Trybunał Stanu', type: 'public', targetRole: 'both'},
        {id:'tribune', name: 'Trybuna Umarłych', type: 'public', targetRole: 'both' },
        {id:'uncertain_info', name:'Niepewna Informacja', type: 'private', targetRole: 'city'},
        {id:'untouchable', name:'Nietykalny', type: 'private', targetRole: 'city'},
        {id:'veto', name:'Veto', type: 'public', targetRole: 'both'},
        {id:'voice_of_reason', name:'Głos Rozsądku', type: 'private', targetRole: 'both'}
    ];

    // --- KROK 1: WYBÓR FRAKCJI ---
    const showFactionPicker = () => {
        contentWrapper.innerHTML = '';
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';
        contentWrapper.style.alignItems = 'center';
		contentWrapper.style.width = '100%';

        const buttonsRow = document.createElement('div');
        buttonsRow.style.display = 'flex';
        buttonsRow.style.gap = '20px';
		buttonsRow.style.justifyContent = 'center';
		buttonsRow.style.width = '100%';

        const factions = [
            { id: 'city', name: 'OBYWATEL', img: 'images/city.png', color: '#3498db' },
            { id: 'mafia', name: 'MAFIA', img: 'images/mafia.png', color: '#e74c3c' }
        ];

        factions.forEach(f => {
            const fBtn = document.createElement('div');
            fBtn.style.cursor = 'pointer';
            fBtn.style.textAlign = 'center';
            fBtn.style.transition = 'transform 0.3s ease, filter 0.3s ease';
            fBtn.style.width = '200px';

            fBtn.innerHTML = `
                <div style="
				    width: 100%; 
                    height: 280px; 
                    background-image: url('${f.img}'); 
                    background-size: cover; 
                    background-position: center; 
                    border-radius: 15px; 
                    border: 2px solid ${f.color}66;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                    margin-bottom: 15px;
				"></div>
                <div style="
				    font-weight: bold; 
                    color: ${f.color}; 
                    font-size: 22px; 
                    letter-spacing: 2px;
                    text-shadow: 0 0 10px ${f.color}aa;
			    ">${f.name}</div>
            `;

            fBtn.onmouseover = () => {
				fBtn.style.transform = 'scale(1.08) translateY(-10px)';
                fBtn.querySelector('div').style.border = `2px solid ${f.color}`;
                fBtn.querySelector('div').style.boxShadow = `0 15px 30px ${f.color}44`;
			};
			
			fBtn.onmouseleave = () => {
                fBtn.style.transform = 'scale(1) translateY(0)';
                fBtn.querySelector('div').style.border = `2px solid ${f.color}66`;
                fBtn.querySelector('div').style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
            };
			
			fBtn.onclick = () => renderCardList(f.id);
            buttonsRow.appendChild(fBtn);
        });

        contentWrapper.appendChild(buttonsRow);

        const cancelBtn = document.createElement('button');
        cancelBtn.innerHTML = '❌ Anuluj';
        cancelBtn.style.marginTop = '40px';
        cancelBtn.style.padding = '10px 25px';
        cancelBtn.style.color = '#fff';
        cancelBtn.style.background = 'rgba(255, 0, 0, 0.2)';
        cancelBtn.style.border = '1px solid red';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.transition = 'background 0.2s';
		
		cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255, 0, 0, 0.4)';
        cancelBtn.onmouseleave = () => cancelBtn.style.background = 'rgba(255, 0, 0, 0.2)';
    
    cancelBtn.onclick = () => menu.remove();
		
        contentWrapper.appendChild(cancelBtn);
    };

    // --- KROK 2: WYBÓR KARTY ---
    const renderCardList = (selectedFaction) => {
        contentWrapper.innerHTML = '';
        // Ustawiamy grid na kontenerze zawartości
        contentWrapper.style.display = 'grid';
        contentWrapper.style.gridTemplateColumns = 'repeat(3, 1fr)';
        contentWrapper.style.gap = '10px';

        const filteredCards = cards.filter(c => c.targetRole === selectedFaction || c.targetRole === 'both');
        filteredCards.sort((a, b) => a.name.localeCompare(b.name));

        filteredCards.forEach(card => {
            const btn = document.createElement('button');
            let dot = card.targetRole === 'city' ? '🟢' : (card.targetRole === 'mafia' ? '🔴' : '🟡');
            btn.innerHTML = `${dot} ${card.name}`;
            btn.style.color = (card.type === 'public') ? '#2ecc71' : '#e74c3c';
            btn.style.padding = '10px';
            btn.style.cursor = 'pointer';
            btn.style.background = '#222';
            btn.style.border = '1px solid #444';
            btn.style.borderRadius = '5px';

            btn.onclick = () => {
                socket.emit('giveCard', { playerId: targetId, cardId: card.id, hostId: playerId });
                menu.remove();
            };
            contentWrapper.appendChild(btn);
        });

        const navWrapper = document.createElement('div');
        navWrapper.style.gridColumn = "1 / -1";
        navWrapper.style.display = "flex";
        navWrapper.style.justifyContent = "center";
        navWrapper.style.gap = "10px";
        navWrapper.style.marginTop = "20px";

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '⬅️ Powrót';
        backBtn.onclick = showFactionPicker;

        const cancelBtn = document.createElement('button');
        cancelBtn.innerHTML = '❌ Anuluj';
        cancelBtn.onclick = () => menu.remove();

        navWrapper.appendChild(backBtn);
        navWrapper.appendChild(cancelBtn);
        contentWrapper.appendChild(navWrapper);
    };

    showFactionPicker();
    document.body.appendChild(menu);
}

function showModal(title, text, showCancel = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerText = text;
        
        cancelBtn.style.display = showCancel ? 'inline-block' : 'none';
        modal.style.display = 'flex';

        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };
    });
}

const moonBtn = document.getElementById('full-moon-btn');
if (moonBtn) {
    moonBtn.onclick = () => socket.emit('toggleFullMoon');
}

// Kliknięcie w ikonkę tancerki
const bossMamaBtn = document.getElementById('boss-mama-btn');
if (bossMamaBtn) {
    bossMamaBtn.onclick = () => socket.emit('toggleBossMama');
}

// Odbiornik stanu z serwera
socket.on('updateBossMamaState', (state) => {
    const btn = document.getElementById('boss-mama-btn');
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #9b59b6)'; // Królewski Ametyst
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

const poisonBladeBtn = document.getElementById('poison-blade-btn');

if (poisonBladeBtn) {
    poisonBladeBtn.onclick = () => {
        // To wysyła sygnał do serwera, żeby przełączyć stan trucizny
        socket.emit('togglePoisonBlade');
    };
}

socket.on('updatePoisonBladeState', (state) => {
    const btn = document.getElementById('poison-blade-btn'); // Upewnij się, że masz takie ID w HTML
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #2ecc71)'; // Jadowita zieleń
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

const graveWhisperBtn = document.getElementById('grave-whisper-btn');
if (graveWhisperBtn) {
    graveWhisperBtn.onclick = () => socket.emit('toggleGraveWhisper');
}

socket.on('updateGraveWhisperState', (state) => {
    const btn = document.getElementById('grave-whisper-btn');
    if (!btn) return;
    btn.style.filter = state ? 'drop-shadow(0 0 15px #9b59b6)' : 'none';
    btn.style.opacity = state ? '1' : '0.5';
});

// Kliknięcie
const judgeBtn = document.getElementById('judge-btn');
if (judgeBtn) {
    judgeBtn.onclick = () => socket.emit('toggleJudge');
}

// Zmiana stanu (świecenie)
socket.on('updateJudgeState', (state) => {
    const btn = document.getElementById('judge-btn');
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #3498db)'; // Głęboki Szafir
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

socket.on('notificationBlackmail', (data) => {
    // 1. Jeśli okno już istnieje, nie twórz go drugi raz
    if (document.getElementById('blackmail-notif-overlay')) return;

    console.log("Otrzymano szantaż na cel:", data.targetName);

    const overlay = document.createElement('div');
    overlay.id = 'blackmail-notif-overlay';
    // Dodajemy stałe style w JS, aby mieć pewność, że nic ich nie nadpisze
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.95);
        display: flex; justify-content: center; align-items: center;
        z-index: 999999; 
        backdrop-filter: blur(10px);
    `;

    overlay.innerHTML = `
        <div class="modal-content" style="
            border: 3px solid #e74c3c; 
            padding: 30px; 
            max-width: 500px; 
            background: #111; 
            color: white; 
            text-align: center;
            box-shadow: 0 0 50px rgba(231, 76, 60, 0.5);
            pointer-events: auto;
        ">
            <h1 style="color: #e74c3c; font-family: 'Garamond', serif; letter-spacing: 3px;">WYROK SZANTAŻU</h1>
            <p style="font-size: 1.2em;">Twoim przymusowym celem jest:</p>
            <h2 style="color: #f1c40f; font-size: 2.5em; margin: 20px 0;">${data.targetName}</h2>
            <p style="color: #bbb; font-style: italic; border-left: 3px solid #e74c3c; padding-left: 15px; text-align: left;">
                "Musisz zrobić wszystko, by gracz ${data.targetName} został wygłosowany. Każda próba buntu przy urnie zakończy się unieważnieniem Twojego głosu."
            </p>
            <button id="close-blackmail-btn" style="
                background: #e74c3c; 
                color: white; 
                border: none; 
                padding: 15px 30px; 
                margin-top: 25px; 
                cursor: pointer; 
                font-weight: bold;
                width: 100%;
                text-transform: uppercase;
            ">Przyjmuję do wiadomości</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Ręczne podpięcie zdarzenia usuwania, aby uniknąć problemów z inline onclick
    document.getElementById('close-blackmail-btn').onclick = () => {
        console.log("Zamykanie powiadomienia o szantażu");
        overlay.remove();
    };
});

socket.on('coinResult', (data) => {
    const overlay = document.getElementById('coin-overlay');
    const coin = document.getElementById('coin-visual');
    const resultText = document.getElementById('coin-result-text');
    const front = document.querySelector('.coin-front');
    const back = document.querySelector('.coin-back');
	
    if (data.type === 'luck') {
        front.innerText = "Szczęście";
        back.innerText = "Pech";
    } else {
        front.innerText = "Łaska";
        back.innerText = "Wyrok";
    }
    
	// 1. Przygotuj widok
    overlay.style.display = 'flex';
    resultText.style.opacity = '0';
    resultText.innerText = data.result;
    resultText.style.color = data.color;
	
	// 2. Ustal rotację (wielokrotność 360 + 180 jeśli Wyrok)
    const extraRotation = data.result === 'Łaska Dona' ? 0 : 180;
    const totalRotation = 1800 + extraRotation; // 5 pełnych obrotów + wynik
    coin.style.setProperty('--final-rotation', `${totalRotation}deg`);
	
	// 3. Uruchom animację
    coin.classList.remove('tossing');
    void coin.offsetWidth; // "Magic" reset animacji CSS
    coin.classList.add('tossing');
	
	// 4. Pokaż napis i zamknij po zakończeniu
    setTimeout(() => {
		resultText.style.opacity = '1';
		
		// Dodaj też wpis na czacie (jak wcześniej)
        const chatCity = document.getElementById('chat-messages-city');
        const div = document.createElement('div');
        div.style.color = data.color;
        div.style.textAlign = 'center';
        div.style.padding = '5px';
        div.style.borderBottom = `1px solid ${data.color}33`;
        div.innerHTML = `<b>${data.chatLabel}</b>`; // Używamy gotowej etykiety z serwera
        chatCity.appendChild(div);
        chatCity.scrollTop = chatCity.scrollHeight;
		
		// Zamknij okno po 3 sekundach od pokazania wyniku
        setTimeout(() => {
			overlay.style.display = 'none';
		}, 3000);
	}, 3000);
});

socket.on('syncWheelSpin', (data) => {
    winnerText.innerText = "";
    wheelOverlay.style.display = 'flex';
    wheelControls.style.display = isHost ? 'block' : 'none';

    drawWheel(data.alivePlayers);

    setTimeout(() => {
        wheelCanvas.style.transform = `rotate(${data.finalAngle}deg)`;
        
        setTimeout(() => {
            const actualAngle = (360 - (data.finalAngle % 360)) % 360;
            const sliceSize = 360 / data.alivePlayers.length;
            const winnerIndex = Math.floor(actualAngle / sliceSize);
            const winner = data.alivePlayers[winnerIndex];

            winnerText.innerText = `WYBRANIEC: ${winner.name}`;
            winnerText.style.color = winner.alive ? "#2ecc71" : "#e74c3c";

            if (isHost) {
                // Host informuje czat o wyniku
                socket.emit('announceWheelResult', { 
                    hostId: playerId, 
                    winnerName: winner.name 
                });
                
                setTimeout(() => {
                    wheelOverlay.style.display = 'none';
                    wheelCanvas.style.transform = 'rotate(0deg)';
					socket.emit('requestWheelClose')
                }, 2000);
            }
        }, 4000); // 4s to czas trwania animacji w CSS
    }, 100);
});

function drawWheel(players) {
    const ctx = wheelCanvas.getContext('2d');
    const arc = (2 * Math.PI) / players.length;
    ctx.clearRect(0, 0, 400, 400);

    players.forEach((p, i) => {
        const angle = i * arc;
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#2a2a2a'; 
        ctx.strokeStyle = '#5c1cff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(200, 200);
        ctx.arc(200, 200, 190, angle, angle + arc);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(200, 200);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(p.name, 180, 10);
        ctx.restore();
    });
}

socket.on('updateFullMoonState', (state) => {
    const btn = document.getElementById('full-moon-btn');
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #e67e22)'; // Ognisty Bursztyn
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

socket.on('forceCloseWheel', () => {
    // To wykona się u każdego gracza (u Hosta w sumie też, ale on już zamknął swoje)
    wheelOverlay.style.display = 'none';
    wheelCanvas.style.transform = 'rotate(0deg)';
    winnerText.innerText = ""; // Czyścimy napis zwycięzcy na następny raz
});

const delayedBtn = document.getElementById('delayed-exec-btn');
if (delayedBtn) {
    delayedBtn.onclick = () => socket.emit('toggleDelayedExecution');
}

socket.on('updateDelayedExecutionState', (state) => {
    const btn = document.getElementById('delayed-exec-btn');
    if (btn) {
        if (state) {
            btn.style.filter = 'drop-shadow(0 0 20px #e74c3c)'; // Krwawy Rubin
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

socket.on('youAreInLove', ({ loverName, loverRole }) => {
    // Używamy Twojej funkcji do pisania na czacie
    addChatMessage("💖 ANIOŁ MIŁOŚCI", `Twoje serce bije teraz dla: ${loverName}! Ta osoba to: ${loverRole}.`, "system");
    
    // Jeśli masz już mini-kartę roli po prawej, dodajmy jej różową poświatę
    const miniCard = document.getElementById('mini-role-card');
    if (miniCard) {
        miniCard.style.boxShadow = "0 0 25px #ff69b4";
    }
});

socket.on('deadTalkStatus', (isActive) => {
	const talkBtn = document.getElementById('dead-talk-btn');
    if (talkBtn) {
        if (isActive) {
            talkBtn.style.filter = 'drop-shadow(0 0 20px #a29bfe)'; // Eteryczny Kwarc
            talkBtn.style.transform = 'scale(1.3)';
            talkBtn.style.opacity = '1';
        } else {
            talkBtn.style.filter = 'none';
            talkBtn.style.transform = 'scale(1)';
            talkBtn.style.opacity = '0.5';
        }
    }
	deadTalkActive = isActive;
	const chatContainer = document.getElementById('chat-container'); // upewnij się, że masz takie ID
	chatContainer.classList.remove('phase-day-chat', 'phase-night-chat', 'dead-talk-active');
	if (isActive) {
		chatContainer.classList.add('dead-talk-active');
	} else {
		if (currentPhase === 'Dzień') {
			chatContainer.classList.add('phase-day-chat');
		} else if (currentPhase === 'Noc') {
			chatContainer.classList.add('phase-night-chat');
		}
	}
    const me = playersCache.find(p => p.id === playerId);
	if (!me) return;
    // Jeśli gracz nie żyje, sterujemy jego możliwością pisania
    if (me.alive) {
		messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.placeholder = isActive ? "Trybuna trwa - milcz!" : "Napisz wiadomość...";
    } else {
		messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.placeholder = isActive ? "Głos zza grobu..." : "Umarli głosu nie mają";
	}
});

function createHostActionIcon(id, action, label, fileName) {
    return `
        <div onclick="${action}; closeHostPanel()" title="${label}" style="
            display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s; width: 100px;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='scale(1)'">
            <div style="
                width: 100px; height: 100px; 
                background-image: url('icons/${fileName}'); 
                background-size: contain; background-repeat: no-repeat; background-position: center;
                border: 2px solid #c5a05944; border-radius: 12px; background-color: #222;
                margin-bottom: 8px; box-shadow: 0 6px 12px rgba(0,0,0,0.6);
            "></div>
            <span style="
                font-size: 16px; 
                color: #c5a059; 
                text-transform: uppercase; 
                text-align: center; 
                font-weight: bold; 
                letter-spacing: 1px;
                text-shadow: 1px 1px 2px black;
                font-family: 'Garamond', serif;
            ">${label}</span>
        </div>
    `;
}

window.openHostPanel = function(targetId) {
    const p = playersCache.find(ptr => ptr.id === targetId);
    if (!p) return;

    // Tworzymy Overlay (tło)
    const overlay = document.createElement('div');
    overlay.id = 'host-panel-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; justify-content: center;
        align-items: center; z-index: 10000; backdrop-filter: blur(5px);
    `;

    // Budujemy zawartość panelu (Modal)
    // Fragment wewnątrz window.openHostPanel w app.js
    overlay.innerHTML = `
        <div style="background: #1a1a1a; border: 2px solid #c5a059; padding: 40px; border-radius: 20px; width: 850px; color: white; box-shadow: 0 0 40px rgba(0,0,0,0.9);">
            <h2 style="color: #c5a059; margin-top: 0; text-align: center; font-family: 'Garamond', serif; letter-spacing: 3px; font-size: 28px; text-transform: uppercase;">
			    ZARZĄDZANIE: ${p.name}
			</h2>
        
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-top: 30px; justify-items: center;">
            
                ${createHostActionIcon('kill', `socket.emit('toggleAlive', '${p.id}', '${playerId}')`, 'Stan', 'skull.png')}
				${createHostActionIcon('whisper', `initiateWhisper('${p.id}', '${p.name}')`, 'Szept', 'mail.png')}
                ${createHostActionIcon('protect', `socket.emit('toggleProtect', '${p.id}')`, 'Tarcza', 'shield.png')}
                ${createHostActionIcon('role', `socket.emit('changeRole', '${p.id}', '${playerId}')`, 'Rola', 'refresh.png')}
                ${createHostActionIcon('reveal', `socket.emit('hostRevealRole', '${p.id}')`, 'Ujawnij', 'lightbulb.png')}
				${(p.role === 'Mafia' || p.role === 'Killer') ?
				    createHostActionIcon('godfather', `socket.emit('setGodfather', '${p.id}')`, 'Ojciec Chrzestny', 'godfather.png')
					: ''
				}
				${!p.alive ?
				    createHostActionIcon('seance', `socket.emit('toggleGhostTalk', '${p.id}')`, p.canGhostTalk ? 'Przerwij Seans' : 'Seans Spiryt.', 'ghost.png')
					:''
				}
            
                ${createHostActionIcon('eye', `handleEyeClick('${p.id}')`, 'Karty', 'eye.png')}
                ${createHostActionIcon('power', `showCardMenu('${p.id}')`, 'Moc', 'cards.png')}
				${createHostActionIcon('draft', `socket.emit('sendDraft', {targetId: '${p.id}', hostId: playerId})`, 'Dar Losu', 'gift.png')}
				${createHostActionIcon('blackmail', `openBlackmailMenu('${p.id}')`, 'Szantaż', 'blackmail.png')} ${/* 👈 NOWA IKONA */ ''}
                ${createHostActionIcon('mute', `socket.emit('toggleMute', {playerId: '${p.id}', muted: ${!p.isMuted}})`, p.isMuted ? 'Odcisz' : 'Wycisz', 'mute.png')}
				${createHostActionIcon('love', `handleLoveClick('${p.id}')`, p.isInLove ? 'Rozbij parę' : (firstLoverId === p.id ? 'Czeka...' : 'Połącz w parę'), 'heart.png')}
                ${createHostActionIcon('double', `socket.emit('toggleDoubleVote', '${p.id}')`, 'Głos x2', 'scales.png')}
            
                ${createHostActionIcon('tribunal', `triggerTribunal('${p.id}')`, 'Sąd', 'tribunal.png')}
            </div>

            <button onclick="closeHostPanel()" style="width: 100%; margin-top: 35px; padding: 15px; background: #c5a059; border: none; color: black; font-weight: bold; cursor: pointer; border-radius: 8px; text-transform: uppercase; font-size: 16px; letter-spacing: 2px;">
			    Powrót do Miasta
			</button>
        </div>
    `;

    document.body.appendChild(overlay);

    window.closeHostPanel = function() {
        const el = document.getElementById('host-panel-overlay');
        if (el) el.remove();
    };
};

window.initiateWhisper = function(targetId, targetName) {
    // 1. Ustawiamy cel szeptu dla Hosta
    currentWhisperTarget = targetId;

    // 2. Znajdujemy zakładkę szeptów i symulujemy kliknięcie, aby ją aktywować
    const privateTab = document.querySelector('.tab-btn[data-tab="private"]');
    if (privateTab) {
        privateTab.click();
    }

    // 3. Zmieniamy placeholder w polu wpisywania, żebyś wiedział do kogo piszesz
    const messageInput = document.getElementById('message');
    if (messageInput) {
        messageInput.placeholder = `Szepczesz do: ${targetName}...`;
        messageInput.focus(); // Ustawiamy kursor od razu w polu tekstowym
    }

    // 4. Informacja systemowa dla Ciebie (opcjonalnie)
    appendMessageToChat('System', `Rozpoczynasz prywatną rozmowę z: ${targetName}`, 'system');

    // 5. Zamykamy panel zarządzania
    closeHostPanel();
};

window.handleLoveClick = function(id) {
    if (!firstLoverId) { 
        // Wybór pierwszej osoby
        firstLoverId = id; 
        appendMessageToChat('System', `Wybierz drugą osobę, aby połączyć ją z graczem: ${playersCache.find(p=>p.id===id)?.name}`, 'system');
        renderPlayersWithVotes(); 
    }
    else if (firstLoverId === id) { 
        // Kliknięcie tej samej osoby - anulowanie
        firstLoverId = null; 
        renderPlayersWithVotes(); 
    }
    else { 
        // Wybór drugiej osoby - wysłanie do serwera
        socket.emit('linkLovers', { 
            player1Id: firstLoverId, 
            player2Id: id, 
            hostId: playerId 
        }); 
        firstLoverId = null; 
    }
    
    // Zamykamy panel po kliknięciu, aby Host widział listę graczy i ikonkę statusu
    if (typeof closeHostPanel === 'function') closeHostPanel();
};

// --- LOGIKA PRYWATNEGO NOTATNIKA ---
const notebookBtn = document.getElementById('notebook-btn');
const notebookPanel = document.getElementById('notebook-panel');
const notebookClose = document.getElementById('close-notebook');
const notebookArea = document.getElementById('player-notes-area');

if (notebookBtn && notebookPanel) {
    notebookBtn.onclick = () => {
        // Przełączanie widoczności
        const isHidden = notebookPanel.style.display === 'none' || notebookPanel.style.display === '';
        notebookPanel.style.display = isHidden ? 'block' : 'none';
    };
}

if (notebookClose && notebookPanel) {
    notebookClose.onclick = () => {
        notebookPanel.style.display = 'none';
    };
}

// Wczytywanie i zapisywanie notatek
if (notebookArea) {
    const savedPlayerNotes = localStorage.getItem('mafia_player_notes');
    if (savedPlayerNotes) {
        notebookArea.value = savedPlayerNotes;
    }

    notebookArea.oninput = () => {
        localStorage.setItem('mafia_player_notes', notebookArea.value);
    };
}

socket.on('receiveDraft', (data) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'draft-overlay';
    overlay.style.zIndex = "30000";

    overlay.innerHTML = `
        <div class="modal-content" style="background: transparent; border: none; text-align: center;">
            <h2 style="color: #f1c40f; text-shadow: 0 0 15px #f1c40f; font-size: 30px; margin-bottom: 30px;">DAR LOSU</h2>
            <p style="color: white; margin-bottom: 40px;">Gospodarz wystawia Twoje szczęście na próbę... Wybierz jedną kartę.</p>
            
            <div style="display: flex; gap: 40px; justify-content: center;">
                <div class="draft-card" data-cardid="${data.options[0]}" onclick="pickDraftCard(this, 0)" id="draft-0">
                    <div class="card-inner">
                        <div class="card-front-visual"></div> 
                        <div class="card-back-visual"></div>
                    </div>
                </div>

                <div class="draft-card" data-cardid="${data.options[1]}" onclick="pickDraftCard(this, 1)" id="draft-1">
                    <div class="card-inner">
                        <div class="card-front-visual"></div>
                        <div class="card-back-visual"></div>
                    </div>
                </div> <div class="draft-card" data-cardid="${data.options[2]}" onclick="pickDraftCard(this, 2)" id="draft-2">
                    <div class="card-inner">
                        <div class="card-front-visual"></div>
                        <div class="card-back-visual"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
});

// Funkcja wyboru karty
window.pickDraftCard = function(clickedElement, index) {
    // 1. Pobieramy wszystkie karty draftu, jakie są aktualnie w overlayu
    const allCards = document.querySelectorAll('.draft-card');
    const selectedCardId = clickedElement.getAttribute('data-cardid');

    // 2. Blokujemy klikalność wszystkich kart natychmiast
    allCards.forEach(card => card.style.pointerEvents = "none");

    // 3. Logika dla KAŻDEJ karty z osobna
    allCards.forEach((card) => {
        const cardIndex = parseInt(card.id.split('-')[1]); // Wyciąga cyfrę z id "draft-X"
        const cardVisual = card.querySelector('.card-back-visual');
        const cardId = card.getAttribute('data-cardid');

        // Ustawiamy obrazek tła dla każdej karty (musimy wiedzieć co pod każdą było)
        cardVisual.style.backgroundImage = `url('cards/${cardId}.png')`;

        if (card === clickedElement) {
            // --- EFEKT DLA WYBRANEJ KARTY ---
            card.classList.add('flipped');
            card.style.filter = "brightness(1.1) drop-shadow(0 0 20px gold)";
            card.style.zIndex = "100";
            card.style.transform = "scale(1.1)"; // Lekkie powiększenie zwycięzcy
        } else {
            // --- EFEKT DLA NIEWYBRANYCH KART ("Haha!") ---
            // Dodajemy małe, kaskadowe opóźnienie dla każdej kolejnej karty (0.2s, 0.4s itd.)
            setTimeout(() => {
                card.classList.add('flipped');
                card.style.filter = "grayscale(0.5) brightness(0.8) blur(0.5px)";
                card.style.opacity = "0.6";
                // Niewybrane karty lekko się kurczą w środku
                card.querySelector('.card-inner').style.transform = "rotateY(180deg) scale(0.85)";
            }, 200 + (cardIndex * 100)); 
        }
    });

    // 4. FINALIZACJA (wysłanie do serwera po czasie na obejrzenie)
    setTimeout(() => {
        socket.emit('acceptDraftCard', selectedCardId); 
        const overlay = document.getElementById('draft-overlay');
        if (overlay) {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.5s ease";
            setTimeout(() => overlay.remove(), 500);
        }
    }, 4000); // Wydłużyłem do 4s, bo przy 3 kartach jest więcej do oglądania
};

//////////////////////////////////////////////////////
// 🔥 OBSŁUGA PRZYCISKU GOTOWOŚCI (SKIP TIMER)
//////////////////////////////////////////////////////
const skipBtn = document.getElementById('skip-phase-btn');

if (skipBtn) {
    skipBtn.onclick = () => {
        if (!amIReady && !skipBtn.classList.contains('is-ready')) {
            amIReady = true;
            skipBtn.classList.add('is-ready');
            skipBtn.style.background = '#7f8c8d'; 
            socket.emit('playerReady', playerId);
        }
    };
}

socket.on('updateReadyCount', (count, total) => {
    const counterDisplay = document.getElementById('ready-counter');
    if (counterDisplay) {
        counterDisplay.innerText = `${count}/${total}`;
    }
    if (skipBtn) {
        skipBtn.style.opacity = amIReady ? "0.6" : "1";
    }
});

// === LOGIKA PANELU HOSTA (KATEGORIE) ===
// Ten kod musi być w app.js, bo operuje na DOM (widoku przeglądarki)

document.querySelectorAll('.category-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const group = trigger.parentElement;
        const isActive = group.classList.contains('active');

        // Zamykamy inne otwarte kategorie
        document.querySelectorAll('.category-group').forEach(g => {
            g.classList.remove('active');
        });

        // Jeśli kliknięta nie była aktywna, otwórz ją
        if (!isActive) {
            group.classList.add('active');
        }
    });
});

// Zamykanie szuflady po wybraniu konkretnej mocy (opcjonalne, ale poprawia UX)
document.querySelectorAll('.host-side-icon').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.category-group').forEach(g => {
            g.classList.remove('active');
        });
    });
});

// Zamykanie szuflad po kliknięciu gdziekolwiek indziej na ekranie
document.addEventListener('click', () => {
    document.querySelectorAll('.category-group').forEach(g => {
        g.classList.remove('active');
    });
});

// Funkcja wyświetlająca wielki napis na środku ekranu
function showLoveNotification() {
    // Tworzymy kontener powiadomienia
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        z-index: 9999;
        animation: fadeIn 0.5s ease;
    `;

    overlay.innerHTML = `
        <h1 style="color: #ff69b4; font-size: 50px; text-shadow: 0 0 20px #ff69b4; margin-bottom: 10px;">
            💖 Zakochałeś się!
        </h1>
        <p style="color: white; font-size: 20px; text-align: center;">
            Twoje serce bije teraz dla kogoś innego.<br>
            Jeśli Twój kochanek zginie - Ty również odejdziesz.
        </p>
        <button id="close-love-notif" style="
            margin-top: 30px; padding: 10px 30px; 
            background: #ff69b4; border: none; color: white; 
            border-radius: 20px; cursor: pointer; font-weight: bold;
        ">OK</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById('close-love-notif').onclick = () => {
        overlay.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => overlay.remove(), 450);
    };
}

// Nasłuchiwanie na sygnał z serwera
socket.on('notificationLove', () => {
    showLoveNotification();
});

// DODAJ TO: Resetowanie gotowości przy zmianie fazy
socket.on('phaseChanged', (phase) => {
    amIReady = false;
    if (skipBtn) {
        skipBtn.classList.remove('is-ready');
        skipBtn.style.background = '#222'; // powrót do domyślnego
        skipBtn.style.opacity = "1";
    }
});

const rigVotingBtn = document.getElementById('rig-voting-btn');
if (rigVotingBtn) {
    rigVotingBtn.onclick = () => socket.emit('toggleRigVoting');
}

socket.on('updateRigVotingState', (state) => {
    const btn = document.getElementById('rig-voting-btn');
    if (!btn) return;
    btn.style.filter = state ? 'drop-shadow(0 0 15px #e74c3c)' : 'none'; // Czerwona poświata
    btn.style.opacity = state ? '1' : '0.5';
});

const hiddenVictimBtn = document.getElementById('hidden-victim-btn');
if (hiddenVictimBtn) {
    hiddenVictimBtn.onclick = () => socket.emit('toggleHiddenVictim');
}

socket.on('updateHiddenVictimState', (state) => {
    const btn = document.getElementById('hidden-victim-btn');
    if (!btn) return;
    btn.style.filter = state ? 'drop-shadow(0 0 20px #f1c40f)' : 'none'; // Złota poświata
    btn.style.transform = state ? 'scale(1.3)' : 'scale(1)';
    btn.style.opacity = state ? '1' : '0.5';
});

socket.on('updateCards', cards => {
    const cardsPanel = document.getElementById('cards-panel');
    const infoPanel = document.getElementById('card-info-panel');
    
    if (!cardsPanel || !infoPanel) {
        console.error("Błąd: Nie znaleziono paneli kart w HTML!");
        return;
    }
    
    cardsPanel.innerHTML = '';

    if (infoPanel) {
        infoPanel.innerHTML = '';
        infoPanel.style.border = 'none';
        infoPanel.style.background = 'none';
        infoPanel.style.minHeight = '0';
        infoPanel.style.height = 'auto';
        infoPanel.style.margin = '0';
    }

    cards.forEach((c, index) => {
        const div = document.createElement('div');
        div.className = 'card ' + (c.type === 'public' ? 'public' : 'private');
        div.style.backgroundImage = `url('cards/${c.id}.png')`;
        div.style.position = 'relative'; // Ważne dla pozycjonowania przycisku X

        // --- DODAJEMY PRZYCISK USUWANIA TYLKO DLA HOSTA PODCZAS PODGLĄDU ---
        if (isHost && spyingPlayerId) {
            const removeBtn = document.createElement('div');
            removeBtn.innerHTML = '✕';
            removeBtn.style = `
                position: absolute; top: -5px; right: -5px; width: 22px; height: 22px;
                background: red; color: white; border-radius: 50%; display: flex;
                align-items: center; justify-content: center; font-weight: bold;
                cursor: pointer; border: 2px solid white; z-index: 100; font-size: 14px;
            `;
            removeBtn.onclick = (e) => {
                e.stopPropagation(); // Żeby nie kliknąć w kartę przy usuwaniu
                socket.emit('removePlayerCard', { targetId: spyingPlayerId, cardIndex: index });
            };
            div.appendChild(removeBtn);
        }

        div.onmouseenter = () => {
            const typeText = c.type === 'public' ? 'O użyciu tej karty dowiedzą się wszyscy!' : 'Spotkanie z Gospodarzem.';
            infoPanel.style.display = 'flex';
            infoPanel.style.background = 'rgba(0, 0, 0, 0.7)';
            infoPanel.style.padding = '10px';
            infoPanel.style.marginTop = '10px';
            infoPanel.style.borderRadius = '8px';
            infoPanel.innerHTML = `
                <div style="font-weight:bold; font-size:26px; color:#FF0000; margin-bottom:2px;">${c.name}</div>
                <div style="font-size:20px; color:#fff;">${c.description}</div>
                <div style="font-size:16px; color:#aaa; font-style: italic; margin-top:5px;">${typeText}</div>
            `;
        };

        div.onmouseleave = () => {
            infoPanel.innerHTML = '';
            infoPanel.style.display = 'none';
            infoPanel.style.background = 'none';
            infoPanel.style.padding = '0';
            infoPanel.style.marginTop = '0';
        };

        div.onclick = async () => {
            if (isHost) {
                appendMessageToChat("System", "Tylko podglądasz te karty. Nie możesz ich użyć.", "system");
                return;
            }
            const me = playersCache.find(p => p.id === playerId);
            if (me && !me.alive) {
                await showModal("Błąd!", "Umarli nie mogą używać kart mocy!", false);
                return;
            }

            // --- NOWA LOGIKA MODALA Z GRAFIKĄ I ANIMACJAMI ---
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'card-use-overlay';
            overlay.style.zIndex = "20000";

            overlay.innerHTML = `
                <div class="modal-content" style="background: transparent; border: none; box-shadow: none; display: flex; flex-direction: column; align-items: center;">
                    <div id="big-card-preview" class="modal-card-preview" 
                         style="background-image: url('cards/${c.id}.png')">
                    </div>
                    
                    <div style="background: rgba(20,20,20,0.95); padding: 25px; border-radius: 15px; border: 2px solid #5c1cff; backdrop-filter: blur(10px); min-width: 300px;">
                        <h3 style="margin-top:0; color: white;">Użyć karty: ${c.name}?</h3>
                        <div class="modal-buttons" style="display: flex; gap: 10px; justify-content: center;">
                            <button id="confirm-use-btn" class="win-btn city" style="background: #27ae60; padding: 10px 20px;">TAK, UŻYJ</button>
                            <button id="cancel-use-btn" class="cancel-btn" style="background: #444; padding: 10px 20px;">ANULUJ</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const bigCard = document.getElementById('big-card-preview');

            // OBSŁUGA: TAK, UŻYJ
            document.getElementById('confirm-use-btn').onclick = () => {
                bigCard.classList.add('card-anim-use');
                
                setTimeout(() => {
                    socket.emit('useCard', { playerId, cardId: c.id });
                    if(infoPanel) {
                        infoPanel.innerHTML = '';
                        infoPanel.style.background = 'none';
                    }
                    overlay.remove();
                }, 700);
            };

            // OBSŁUGA: ANULUJ
            document.getElementById('cancel-use-btn').onclick = () => {
                bigCard.classList.add('card-anim-return');
                
                setTimeout(() => {
                    overlay.remove();
                }, 500);
            };
        };

        cardsPanel.appendChild(div);
    });
});