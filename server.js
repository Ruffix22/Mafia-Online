// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serwer śmiga na porcie ${PORT}`);
});

// =========================
// 🔥 GAME STATE
// =========================
let players = [];
let currentPhase = 'Dzień';
let votingActive = false;
let deadTalkActive = false;
let mafiaTarget = null;
let confusionActive = false; 
let judgeActive = false;
let delayedExecutionActive = false;
let bossMamaActive = false;
let fullMoonActive = false;
let pendingSilenceTarget = null; 
let silentSabotageActive = false;
let fogOfWarActive = false;
let mafiaTargets = []; 
let votes = {};
let tribunalTarget = null; 
let tribunalVotes = {}; // { playerId: 'guilty' / 'innocent' }
let readyPlayers = new Set();
let cardsDatabase = [
    {id:'anarchist', name:'Anarchista', description:'Wykorzystaj tę kartę by rozpocząć losowanie osoby, która ma zostać natychmiast wyeliminowana z gry. Po losowaniu następuje faza nocy.', type:'public', roles:['Miasto','Mafia']},
    {id:'doctor', name:'Lekarz', description:'Wskaż Gospodarzowi osobę, którą ochronisz przed wyrokiem Mafii w trakcie najbliższej nocy.', type:'private', roles:['Miasto','Mafia']},
    {id:'tribunal_of_state', name:'Trybunał Stanu', description:'Wskaż osobę, która automatycznie trafia przed Sąd Żywych. Miasto decyduje większością głosów czy zostanie wyeliminowana.', type:'public', roles:['Miasto','Mafia']},
    {id:'forced_sacrifice', name:'Wymuszona Ofiara', description:'Wskaż osobę, która jest eliminowana z rozgrywki, ale może ona na swoje miejsce przywrócić innego, martwego gracza.', type:'public', roles:['Miasto','Mafia']},
    {id:'kamikaze', name:'Kamikadze', description:'Możesz wyeliminować dowolną osobę z gry, ale ty również zostajesz wyeliminowany.', type:'public', roles:['Miasto','Mafia']},
    {id:'delayed_poison', name:'Opóźniona Trucizna', description:'Wyeliminuj dowolną osobę, ale przejdzie ona do świata umarłych dopiero następnego dnia rano.', type:'public', roles:['Miasto','Mafia']},
	{id:'in_broad_daylight', name:'W Biały Dzień', description:'Możesz wyeliminować dowolną osobę, ale natychmiast zostajesz schwytany i opuszczasz rozgrywkę.', type:'public', roles:['Mafia']},
    {id:'ally', name:'Sojusznik', description:'Gospodarz wskazuje Ci osobę, która jest Mieszkańcem. Nie możesz o tym poinformować innych graczy wprost.', type:'private', roles:['Miasto','Mafia']},
	{id:'fog_of_war', name:'Mgła Wojny', description:'Podczas najbliższego głosowania licznik głosów będzie widoczny tylko dla Gospodarza.', type:'private', roles:['Mafia']},
    {id:'silence_card', name:'Wyciszenie', description:'Użycie tej karty blokuje możliwość zagrania jakiejkolwiek innej karty do końca rundy.', type:'public', roles:['Miasto','Mafia']},
    {id:'power_for_selected', name:'Moc Dla Wybranych', description:'Ty oraz dwie wybrane przez Ciebie osoby otrzymujecie kartę mocy.', type:'public', roles:['Miasto','Mafia']},

    {id:'misfire', name:'Błędny Strzał', description:'Najbliższej nocy osoba wyeliminowana przez mafie jest losowa. Strzał może również trafić w członka mafii.', type:'private', roles:['Miasto','Mafia']},
    {id:'support', name:'Wsparcie', description:'Wskaż gospodarzowi osobę, z którą będziesz bezpieczny najbliższej nocy.', type:'private', roles:['Miasto','Mafia']},
    {id:'full_moon', name:'Pełnia Księżyca', description:'Następnej nocy prócz celu wskazanego przez Mafię zginie jeden, losowy Obywatel. W zamian gospodarz ujawnia mieszkańcom tożsamość jednego z mafiozów.', type:'private', roles:['Miasto','Mafia']},

    {id:'bodyguard', name:'Ochroniarz', description:'Wskaż dwie osoby, które nie będą mogły brać udziału w najbliższym głosowaniu. Nie mogą one zostać wyeliminowane w jego trakcie.', type:'public', roles:['Miasto','Mafia']},
    {id:'don_decision', name:'Decyzja Dona', description:'Musisz zagrać te kartę od razu. Następuje rzut monetą, który decyzuje o tym czy odpadniesz z gry czy przeżyjesz.', type:'public', roles:['Miasto','Mafia']},
    {id:'chosen_of_dead', name:'Wybraniec Umarłych', description:'Użyj tej karty by przywrócić do świata żywych losowego gracza.', type:'public', roles:['Miasto','Mafia']},

    {id:'delayed_execution', name:'Oddalona Egzekucja', description:'Zagraj te kartę aby ochronić członka Mafii w najbliższym głosowaniu. Jeśli wskazany gracz jest z Mafii, nie odpada z gry.', type:'public', roles:['Miasto','Mafia']},
    {id:'untouchable', name:'Nietykalny', description:'Użyj tej karty by otrzymać nietykalność. Nie możesz zostać wyeliminowany następnej nocy przez Mafie.', type:'private', roles:['Miasto','Mafia']},

    {id:'miracle_worker', name:'Cudotwórca', description:'Wskaż osobę ze Świata Umarłych, która natychmiast powróci do gry.', type:'public', roles:['Miasto','Mafia']},
    {id:'sniper', name:'Snajper', description:'Wskaż osobę którą chcesz wyeliminować z gry. Jeżeli trafisz Obywatela- odpadasz razem z nim.', type:'public', roles:['Miasto','Mafia']},
    {id:'cancel_power', name:'Karta Anulacji Mocy', description:'Wskaż gracza, którego zagrana karta mocy straci swoje działanie.', type:'public', roles:['Miasto','Mafia']},
	{id:'purification', name:'Oczyszczenie', description:'Ujawniasz wszystkim swoją rolę, ale tracisz wszystkie inne karty oraz możliwość oddania głosu.', type:'public', roles:['Miasto']},
    {id:'avenger', name:'Mściciel', description:'Jeżeli zostałeś wskazany do opuszczenia gry, wskazujesz osobę, która opuści ją zamiast Ciebie.', type:'public', roles:['Miasto','Mafia']},
	{id:'silent_sabotage', name:'Zmowa Milczenia', description:'Wskaż Gospodarzowi gracza, który ma zostać uciszony następnego dnia. Nie może on rozmawiać ani głosować', type:'private', roles:['Mafia']},
    {id:'uncertain_info', name:'Niepewna Informacja', description:'Wskaż Gospodarzowi trzy podejrzane osoby a ten poinformuje Cię ilu Mafiozów jest wśród nich. Nie możesz się z nikim podzielić tą informacją.', type:'private', roles:['Miasto','Mafia']},
	{id:'blood_legacy', name:'Dziedzictwo Krwi', description:'Po zagraniu tek karty zostajesz wyeliminowany z gry, lecz w Twoje miejsce zostaje powołany dodatkowy Mafiozo.', type:'public', roles:['Mafia']},
    {id:'fair_judge', name:'Sprawiedliwy Sędzia', description:'W trakcie najbliższego głosowania wyeliminowany może być tylko Mafiozo. Jeśli w głosowaniu zostanie wybrany Obywatel, nie zostanie usunięty z rozgrywki.', type:'public', roles:['Miasto','Mafia']},
    {id:'crown_witness', name:'Świadek Koronny', description:'Zyskujesz immunitet i nie możesz zostać wyeliminowany z gry podczas następnego głosowania.', type:'public', roles:['Miasto','Mafia']},

    {id:'recruit', name:'Rekrut', description:'Dołączasz do grona Mafii i budzisz się z nimi w najbliższej fazie nocy. Zostajesz Mafią do końca gry.', type:'private', roles:['Miasto','Mafia']},
	{id:'tribune', name: 'Trybuna Umarłych', description:'Użyj tej karty aby uciszyć żyjących i przenieść dalszą dyskusję z głosowaniem na ręce umarłych. Dziś to oni zdecydują kto odpada.', type: 'public', roles:['Miasto','Mafia']},
    {id:'citizen_rep', name:'Przedstawiciel Obywateli', description:'Wskaż osobę, która będzie miała podwójny głos do końca rozgrywki. Nie możesz wskazać siebie.', type:'public', roles:['Miasto','Mafia']},

    {id:'boss_mama', name:'Boss Mama', description:'Używając tej karty wyciszasz mafię następnej nocy. Nie może ona wtedy nikogo wyeliminować.', type:'public', roles:['Miasto','Mafia']}
];

