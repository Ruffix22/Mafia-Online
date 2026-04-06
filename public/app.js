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
let confusionActive = false;

// --- LOGIKA LOGOWANIA ---
const joinBtn = document.getElementById('join-btn-new');
const loginContainer = document.getElementById('login-container');
const nicknameInput = document.getElementById('nickname-input');
const hostCheckbox = document.getElementById('is-host-check');

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

        // Wysłanie danych do serwera
        socket.emit('joinGame', { name: playerName, isHost: isHost });
		socket.emit('requestMyCards', playerName); // Poproś o karty po zalogowaniu

        // Efektowne przejście: Ukrywamy login, pokazujemy grę
        loginContainer.style.opacity = "0";
        loginContainer.style.transition = "opacity 0.5s ease";
        
        // --- LOGIKA LOGOWANIA ---
// ... (początek bez zmian, aż do setTimeout)

        setTimeout(() => {
            loginContainer.style.display = 'none';
            document.body.classList.remove('phase-lobby');
            document.body.classList.add('phase-day');
            
            // Pokazujemy główne elementy gry
            document.querySelector('.main-game-area').style.display = 'flex';
            document.getElementById('inventory-center').style.display = 'block'; 
            
            // PASEK BOCZNY (Ikony kart/toss)
            const sideBar = document.getElementById('coin-toss-container');
            sideBar.style.display = 'flex';

            // NARZĘDZIA (Notatnik i Skip) - Pokazujemy cały kontener
            const utilityTools = document.getElementById('utility-tools');
            if (utilityTools) {
                utilityTools.style.display = 'flex';
            }
            
            // Logika wyświetlania konkretnych przycisków
            if (isHost) {
                document.getElementById('top-bar').style.display = 'flex';
            } else {
                // Ukrywamy przyciski hosta
                const hostButtons = [
                    'coin-btn', 'wheel-btn', 'misfire-btn', 'boss-mama-btn', 
                    'dead-talk-btn', 'full-moon-btn', 'judge-btn', 'delayed-exec-btn'
                ];
                hostButtons.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                // Upewniamy się, że narzędzia gracza są widoczne (POPRAWIONE ID)
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

if (coinBtn) {
    coinBtn.onclick = () => {
        coinBtn.classList.add('coin-spin');
        socket.emit('tossCoin', playerId);
        setTimeout(() => coinBtn.classList.remove('coin-spin'), 600);
    };
}

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

if (wheelBtn) {
    wheelBtn.onclick = () => {
        // 1. Sprawdzamy graczy
        const alivePlayers = playersCache.filter(p => p.alive && !p.isHost);
        
        // 2. Jeśli testujesz sam (brak graczy), dodajemy testowego, żebyś widział okno
        const playersToDraw = alivePlayers.length > 0 ? alivePlayers : [{name: "TEST", id: "test"}];

        // 3. KLUCZOWE: Pokaż okno u siebie!
        wheelOverlay.style.display = 'flex';
        drawWheel(playersToDraw);

        // 4. Wyślij sygnał do innych
        const randomAngle = Math.floor(Math.random() * 360) + 1440;
        socket.emit('startWheelSpin', {
            alivePlayers: playersToDraw,
            finalAngle: randomAngle
        });
    };
}

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
    
    // Ustawiamy kolor i treść zależnie od roli
    if (role === 'Mafia') {
        textElement.innerText = 'MAFIA';
        textElement.style.color = '#ff4d4d'; // Czerwień
    } else {
        textElement.innerText = 'MIASTO';
        textElement.style.color = '#2ecc71'; // Zieleń
    }

    // Pokazujemy panel
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';

    // Po 3 sekundach zaczynamy znikanie
    setTimeout(() => {
        overlay.style.opacity = '0';
        // Całkowite usunięcie z widoku po zakończeniu animacji (0.8s)
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 800);
    }, 3000);
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

        // --- STYL BAZOWY (zdefiniowany na początku pętli, aby każdy miał dostęp) ---
        const iconBaseStyle = 'cursor:pointer; font-size: 1.3em; display: inline-block; transform: scale(1.2); margin: 0 2px; transition: transform 0.2s;';

        let roleLabel = '';
        let roleClass = '';
        let roleEmoji = '';

        // --- LOGIKA ETYKIET RÓL ---
		if (p.exposed) {
			roleLabel = 'MAFIA 🔍)';
            roleClass = 'role-mafia';
            roleEmoji = '🔴';
		}
		else if (p.isPurified) {
			roleLabel = 'MIASTO ✨';
            roleClass = 'role-city';
            roleEmoji = '🟢';
		}
        else if (p.isHost && p.id === playerId) {
            roleLabel = 'HOST';
            roleClass = 'role-host';
            roleEmoji = '👑';
        } else if (isHost) {
            if (p.role === 'Mafia') {
                roleLabel = 'MAFIA';
                roleClass = 'role-mafia';
                roleEmoji = '🔴';
            } else if (p.role === 'Miasto') {
                roleLabel = 'MIASTO';
                roleClass = 'role-city';
                roleEmoji = '🟢';
            } else if (p.role === 'Gospodarz') {
                roleLabel = 'HOST';
                roleClass = 'role-host';
                roleEmoji = '👑';
            } else {
                roleLabel = 'Brak roli';
                roleClass = 'role-none';
            }
        } else {
            if (p.id === playerId) {
                if (p.role === 'Mafia') {
                    roleLabel = 'MAFIA';
                    roleClass = 'role-mafia';
                    roleEmoji = '🔴';
                } else if (p.role === 'Miasto') {
                    roleLabel = 'MIASTO';
                    roleClass = 'role-city';
                    roleEmoji = '🟢';
                } else {
                    roleLabel = 'Brak roli';
                    roleClass = 'role-none';
                }
            } else if (p.isHost) {
                roleLabel = 'HOST';
                roleClass = 'role-host';
                roleEmoji = '👑';
            } else {
                roleLabel = '';
            }
        }

        // --- LICZENIE GŁOSÓW (UWZGLĘDNIA WAGĘ) ---
        const voteCounts = {};
        Object.entries(votes).forEach(([voterId, targetId]) => {
            const voter = playersCache.find(v => v.id === voterId);
            const weight = (voter && voter.doubleVote) ? 2 : 1;
            voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
        });

        let voteCount = voteCounts[p.id] ? ` 🗳️(${voteCounts[p.id]})` : '';
        
        // Budujemy podstawowy HTML (Nazwa + Rola)
        div.innerHTML = `<span>${p.name} <span class="${roleClass}"> ${roleEmoji} ${roleLabel} </span> ${voteCount}</span>`;

        // --- 🗳️ GŁOSOWANIE (Dla zwykłych graczy) ---
        const amIMuted = mutedPlayers[playerId]; 

        if (!isHost && p.alive && p.id !== playerId && !p.isHost) {
            if (!amIMuted) {
                const vBtn = document.createElement('span');
                vBtn.innerHTML = ' 🗳️';
                vBtn.style.marginLeft = '10px';
                vBtn.style.cursor = 'pointer';
                vBtn.title = "Oddaj głos";
                vBtn.onclick = () => vote(p.id, p.name);
                div.appendChild(vBtn);
            } else {
                const blockedBtn = document.createElement('span');
                blockedBtn.innerHTML = ' 🚫';
                blockedBtn.style.marginLeft = '10px';
                blockedBtn.title = "Jesteś wyciszony!";
                blockedBtn.style.cursor = 'not-allowed';
                div.appendChild(blockedBtn);
            }
        }

        // --- 🎯 CEL MAFII ---
        const me = playersCache.find(ptr => ptr.id === playerId);
        if (me && me.role === 'Mafia' && me.alive && currentPhase === 'Noc') {
            if (p.alive && p.id !== playerId && !p.isHost) {
                const targetBtn = document.createElement('span');
                targetBtn.innerHTML = ' 🎯';
                targetBtn.style.cursor = 'pointer';
                targetBtn.style.marginLeft = '10px';
                targetBtn.onclick = () => socket.emit('mafiaVote', p.id);
                div.appendChild(targetBtn);
            }
        }

        // --- 👑 PANEL HOSTA (PRZYCISKI PRZY NICKACH) ---
        if (isHost && !p.isHost) {
            const mutedIcon = mutedPlayers[p.id] ? '🔇' : '🎤';
            
            // Definicje stylów dla stanów aktywnych
            const eyeStyle = (spyingPlayerId === p.id)
                ? `${iconBaseStyle} color: #ff4d4d; filter: drop-shadow(0 0 5px red);` 
                : `${iconBaseStyle} opacity: 0.8;`;

            const protectStyle = p.protected
                ? `${iconBaseStyle} color: #fff; filter: drop-shadow(0 0 8px #00d4ff);`
                : `${iconBaseStyle} opacity: 0.5;`;

            const vStyle = p.doubleVote 
                ? `${iconBaseStyle} color: gold; filter: drop-shadow(0 0 8px yellow); opacity: 1;` 
                : `${iconBaseStyle} opacity: 0.5;`;

            const cStyle = confusionActive 
                ? `${iconBaseStyle} color: #00ffcc; filter: drop-shadow(0 0 8px #00ffcc); opacity: 1;` 
                : `${iconBaseStyle} opacity: 0.5;`;

            let lifeActionIcon = p.alive 
                ? `<span onclick="toggleAlive('${p.id}')" title="Zabij" style="${iconBaseStyle}">💀</span>`
                : `<span onclick="revive('${p.id}')" title="Wskrześ" style="${iconBaseStyle}">😇</span>`;

            div.innerHTML += `
                <div class="player-buttons" style="display: flex; align-items: center; gap: 10px; margin-left: 20px;">
                    ${lifeActionIcon}
                    <span onclick="toggleProtect('${p.id}')" style="${protectStyle}" title="Tarcza">🛡️</span>
                    <span onclick="handleEyeClick('${p.id}')" style="${eyeStyle}" title="Podgląd kart">👁️</span>
                    <span onclick="socket.emit('toggleDoubleVote', '${p.id}')" style="${vStyle}" title="Podwójny głos">⚖️</span>
					<span onclick="triggerTribunal('${p.id}')" style="cursor:pointer; margin-left:5px;" title="Trybunał Stanu">📯</span>
                    <span onclick="showCardMenu('${p.id}')" style="${iconBaseStyle}" title="Daj kartę">🃏</span>
                    <span onclick="toggleMute('${p.id}')" style="${iconBaseStyle}" title="Wycisz">${mutedIcon}</span>
                    <span onclick="changeRole('${p.id}')" style="${iconBaseStyle}" title="Zmień rolę">🔄</span>
                </div>
            `;
        }

        // --- DODANIE DO ODPOWIEDNIEJ LISTY ---
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

    // Znajdź "mnie" na liście serwerowej
    const me = players.find(p => p.id === socket.id);

    if (me) {
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

//////////////////////////////////////////////////////
// 🔥 LIVE GŁOSY
//////////////////////////////////////////////////////
socket.on('updateVotes', (allVotes) => {
    votes = allVotes; // Zapisujemy to, co przysłał serwer
    renderPlayersWithVotes(); // Wywołujemy funkcję, którą właśnie poprawiliśmy
});

//////////////////////////////////////////////////////
// 🔥 GŁOSOWANIE
//////////////////////////////////////////////////////
async function vote(targetId, targetName){
    if(hasVoted){
        await showModal("Już oddałeś głos!", false);
        return;
    }

    socket.emit('vote',{
        voterId: playerId,
        targetId: targetId
    });

    hasVoted = true;
    votedFor = targetName;

    showVoteInfo(targetName);
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

startGameBtn.onclick = ()=>socket.emit('startGame',socket.id);
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

// 2. FUNKCJA RYSUJĄCA (Naprawiony ReferenceError)
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

    // 1. Sprawdzamy czy to SYSTEM
    if (type === 'system' || sender === 'System' || sender === 'SYSTEM') {
        displaySender = 'SYSTEM';
        senderColor = '#ff4d4d'; // Intensywny czerwony
        msgDiv.classList.add('system');
    } 
    // 2. Sprawdzamy czy to GOSPODARZ (Ruffix22)
    // Sprawdzamy po nicku lub po fladze isHost jeśli ją przesyłasz
    else if (sender === 'Gospodarz' || sender === 'GOSPODARZ') {
        displaySender = 'GOSPODARZ';
        senderColor = '#f1c40f'; // Żółty/Złoty
    }

    // 3. Sprawdzanie czy to Twoja własna wiadomość (żeby dociągnąć do prawej)
    const myNickname = nicknameInput ? nicknameInput.value.trim() : "";
    if (sender === myNickname || (isHost && sender === "Gospodarz")) {
        msgDiv.classList.add('own-message');
    }

    // Dodanie logiki klikania dla Hosta (którą wprowadziliśmy wcześniej)
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

// 3. WYSYŁANIE
function sendMessage() {
    const msgInput = document.getElementById('message');
    if (!msgInput) return;
    
    const text = msgInput.value.trim();
    if (text === "") return;

    const activeTabBtn = document.querySelector('.tab-btn.active');
    const chatType = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'city';
    
    const myName = nicknameInput?.value.trim() || "Gracz";

    // Budujemy obiekt danych
    const payload = { 
        msg: text, 
        from: myName, 
        type: chatType 
    };

    // Jeśli Host jest na zakładce prywatnej, dodajemy ID celu
    if (isHost && chatType === 'private') {
        if (!currentWhisperTarget) {
            appendMessageToChat('System', 'Kliknij najpierw wiadomość gracza, któremu chcesz odpisać!', 'system');
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
    if (isHost) return;
	
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
	
    const revealOverlay = document.getElementById('role-reveal-overlay');
    const revealText = document.getElementById('role-reveal-text');

    if (revealOverlay && revealText) {
        // Ustawiamy nazwę roli
        revealText.innerText = data.role;

        // Ustawiamy kolor napisu w zależności od frakcji
        if (data.faction === 'Mafia') {
            revealText.style.color = '#ff4d4d'; // Czerwony dla Mafii
            revealText.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.8)';
        } else {
            revealText.style.color = '#4da6ff'; // Niebieski dla Miasta
            revealText.style.textShadow = '0 0 20px rgba(77, 166, 255, 0.8)';
        }

        // Pokazujemy animację
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

//////////////////////////////////////////////////////
// 🎴 PANEL KART - HOST I GRACZE
//////////////////////////////////////////////////////
function showCardMenu(targetId){
    if(!isHost) return;

    let menu = document.getElementById('card-menu');
    if(menu) menu.remove();

    menu = document.createElement('div');
    menu.id = 'card-menu';
    // Zachowujemy Twoje stylowanie menu
    menu.style.position='fixed';
    menu.style.top='50%';
    menu.style.left='50%';
    menu.style.transform='translate(-50%,-50%)';
    menu.style.background='#1a1a1a'; // Zmieniłem na ciemny, żeby kolory czcionek były czytelne
    menu.style.padding='20px';
    menu.style.zIndex='9999';
    menu.style.maxHeight='90vh';
    menu.style.overflowY='auto';
    menu.style.border='2px solid gold';
    menu.style.borderRadius='10px';

    const cards = [
        // Dodajemy targetRole: 'city' / 'mafia' / 'both'
        {id:'anarchist', name:'Anarchista', type: 'public', targetRole: 'both'},
        {id:'doctor', name:'Lekarz', type: 'private', targetRole: 'both'},
        {id:'forced_sacrifice', name:'Wymuszona Ofiara', type: 'public', targetRole: 'both'},
        {id:'blood_legacy', name:'Dziedzictwo Krwi', type: 'public', targetRole: 'mafia'},
        {id:'kamikaze', name:'Kamikadze', type: 'public', targetRole: 'both'},
        {id:'delayed_poison', name:'Opóźniona Trucizna', type: 'public', targetRole: 'both'},
        {id:'ally', name:'Sojusznik', type: 'private', targetRole: 'both'},
        {id:'silence_card', name:'Wyciszenie', type: 'public', targetRole: 'both'},
        {id:'power_for_selected', name:'Moc Dla Wybranych', type: 'public', targetRole: 'both'},
        {id:'misfire', name:'Błędny Strzał', type: 'private', targetRole: 'city'},
        {id:'support', name:'Wsparcie', type: 'private', targetRole: 'city'},
        {id:'in_broad_daylight', name:'W Biały Dzień', type: 'public', targetRole: 'mafia'},
		{id:'silent_sabotage', name:'Zmowa Milczenia', type: 'private', targetRole: 'mafia'},
        {id:'tribunal_of_state', name:'Trybunał Stanu', type: 'public', targetRole: 'both'},
        {id:'full_moon', name:'Pełnia Księżyca', type: 'public', targetRole: 'both'},
        {id:'bodyguard', name:'Ochroniarz', type: 'public', targetRole: 'both'},
        {id:'don_decision', name:'Decyzja Dona', type: 'public', targetRole: 'both'},
        {id:'chosen_of_dead', name:'Wybraniec Umarłych', type: 'public', targetRole: 'both'},
        {id:'delayed_execution', name:'Oddalona Egzekucja', type: 'public', targetRole: 'both'},
		{id:'purification', name:'Oczyszczenie', type: 'public', targetRole: 'city'},
        {id:'untouchable', name:'Nietykalny', type: 'private', targetRole: 'city'},
        {id:'miracle_worker', name:'Cudotwórca', type: 'public', targetRole: 'both'},
        {id:'sniper', name:'Snajper', type: 'public', targetRole: 'both'},
        {id:'cancel_power', name:'Karta Anulacji Mocy', type: 'public', targetRole: 'both'},
        {id:'avenger', name:'Mściciel', type: 'public', targetRole: 'both'},
        {id:'uncertain_info', name:'Niepewna Informacja', type: 'private', targetRole: 'city'},
        {id:'fair_judge', name:'Sprawiedliwy Sędzia', type: 'public', targetRole: 'both'},
        {id:'crown_witness', name:'Świadek Koronny', type: 'public', targetRole: 'both'},
        {id:'fog_of_war', name:'Mgła Wojny', type: 'private', targetRole: 'mafia'},
        {id:'recruit', name:'Rekrut', type: 'private', targetRole: 'both'},
        {id:'citizen_rep', name:'Przedstawiciel Obywateli', type: 'public', targetRole: 'both'},
        {id:'tribune', name: 'Trybuna Umarłych', type: 'public', targetRole: 'both' },
        {id:'boss_mama', name:'Boss Mama', type: 'public', targetRole: 'both'}
    ];

    cards.sort((a, b) => a.name.localeCompare(b.name));

    cards.forEach(card=>{
        const btn = document.createElement('button');
        
        // --- LOGIKA KROPEK ( targetRole ) ---
        let dot = '🟡'; // Domyślnie dla wszystkich
        if (card.targetRole === 'city') dot = '🟢';
        if (card.targetRole === 'mafia') dot = '🔴';

        btn.innerHTML = `${dot} ${card.name}`;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.margin = '4px 0';
        btn.style.padding = '8px';
        btn.style.textAlign = 'left';
        btn.style.background = '#222';
        btn.style.border = '1px solid #444';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';

        // --- LOGIKA CZCIONKI ( type ) ---
        if (card.type === 'public') {
            btn.style.color = '#2ecc71'; // Zielona czcionka (Jawna)
        } else {
            btn.style.color = '#e74c3c'; // Czerwona czcionka (Spotkanie)
        }

        btn.onclick=()=>{
            socket.emit('giveCard',{
                playerId: targetId,
                cardId: card.id,
                hostId: playerId
            });
            menu.remove();
        };

        menu.appendChild(btn);
    });

    // Przycisk Anuluj (Twoja wersja)
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.width = '100%';
    buttonWrapper.style.display = 'flex';
    buttonWrapper.style.justifyContent = 'center';
    buttonWrapper.style.marginTop = '20px';
	buttonWrapper.style.gridColumn = "1 / -1";

    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '❌ Anuluj';
    cancelBtn.style.padding = '10px 30px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.color = 'red';
    cancelBtn.style.border = '2px solid red';
    cancelBtn.style.borderRadius = '5px';
    cancelBtn.style.background = '#fff';
    cancelBtn.onclick = () => menu.remove();

    buttonWrapper.appendChild(cancelBtn);
    menu.appendChild(buttonWrapper);
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
            btn.style.filter = 'drop-shadow(0 0 10px #ff00ff)'; // Różowa/fioletowa poświata
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
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
            btn.style.filter = 'drop-shadow(0 0 10px #ffeb3b)'; // Żółta poświata
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

socket.on('coinResult', (data) => {
    const overlay = document.getElementById('coin-overlay');
    const coin = document.getElementById('coin-visual');
	const resultText = document.getElementById('coin-result-text');
    
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
        div.innerHTML = `🪙 MONETA: <b>${data.result}</b>`;
        chatCity.appendChild(div);
        chatCity.scrollTop = chatCity.scrollHeight;
		
		// Zamknij okno po 3 sekundach od pokazania wyniku
        setTimeout(() => {
			overlay.style.display = 'none';
		}, 3000);
	}, 3000);
});

// NA SAMYM DOLE PLIKU:

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
            winnerText.style.color = "#5c1cff";

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
            btn.style.filter = 'drop-shadow(0 0 10px #f1c40f)';
            btn.style.transform = 'scale(1.3)'; // Dodaj to dla spójności z innymi ikonami
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
            btn.style.filter = 'drop-shadow(0 0 10px #e74c3c)'; // Czerwona poświata (kolor Mafii)
            btn.style.transform = 'scale(1.3)';
            btn.style.opacity = '1';
        } else {
            btn.style.filter = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '0.5';
        }
    }
});

socket.on('deadTalkStatus', (isActive) => {
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

// DODAJ TO: Resetowanie gotowości przy zmianie fazy
socket.on('phaseChanged', (phase) => {
    amIReady = false;
    if (skipBtn) {
        skipBtn.classList.remove('is-ready');
        skipBtn.style.background = '#222'; // powrót do domyślnego
        skipBtn.style.opacity = "1";
    }
});
socket.on('updateCards', cards => {
	const cardsPanel = document.getElementById('cards-panel');
    const infoPanel = document.getElementById('card-info-panel');
	
	if (!cardsPanel || !infoPanel) {
		console.error("Błąd: Nie znaleziono paneli kart w HTML!");
		return;
	}
	
	cardsPanel.innerHTML = '';

    // 1. CAŁKOWITE UKRYCIE PANELU NA START
    if (infoPanel) {
        infoPanel.innerHTML = '';
        infoPanel.style.border = 'none';      // Żadnych ramek!
        infoPanel.style.background = 'none';  // Żadnych tła!
        infoPanel.style.minHeight = '0';      // Nie zajmuje miejsca!
        infoPanel.style.height = 'auto';
        infoPanel.style.margin = '0';
    }

    cards.forEach(c => {
        const div = document.createElement('div');
        div.className = 'card ' + (c.type === 'public' ? 'public' : 'private');
        div.style.backgroundImage = `url('cards/${c.id}.png')`;

        // 2. POKAZANIE TYLKO PRZY NAJECHANIU
        div.onmouseenter = () => {
            const typeText = c.type === 'public' 
                ? 'Informacja publiczna.' 
                : 'Informacja prywatna (Gospodarz).';
            
            // Dodajemy tło i padding tylko wtedy, gdy jest tekst
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

        // 3. CAŁKOWITE CZYSZCZENIE PRZY ZEJŚCIU
        div.onmouseleave = () => {
            infoPanel.innerHTML = '';
			infoPanel.style.display = 'none';
            infoPanel.style.background = 'none';
            infoPanel.style.padding = '0';
            infoPanel.style.marginTop = '0';
        };

        div.onclick = async () => {
			if (isHost) {
				addChatMessage("Gospodarz", "Tylko podglądasz te karty. Nie możesz ich użyć.", "system");
				return;
			}
            const me = playersCache.find(p => p.id === playerId);
            if (me && !me.alive) {
                await showModal("Błąd!", "Umarli nie mogą używać kart mocy!", false);
                return;
            }
            
            const confirmed = await showModal("Użycie karty", `Czy na pewno chcesz użyć: ${c.name}?`);
            if (confirmed) {
                socket.emit('useCard', { playerId, cardId: c.id });
                if(infoPanel) {
                    infoPanel.innerHTML = '';
                    infoPanel.style.background = 'none';
                }
            }
        };

        cardsPanel.appendChild(div);
    });
});