// =========================
// 🔥 SOCKET.IO
// =========================
io.on('connection', socket => {
	
	// 🔥 RZUT MONETĄ (DECYZJA DONA)
	socket.on('tossCoin', (hostId) => {
		const host = players.find(p => p.id === hostId && p.isHost);
		if (!host) return;
		
		const result = Math.random() < 0.5 ? 'Łaska Dona' : 'Wyrok Dona';
		const color = result === 'Łaska Dona' ? '#2ecc71' : '#e74c3c'; // Zielony vs Czerwony
		
		io.emit('coinResult', { result, color });
	});
	
	socket.on('mafiaVote', (targetId) => {
    const sender = players.find(p => p.id === socket.id);
    // Tylko żywa mafia może wybierać cel i tylko w nocy
    if (sender && sender.role === 'Mafia' && sender.alive && currentPhase === 'Noc') {
        mafiaTarget = targetId;
        const targetName = players.find(p => p.id === targetId)?.name;
        
        // Informujemy całą mafię o wyborze (żeby widzieli kogo wybrali koledzy)
        players.forEach(p => {
			if (p.role === 'Mafia') {
				io.to(p.id).emit('systemMessage', `[MAFIA] Cel ustawiony na: ${targetName}`);
			}
		});
    }
});
	// 🎲 KOŁO FORTUNY
	socket.on('startWheelSpin', (data) => {
		io.emit('syncWheelSpin', data);
});
    socket.on('requestWheelClose', () => {
		io.emit('forceCloseWheel'); // Serwer krzyczy do wszystkich: "Zamykać koła!"
});
    socket.on('announceWheelResult', ({ winnerName }) => {
		io.emit('systemMessage', `🎰 KOŁO FORTUNY: Wybranym graczem zostaje ${winnerName}!`);
	});
	
    // 🎮 DOŁĄCZENIE GRACZA
    socket.on('joinGame', ({name, isHost})=>{
        if(!name) return;

        // Sprawdź czy gracz już istnieje
        if(players.find(p=>p.id===socket.id)) return;

        const player = {
            id: socket.id,
            name: name.trim(),
            isHost: !!isHost,
            alive: true,
            role: isHost ? null : undefined,
            cards: [],
            muted: false,  // nowa właściwość wyciszenia
			doubleVote: false
        };
        players.push(player);

        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });
	
	// 👁️ HOST PODGLĄDA KARTY
    socket.on('hostRequestPlayerCards', (targetId) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        const targetPlayer = players.find(p => p.id === targetId);
        if (targetPlayer) {
            // Wysyłamy karty celu tylko do Hosta
            socket.emit('updateCards', targetPlayer.cards);
            socket.emit('systemMessage', `Podglądasz karty gracza: ${targetPlayer.name}`);
        }
    });

	function resetVotingModifiers() {
    judgeActive = false;
    delayedExecutionActive = false;
    io.emit('updateJudgeState', false);
    io.emit('updateDelayedExecutionState', false);
	}


    // 🕹 START GRY
    socket.on('startGame', (hostId) => {
    console.log("Otrzymano próbę startu od:", hostId);

    const allPlayers = Object.values(players);
    const host = players[hostId] || allPlayers.find(p => p.isHost);

    if (!host || !host.isHost) {
        console.log("Błąd: Próba startu przez osobę bez uprawnień Hosta.");
        return;
    }

    // Wybieramy tylko graczy, którzy NIE są hostem
    const participants = allPlayers.filter(p => !p.isHost);

    if (participants.length === 0) {
        console.log("Błąd: Brak graczy do rozpoczęcia gry.");
        socket.emit('systemMessage', 'Potrzebujesz przynajmniej jednego gracza (poza Hostem), by zacząć!');
        return;
    }

    // 1. Reset i przypisanie ról TYLKO uczestnikom
    // Hostowi nadajemy specjalną rolę, żeby system nie traktował go jako gracza
    allPlayers.forEach(p => {
        if (p.isHost) {
            p.role = 'Gospodarz';
            p.faction = 'Neutralny';
        } else {
            p.role = 'Miasto';
            p.faction = 'Miasto';
        }
    });

    // Losowanie Mafii tylko z uczestników
    const mafiaCount = Math.max(1, Math.floor(participants.length / 3));
    const shuffled = [...participants].sort(() => 0.5 - Math.random());

    for (let i = 0; i < mafiaCount; i++) {
        shuffled[i].role = 'Mafia';
        shuffled[i].faction = 'Mafia';
    }

    // 2. Synchronizacja
    io.emit('updatePlayers', Object.values(players));
    
    // Wysyłamy rolę do każdego gracza indywidualnie
    // (Dzięki temu Host nie dostanie powiadomienia, bo sprawdzimy to w app.js)
    Object.values(players).forEach(p => {
        io.to(p.id).emit('yourRole', { role: p.role, faction: p.faction });
		io.to(p.id).emit('systemMessage', `🕵️ Twoja rola w tej rozgrywce to: ${p.role.toUpperCase()}`);
    });

    currentPhase = 'Dzień';
    io.emit('phaseChanged', currentPhase);
    io.emit('systemMessage', 'Gra rozpoczęta! Nastał DZIEŃ.');
    console.log("Gra pomyślnie wystartowała.");
    });
	

    // 🌞🌜 ZMIANA FAZY
    socket.on('changePhase', (phase, hostId) => {
        const host = players.find(p => p.id === hostId && p.isHost);
        if (!host) return;

        readyPlayers.clear();

        // Pomocnicza zmienna do logiki
        const p = phase.toLowerCase();
        console.log(`[DEBUG] Zmiana fazy na: ${phase}, Cel uciszenia: ${pendingSilenceTarget}`);

        // SPRAWDZAMY CZY NASTAJE DZIEŃ (Obsługuje "dzień", "Dzień", "dzien")
        if (p.includes('dzień') || p.includes('dzien')) {

            // --- 🤫 LOGIKA ZMOWY MILCZENIA ---
            // Sprawdzamy to NA SAMYM POCZĄTKU poranka
            if (pendingSilenceTarget) {
                const silentVictim = players.find(p => p.id === pendingSilenceTarget);
                if (silentVictim && silentVictim.alive) {
                    io.emit('systemMessage', `📢 ZMOWA MILCZENIA: Gracz ${silentVictim.name} został uciszony tej nocy! Nie może dziś mówić ani głosować.`);
                } else {
					console.log(`[DEBUG] Cel uciszenia nie znaleziony lub martwy.`);
				}
				
                // CZYŚCIMY FLAGI
                pendingSilenceTarget = null;
                silentSabotageActive = false;
            }

            // --- 💀 LOGIKA ELIMINACJI MAFII ---
            if (mafiaTarget) {
                if (bossMamaActive) {
                    mafiaTarget = null;
                    io.emit('systemMessage', '🤫 Noc minęła w całkowitym spokoju... Boss Mama dopilnowała porządku.');
                    bossMamaActive = false;
                    io.emit('updateBossMamaState', false);
                } 
                else {
                    // Logika Confusion (Błędny strzał)
                    if (confusionActive) {
                        const alivePlayers = players.filter(p => p.alive && !p.isHost);
                        if (alivePlayers.length > 0) {
                            const randomIndex = Math.floor(Math.random() * alivePlayers.length);
                            const randomVictim = alivePlayers[randomIndex];
                            mafiaTarget = randomVictim.id;
                            io.emit('systemMessage', '🌀 Błędny strzał! Kula rykoszetowała i trafiła w losowego gracza...');
                        }
                        confusionActive = false; 
                        io.emit('updateConfusionState', false);
                    }
                    
                    // Finalizacja zabójstwa
                    const victim = players.find(p => p.id === mafiaTarget);
                    if (victim && victim.alive && !victim.protected) {
                        victim.alive = false;
                        victim.cards = [];
                        io.emit('systemMessage', `🚨 Noc była niespokojna... Nie żyje: ${victim.name}`);
                        io.to(victim.id).emit('updateCards', []);
                    } else if (victim && victim.protected) {
                        io.emit('systemMessage', `🛡️ Ktoś uniknął śmierci tej nocy!`);
                    }
                    
                    // Logika Pełni Księżyca
                    if (fullMoonActive) {
                        io.emit('systemMessage', '🌕 Pełnia Księżyca zebrała krwawe żniwo... Padł drugi strzał!');
                        const citizens = players.filter(p => p.alive && !p.isHost && p.role !== 'Mafia');
                        if (citizens.length > 0) {
                            const secondVictim = citizens[Math.floor(Math.random() * citizens.length)];
                            secondVictim.alive = false;
                            secondVictim.cards = [];
                            io.emit('systemMessage', `🚨 Druga ofiara Pełni (Obywatel) to: ${secondVictim.name}`);
                            io.to(secondVictim.id).emit('updateCards', []);
                        }
                        const aliveMafia = players.filter(p => p.role === 'Mafia' && p.alive);
                        if (aliveMafia.length > 0) {
                            const exposed = aliveMafia[Math.floor(Math.random() * aliveMafia.length)];
                            exposed.exposed = true; 
                            io.emit('systemMessage', `🔍 Blask księżyca zdemaskował mordercę! ${exposed.name} TO MAFIA!`);
                        }
                        fullMoonActive = false;
                        io.emit('updateFullMoonState', false);
                    }
                }
                mafiaTarget = null;
            }
            
            // Czyszczenie osłon na koniec nocy
            players.forEach(p => p.protected = false);
            io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
        }

        // 2. NA KOŃCU AKTUALIZUJEMY FAZĘ I WYSYŁAMY INFO
        currentPhase = phase;
        io.emit('phaseChanged', currentPhase);
        io.emit('systemMessage', `Rozpoczyna się faza ${phase}!`);
    });
	

    // 🗳️ ROZPOCZĘCIE GŁOSOWANIA
    socket.on('startVoting', hostId => {
        const host = players.find(p => p.id === hostId && p.isHost);
        if (!host) return;
		
		readyPlayers.clear();
        votingActive = true;
        votes = {}; // Czyścimy stare głosy
        io.emit('votingStarted');
        io.emit('systemMessage', '📢 Rozpoczyna się głosowanie! Oddajcie swoje głosy.');
    });

    // 🗳️ ZAKOŃCZENIE GŁOSOWANIA
    socket.on('endVoting', hostId => {
        const host = players.find(p => p.id === hostId && p.isHost);
        if (!host) return;

        votingActive = false;

        // 1. Policz PUNKTY
        let voteCounts = {}; 
        for (let voterId in votes) {
            let targetId = votes[voterId];
            const voter = players.find(p => p.id === voterId);
            const weight = (voter && voter.doubleVote) ? 2 : 1;
            voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
        }

        // 2. Znajdź kto ma najwięcej PUNKTÓW
        let maxPoints = 0;
        let eliminated = null;
        let tie = false;

        for (let targetId in voteCounts) {
            if (voteCounts[targetId] > maxPoints) {
                maxPoints = voteCounts[targetId];
                eliminated = targetId;
                tie = false;
            } else if (voteCounts[targetId] === maxPoints && maxPoints > 0) {
                tie = true; 
            }
        }

        // 3. Logika eliminacji lub ochrony
        if (tie) {
            io.emit('systemMessage', '⚖️ Głosowanie zakończone remisem punktowym! Nikt nie odpada.');
            resetVotingModifiers(); // Czyścimy ikonki, bo głosowanie się odbyło
        } else if (eliminated) {
            const player = players.find(p => p.id === eliminated);
            if (player) {
                // --- 👨‍⚖️ SPRAWIEDLIWY SĘDZIA (Dla Miasta) ---
                if (judgeActive && player.role !== 'Mafia') {
                    io.emit('systemMessage', `⚖️👨‍⚖️ Sprawiedliwy Sędzia przerywa egzekucję! ${player.name} jest Obywatelem i zostaje uniewinniony.`);
                    resetVotingModifiers();
                }
                // --- 🎭 ODDALONA EGZEKUCJA (Dla Mafii) ---
                else if (delayedExecutionActive && player.role === 'Mafia') {
                    io.emit('systemMessage', `🎭 Oddalona Egzekucja! Wyrok na ${player.name} zostaje wstrzymany. Mafia zostaje w grze!`);
                    resetVotingModifiers();
                }
                // --- 🛡️ TARCZA LEKARZA ---
                else if (player.protected) {
                    io.emit('systemMessage', `🛡️ ${player.name} miał tarczę! Wyrok zostaje anulowany.`);
                    resetVotingModifiers();
                } 
                // --- 💀 ŚMIERĆ ---
                else {
                    player.alive = false;
                    player.cards = [];
                    io.emit('systemMessage', `🗳️ Głosowanie zakończone: ${player.name} zostaje wyeliminowany! (Punkty: ${maxPoints})`);
                    io.to(player.id).emit('updateCards', []);
                    resetVotingModifiers();
                }
            }
        } else {
            io.emit('systemMessage', '🗳️ Nikt nie oddał głosów. Głosowanie nieważne.');
            resetVotingModifiers();
        }

        // 4. Czyścimy głosy i odświeżamy widok
        votes = {};
		fogOfWarActive = false;
        io.emit('updateVotes', votes); 
        io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
    });
	
    // 🗳️ ODDANIE GŁOSU
    socket.on('vote', ({voterId, targetId}) => {
        const voter = players.find(p => p.id === voterId);
        if (!voter) return;
        
        // 🔥 NOWE: BLOKADA DLA WYCISZONYCH (OCHRONIARZ)
        if (voter.muted) {
            io.to(voterId).emit('systemMessage', 'Jesteś wyciszony (Ochroniarz)! Nie możesz oddawać głosu.');
            return;
        }
        
        if (deadTalkActive) {
            if (voter.alive) {
                io.to(voterId).emit('systemMessage', 'Teraz głosują tylko umarli! Czekaj na swoją kolej.');
                return;
            }
        } else {
            if (!voter.alive) {
                io.to(voterId).emit('systemMessage', 'Jako martwy nie możesz teraz głosować!');
                return;
            }
        }
    
        if (!votingActive) return;
        
        const targetPlayer = players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.isHost) {
            io.to(voterId).emit('systemMessage', 'Nie możesz głosować na gospodarza!');
            return;
        }
        
        votes[voterId] = targetId;

        // --- MODYFIKACJA DLA MGŁY WOJNY ---
        if (fogOfWarActive) {
            players.forEach(p => {
				if (p.isHost || p.role === 'Mafia') {
					io.to(p.id).emit('updateVotes', votes);
				} else {
					io.to(p.id).emit('updateVotes', {});
				}
			});
            
            // Opcjonalnie: potwierdzenie dla głosującego (tylko dla niego)
            io.to(voterId).emit('systemMessage', '🌑 Oddałeś głos (Mgła Wojny ukrywa wyniki przed innymi).');
        } else {
            // Standardowe działanie - wszyscy widzą wszystko
            io.emit('updateVotes', votes);
        }
		
    });

    // 💀 TRYBUNA UMARŁYCH
    socket.on('toggleDeadTalk', () => {
		deadTalkActive = !deadTalkActive;
		const status = deadTalkActive ? "AKTYWOWANA! Martwi mogą pisać i głosować." : "ZAKOŃCZONA.";
		io.emit('systemMessage', `💀 TRYBUNA UMARŁYCH została ${status}`);
		io.emit('deadTalkStatus', deadTalkActive); // Informujemy aplikację graczy
	});
	
	socket.on('toggleDoubleVote', (targetId) => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;
		
		const target = players.find(p => p.id === targetId);
		if (target) {
			target.doubleVote = !target.doubleVote;
            io.emit('updatePlayers', players);
			io.emit('systemMessage', `Gracz ${target.name} ma teraz ${target.doubleVote ? 'PODWÓJNY' : 'zwykły'} głos!`);
		}
	});
	
	// ✅ OBSŁUGA PRZYCISKU GOTOWOŚCI
    socket.on('playerReady', (playerId) => {
        const player = players.find(p => p.id === playerId);
        if (!player || !player.alive || player.isHost) return;

        readyPlayers.add(playerId);

        // Liczymy tylko żywych graczy (bez hosta)
        const alivePlayers = players.filter(p => p.alive && !p.isHost);
        
        io.emit('updateReadyCount', readyPlayers.size, alivePlayers.length);

        // Jeśli wszyscy żywi kliknęli "Gotowy"
        if (readyPlayers.size >= alivePlayers.length && alivePlayers.length > 0) {
            readyPlayers.clear();
            io.emit('systemMessage', "⏩ Wszyscy gotowi! Gospodarzu, czas podjąć decyzję lub czekamy na automat...");
            
            // Opcjonalnie: Możesz tu dodać automatyczne wywołanie zmiany fazy, 
            // ale bezpieczniej zostawić to do decyzji Hosta lub końca timera w app.js
        }
    });
		socket.on('toggleConfusion', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        confusionActive = !confusionActive;
        socket.emit('systemMessage', confusionActive 
            ? '🌀 Karta Błędny Strzał została aktywowana! Najbliższa noc będzie nieprzewidywalna...' 
            : '🌀 Efekt Błędnego Strzału został wyłączony.');
    
        // Opcjonalnie wysyłamy aktualizację do hosta, żeby widział stan na przycisku
        io.emit('updateConfusionState', confusionActive);
	});
	
	socket.on('toggleFullMoon', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        fullMoonActive = !fullMoonActive;
    
        // Potwierdzenie TYLKO dla Hosta
        socket.emit('systemMessage', fullMoonActive 
            ? '🌕 Pełnia Księżyca aktywowana. Mafia będzie mogła zabić 2 osoby.' 
            : '🌕 Pełnia Księżyca wyłączona.');

        // Powiadomienie TYLKO dla Mafii (jeśli karta jest włączona)
        if (fullMoonActive) {
            players.filter(p => p.role === 'Mafia').forEach(m => {
                io.to(m.id).emit('systemMessage', '🌕 Blask Pełni dodaje Wam sił! Tej nocy zginie dodatkowo jeden, losowy obywatel!');
            });
        }

        io.emit('updateFullMoonState', fullMoonActive);
    });

	socket.on('toggleJudge', () => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        judgeActive = !judgeActive;
        // Tutaj komunikat jest jawny dla WSZYSTKICH (io.emit)
        io.emit('systemMessage', judgeActive 
            ? '⚖️ Sprawiedliwy Sędzia pojawił się na sali! W tym głosowaniu niewinni są bezpieczni.' 
            : '⚖️ Sędzia opuścił salę.');
        io.emit('updateJudgeState', judgeActive);
    });
	
	// 🏛️ AKTYWACJA TRYBUNAŁU (tylko Host)
    socket.on('startTribunal', (targetId) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        const target = players.find(p => p.id === targetId);
        if (!host || !target) return;

        tribunalTarget = targetId;
        tribunalVotes = {};
        
        io.emit('systemMessage', `🏛️ TRYBUNAŁ STANU! ${target.name} zostaje postawiony przed sądem obywatelskim!`);
        io.emit('tribunalStarted', { targetId: target.id, targetName: target.name });
    });

    // 🗳️ ODDANIE GŁOSU W TRYBUNALE
    socket.on('castTribunalVote', (decision) => {
        if (!tribunalTarget) return;
        tribunalVotes[socket.id] = decision;
		const count = Object.keys(tribunalVotes).length;
        io.emit('updateTribunalStatus', count);
		console.log(`Głos w trybunale od ${socket.id}: ${decision}`);

        io.emit('updateTribunalStatus', Object.keys(tribunalVotes).length);
    });

    // ⚖️ ROZSTRZYGNIĘCIE TRYBUNAŁU
    socket.on('endTribunal', () => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host || !tribunalTarget) return;

        const votes = Object.values(tribunalVotes);
        const guiltyCount = votes.filter(v => v === 'guilty').length;
        const innocentCount = votes.filter(v => v === 'innocent').length;
        const victim = players.find(p => p.id === tribunalTarget);

        if (victim) {
			if (guiltyCount > innocentCount) {
				victim.alive = false;
				victim.cards = [];
				io.emit('systemMessage', `⚖️ WYROK: ${victim.name} uznany za WINNEGO (${guiltyCount} do ${innocentCount}). Gracz odpada!`);
				io.to(victim.id).emit('updateCards', []);
            } else {
                io.emit('systemMessage', `⚖️ Trybunał uznał ${victim.name} za NIEWINNEGO (${innocentCount} do ${guiltyCount}). Gracz zostaje w grze!`);
			}
		}

        tribunalTarget = null;
        tribunalVotes = {};
        io.emit('tribunalEnded');
        io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
    });
	
	socket.on('toggleDelayedExecution', () => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        delayedExecutionActive = !delayedExecutionActive;
        io.emit('systemMessage', delayedExecutionActive 
            ? '🎭 Aktywowano Oddaloną Egzekucję! Mafia jest pod ochroną w tym głosowaniu.' 
            : '🎭 Oddalona Egzekucja została wyłączona.');
        io.emit('updateDelayedExecutionState', delayedExecutionActive);
    });
	
	socket.on('toggleBossMama', () => {
       const host = players.find(p => p.id === socket.id && p.isHost);
       if (!host) return;

       bossMamaActive = !bossMamaActive;
    
       // Powiadomienie jest JAWNE dla wszystkich
       io.emit('systemMessage', bossMamaActive 
           ? '💃 Boss Mama wkracza do gry! Tej nocy nikt nie zginie z rąk Mafii.' 
           : '💃 Boss Mama opuszcza posterunek.');
        
       io.emit('updateBossMamaState', bossMamaActive);
    });

    // 🔄 TOGGLE ALIVE
    socket.on('toggleAlive', (targetId, hostId)=>{
        const host = players.find(p=>p.id===hostId && p.isHost);
        if(!host) return;
        const player = players.find(p=>p.id===targetId);
        if(player){ 
			player.alive = !player.alive;
			if (!player.alive) {
				player.cards = [];
				io.to(player.id).emit('updateCards', []);
			}
		}
        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });

    // 😇 WSKRZESZENIE
    socket.on('revive', (targetId, hostId)=>{
        const host = players.find(p=>p.id===hostId && p.isHost);
        if(!host) return;
        const player = players.find(p=>p.id===targetId);
        if(player) player.alive=true;
        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });

    // 🔄 ZMIANA ROLI
    socket.on('changeRole', (targetId, hostId)=>{
        const host = players.find(p=>p.id===hostId && p.isHost);
        if (!host) {
			console.log("BŁĄD: Próba zmiany roli przez osobę bez uprawnień Hosta");
			return;
		}
		
        const player = players.find(p=>p.id===targetId);
        if(player && !player.isHost){
            player.role = player.role==='Mafia' ? 'Miasto' : 'Mafia';
			console.log(`Wysyłam nową rolę (${player.role}) do gracza ${player.name} (ID: ${player.id})`);
			io.to(player.id).emit('roleRevealed', player.role);
			io.to(player.id).emit('systemMessage', `🚨 TWOJA ROLA ZOSTAŁA ZMIENIONA! TERAZ GRASZ JAKO: ${player.role.toUpperCase()}`);
        }
        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });

    // 🔇 WYCISZ / ODCISZ GRACZA
    socket.on('toggleMute', (data) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        // data to obiekt {playerId: id, muted: true/false} wysłany z app.js
        const targetId = data.playerId; 
        const player = players.find(p => p.id === targetId);

        if (player) {
            player.isMuted = data.muted; // Ustawiamy stan dokładnie tak, jak przyszedł z aplikacji

            // Logika zapamiętywania dla Zmowy Milczenia
            if (player.isMuted && currentPhase.toLowerCase().includes('noc')) {
                pendingSilenceTarget = targetId;
                // Powiadomienie dla Hosta (Ciebie)
                socket.emit('systemMessage', `✅ Zapamiętano uciszenie gracza: ${player.name}`);
            }
        }
        io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
    });
	
    // 💬 WIADOMOŚCI
    socket.on('sendMessage', ({msg, from, type, to})=>{
        const sender = players.find(p=>p.id===socket.id);
		if(!sender) return;
		
		const dataToSend = {
			msg: msg, 
            from: sender.isHost ? "Gospodarz" : from, // Serwer sam podmienia nick na "Gospodarz"
            type: type,
            fromHost: sender.isHost, // Dodatkowa flaga dla CSS/Kolorów
            senderId: socket.id
		};
		
		if (type === 'private') {
			const host = players.find(p => p.isHost);
			
			// SCENARIUSZ A: Zwykły gracz pisze do Hosta
            if (!sender.isHost) {
				const whisperData = { msg, from, type: 'private', senderId: socket.id };
				socket.emit('chatMessage', whisperData);
				if (host) io.to(host.id).emit('chatMessage', whisperData);
			}
			
			// SCENARIUSZ B: Host odpisuje konkretnemu graczowi (używamy 'to')
            else if (sender.isHost && to) {
				const whisperData = { msg, from: "Gospodarz", type: 'private', senderId: socket.id };
                io.to(to).emit('chatMessage', whisperData); // Wysyła do wybranego gracza
                socket.emit('chatMessage', whisperData);    // Pokazuje Hostowi u niego
			}
			return;
		}
		
		// --- 1. FILTR CZATU MIASTA ---
		if (type === 'city') {
			// Blokada pisania w nocy dla wszystkich (poza Trybuną, jeśli trwa)
			if (currentPhase === 'Noc' && !deadTalkActive) {
                io.to(socket.id).emit('systemMessage', 'W nocy Miasto śpi. Nie możesz teraz pisać!');
                return;
			}
			
			// Standardowa blokada dla umarłych (którą już masz)
			if (!deadTalkActive && !sender.alive) {
				io.to(socket.id).emit('systemMessage', 'Nie żyjesz - nie możesz pisać na czacie miasta!');
                return;
			}
			
			io.emit('chatMessage', dataToSend);
			return;
		}
		
		// --- 2. FILTR CZATU MAFII ---
		if (type === 'mafia') {
			const isMafia = ['Mafia', 'Killer', 'Boss'].includes(sender.role);
			if (!isMafia) {
				io.to(socket.id).emit('systemMessage', 'Nie należysz do Mafii!');
				return;
			}
			
			if (currentPhase !== 'Noc') {
				io.to(socket.id).emit('systemMessage', 'Czat Mafii aktywuje się tylko w nocy!');
                return;
			}
			
			players.forEach(p => {
				const pIsMafia = ['Mafia', 'Killer', 'Boss'].includes(p.role);
                if (pIsMafia || p.isHost) { // Host też widzi, żeby wiedzieć co robią
                    io.to(p.id).emit('chatMessage', { msg, from, type: 'mafia' });
				}
			});
			return;
		}
	});
	
    // 🎴 PRZYZNAWANIE KART
    socket.on('giveCard', ({playerId, cardId, hostId})=>{
        const host = players.find(p=>p.id===hostId && p.isHost);
        if(!host) return;

        const target = players.find(p=>p.id===playerId);
        if(!target) return;
	
		const card = cardsDatabase.find(c=>c.id===cardId);
		if(!card) return;
		
		if(!target.cards || !Array.isArray(target.cards)){
			target.cards = [];
        }
		
		target.cards.push(card);
		
		io.to(target.id).emit('updateCards', target.cards);
    });

    // 🎴 UŻYCIE KARTY
    socket.on('useCard', ({playerId, cardId})=>{
        const player = players.find(p=>p.id===playerId);
        if(!player) return;

        const card = player.cards.find(c => c.id === cardId);
        if(!card) return;
        
        // --- SPECJALNA LOGIKA: W BIAŁY DZIEŃ ---
        if (cardId === 'in_broad_daylight') {
            io.emit('systemMessage', `💥 BRAWUROWY ATAK! Gracz ${player.name} używa karty "W Biały Dzień"!`);
            io.emit('systemMessage', `📢 Złoczyńca zostaje natychmiast schwytany i opuszcza grę!`);
            player.alive = false;
            player.cards = []; 
            io.emit('systemMessage', `⚠️ GOSPODARZU! Wyeliminuj teraz osobę wskazaną przez ${player.name}!`);
            io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
        }
        
        // --- SPECJALNA LOGIKA: OCZYSZCZENIE ---
        else if (cardId === 'purification') {
            io.emit('systemMessage', `✨ OCZYSZCZENIE! Gracz ${player.name} ujawnia swoją duszę!`);
            player.cards = []; 
            player.isPurified = true; 
            io.emit('systemMessage', `⚠️ ${player.name} traci siłę głosu i wszystkie karty mocy.`);
            io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
        }
        
		        // --- SPECJALNA LOGIKA: MGŁA WOJNY ---
        else if (cardId === 'fog_of_war') {
            fogOfWarActive = true;
            const host = players.find(p => p.isHost);
            if (host) {
				io.to(host.id).emit('systemMessage', `[MAFIA] 🌑 ${player.name} użył Mgły Wojny. Podczas najbliższego głosowania gracze nie będą widzieć licznika głosów!`);
			}
        }
		
        // --- SPECJALNA LOGIKA: ZMOWA MILCZENIA ---
        else if (cardId === 'silent_sabotage') {
            const host = players.find(p => p.isHost);
			silentSabotageActive = true;
            io.emit('systemMessage', `${player.name} prosi o spotkanie z Gospodarzem...`); 
            if (host) {
                 io.to(host.id).emit('systemMessage', `[MAFIA] 🤫 ${player.name} używa Zmowy Milczenia! Następnego dnia wycisz wybraną przez niego osobę.`);
            }
        }

        // --- STANDARDOWA LOGIKA DLA POZOSTAŁYCH KART ---
        else if(card.type === 'public'){
            io.emit('systemMessage', `${player.name} użył kartę ${card.name}!`);
        }
        else if(card.type === 'private'){
            const host = players.find(p => p.isHost);
            io.emit('systemMessage', `${player.name} użył karty Spotkanie z Gospodarzem!`);
            if(host){
                io.to(host.id).emit('systemMessage', `[TAJNE] ${player.name} użył karty: ${card.name}`);
            }
        }
        
        // Wspólne czyszczenie karty po użyciu
        player.cards = player.cards.filter(c => c.id !== cardId);
        io.to(player.id).emit('updateCards', player.cards);
    });

	// 🏁 ZAKOŃCZENIE GRY (Obsługa Hosta)
    socket.on('endGameRequest', (winner) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        console.log(`Gra zakończona przez Hosta. Zwycięzca: ${winner}`);
        
        // Wysyłamy do WSZYSTKICH informację o końcu i pełną listę graczy (z rolami i frakcjami)
        io.emit('gameFinished', {
            winner: winner,
            finalPlayers: players.map(p => ({
                name: p.name,
                role: p.role,
                faction: p.faction || (['Mafia', 'Killer'].includes(p.role) ? 'Mafia' : 'Miasto')
            }))
        });
    });
	
    // 🔌 ROZŁĄCZENIE
    socket.on('disconnect', ()=>{
        players = players.filter(p=>p.id!==socket.id);
        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });

});
