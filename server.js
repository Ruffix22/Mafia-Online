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
let graveWhisperActive = false;
let mafiaTarget = null;
let confusionActive = false; 
let judgeActive = false;
let delayedExecutionActive = false;
let bossMamaActive = false;
let poisonBladeActive = false;
let fullMoonActive = false;
let pendingSilenceTarget = null; 
let silentSabotageActive = false;
let rigVotingActive = false;
let godfatherId = null; 
let hiddenVictimActive = false;
let fogOfWarActive = false;
let mafiaTargets = []; 
let votes = {};
let tribunalTarget = null; 
let tribunalVotes = {}; // { playerId: 'guilty' / 'innocent' }
let readyPlayers = new Set();
let cardsDatabase = [
	{id:'ally', name:'Sojusznik', description:'Gospodarz wskazuje Ci osobę, która jest Mieszkańcem. Nie możesz o tym poinformować innych graczy wprost.', type:'private', roles:['Miasto','Mafia']},
    {id:'anarchist', name:'Anarchista', description:'Wykorzystaj tę kartę by rozpocząć losowanie osoby, która ma zostać natychmiast wyeliminowana z gry. Po losowaniu następuje faza nocy.', type:'public', roles:['Miasto','Mafia']},
	{id:'archive_leak', name:'Przeciek z Archiwum', description:'Po zakończeniu następnego głosowania Gospodarz poinformuje Cię, czy wśród dwóch osób z największą liczbą głosów znajdował się przynajmniej jeden Mafiozo.', type:'private', roles:['Miasto']},
	{id:'avenger', name:'Mściciel', description:'Jeżeli zostałeś wskazany do opuszczenia gry, wskazujesz osobę, która opuści ją zamiast Ciebie.', type:'public', roles:['Miasto','Mafia']},
	{id:'blood_legacy', name:'Dziedzictwo Krwi', description:'Po zagraniu tej karty zostajesz wyeliminowany z gry, lecz w Twoje miejsce zostaje powołany dodatkowy Mafiozo.', type:'public', roles:['Mafia']},
	{id:'bodyguard', name:'Ochroniarz', description:'Wskaż dwie osoby, które nie będą mogły brać udziału w najbliższym głosowaniu. Nie mogą one zostać wyeliminowane w jego trakcie.', type:'public', roles:['Miasto','Mafia']},
	{id:'boss_mama', name:'Boss Mama', description:'Używając tej karty wyciszasz mafię następnej nocy. Nie może ona wtedy nikogo wyeliminować.', type:'public', roles:['Miasto','Mafia']},
	{id:'blackmailer', name:'Szantażysta', description:'Wskaż gracza który następnego dnia zostanie zaszantażowany przez Mafie. Będzie musiał on dążyć do wygłosowania wskazanego przez Mafię gracza.', type:'private', roles:['Mafia']},
	{id:'cancel_power', name:'Karta Anulacji Mocy', description:'Wskaż gracza, którego zagrana karta mocy straci swoje działanie.', type:'public', roles:['Miasto','Mafia']},
	{id:'chosen_of_dead', name:'Wybraniec Umarłych', description:'Użyj tej karty by przywrócić do świata żywych losowego gracza.', type:'public', roles:['Miasto','Mafia']},
	{id:'citizen_rep', name:'Przedstawiciel Obywateli', description:'Wskaż osobę, która będzie miała podwójny głos do końca rozgrywki. Nie możesz wskazać siebie.', type:'public', roles:['Miasto','Mafia']},
	{id:'common_interest', name:'Wspólny Interes', description:'Wybierz dwóch graczy, a Gospodarz powie Ci czy są w tych samych frakcjach. Nie możesz podzielić się tą informacją.', type:'private', roles:['Miasto']},
	{id:'confiscation', name:'Konfiskata', description:'Wskaż gracza, którego jedna z kart zostaje mu odebrana i wraca do talii.', type:'public', roles:['Miasto','Mafia']},
	{id:'corrupt_cop', name:'Skorumpowany Gliniarz', description:'Po użyciu tej karty wszystkie informacje zdobyte przez Miasto następnego dnia są fałszywe. ', type:'private', roles:['Mafia']},
	{id:'crown_witness', name:'Świadek Koronny', description:'Zyskujesz immunitet i nie możesz zostać wyeliminowany z gry podczas następnego głosowania.', type:'public', roles:['Miasto','Mafia']},
	{id:'dark_pact', name:'Mroczny Pakt', description:'Wybierz gracza, który otrzyma każdy nałożony na Ciebie efekt (w tym śmierć) aż do końca gry.', type:'private', roles:['Miasto','Mafia']},
	{id:'delayed_execution', name:'Oddalona Egzekucja', description:'Zagraj te kartę aby ochronić członka Mafii w najbliższym głosowaniu. Jeśli wskazany gracz jest z Mafii, nie odpada z gry.', type:'public', roles:['Miasto','Mafia']},
	{id:'delayed_poison', name:'Opóźniona Trucizna', description:'Wyeliminuj dowolną osobę, ale przejdzie ona do świata umarłych dopiero następnego dnia rano.', type:'public', roles:['Miasto','Mafia']},
	{id:'doctor', name:'Lekarz', description:'Wskaż Gospodarzowi osobę, którą ochronisz przed wyrokiem Mafii w trakcie najbliższej nocy.', type:'private', roles:['Miasto']},
	{id:'don_decision', name:'Decyzja Dona', description:'Musisz zagrać te kartę od razu. Następuje rzut monetą, który decyzuje o tym czy odpadniesz z gry czy przeżyjesz.', type:'public', roles:['Miasto','Mafia']},
	{id:'duplication', name:'Cynk od Informatora', description:'Otrzymujesz ostatnio użytą w grze kartę Mocy.', type:'public', roles:['Miasto','Mafia']},
    {id:'fair_judge', name:'Sprawiedliwy Sędzia', description:'W trakcie najbliższego głosowania wyeliminowany może być tylko Mafiozo. Jeśli w głosowaniu zostanie wybrany Obywatel, nie zostanie usunięty z rozgrywki.', type:'public', roles:['Miasto','Mafia']},
	{id:'faked_death', name:'Upozorowana Śmierć', description:'Jeśli zginiesz podczas głosowania lub nocy, przechodzisz na 1 dzień do Świata Umarłych. Po następnej fazie nocy wracasz do Świata Żywych.', type:'private', roles:['Miasto','Mafia']},
	{id:'false_evidence', name:'Fałszywy Trop', description:'Wskaż gracza, który po sprawdzeniu jego przynależności przez inncyh gracze ukaże się jako Mafia.', type:'private', roles:['Mafia']},
	{id:'final_judgment', name:'Sąd Ostateczny', description:'Wykorzystaj tę kartę, aby po zakończeniu głosowania natychmiast zarządzić drugie, dodatkowe głosowanie.', type:'public', roles:['Miasto', 'Mafia']},
	{id:'fog_of_war', name:'Mgła Wojny', description:'Podczas najbliższego głosowania licznik głosów będzie widoczny tylko dla Gospodarza.', type:'private', roles:['Mafia']},
	{id:'forced_sacrifice', name:'Wymuszona Ofiara', description:'Wskaż osobę, która jest eliminowana z rozgrywki, ale może ona na swoje miejsce przywrócić innego, martwego gracza.', type:'public', roles:['Miasto','Mafia']},
	{id:'full_moon', name:'Pełnia Księżyca', description:'Następnej nocy prócz celu wskazanego przez Mafię zginie jeden, losowy Obywatel. W zamian gospodarz ujawnia mieszkańcom tożsamość jednego z mafiozów.', type:'private', roles:['Miasto','Mafia']},
	{id:'gambler', name:'Hazardzista', description:'Wytypuj gracza, który według Ciebie zostanie w tej rundzie wyeliminowany przez Miasto. Jeśli trafisz otrzymujesz 2 Karty Mocy, jeśli nie- tracisz wszystkie posiadane karty i możliwość ich zdobycia następnego dnia.', type:'private', roles:['Miasto','Mafia']},
	{id:'godfather', name:'Ojciec Chrzestny', description:'Użyj tej karty aby Twój głos był kluczowy podczas eliminacji gracza w nocy.', type:'private', roles:['Mafia']},
	{id:'grave_whisper', name:'Grobowy Szept', description:'Użyj tej karty, aby w nadchodzącym głosowaniu osoby wyeliminowane mogą wskazać winnego razem z żyjącymi uczestnikami.', type:'public', roles:['Miasto','Mafia']},
	{id:'hidden_victim', name:'Ukryta Ofiara', description:'Użyj tej karty, aby wyeliminowana przez mafie osoba zginęła dopiero po rozpoczęciu następnej fazy głosowania.', type:'private', roles:['Mafia']},
	{id:'in_broad_daylight', name:'W Biały Dzień', description:'Możesz wyeliminować dowolną osobę, ale natychmiast zostajesz schwytany i opuszczasz rozgrywkę.', type:'public', roles:['Mafia']},
	{id:'investigative_report', name:'Raport Śledczy', description:'Użyj tej karty, aby odkryć pozostałą w grze ilość Mafiozów. Nie możesz podzielić się tą informacją z innymi.', type:'private', roles:['Miasto']},
	{id:'iron_alibi', name:'Żelazne Alibi', description:'Użyj tej karty, aby nie być celem żadnej Karty Mocy w tej rundzie (zarówno negatywnej jak i pozytywnej).', type:'private', roles:['Miasto','Mafia']},
	{id:'jury', name:'Ława Przysięgłych', description:'Po następnym głosowaniu otrzymasz informację kto na kogo zagłosował.', type:'private', roles:['Miasto','Mafia']},
	{id:'kamikaze', name:'Kamikadze', description:'Możesz wyeliminować dowolną osobę z gry, ale ty również zostajesz wyeliminowany.', type:'public', roles:['Miasto','Mafia']},
	{id:'last_will', name:'Ostatnia Wola', description:'Wskaż Gospodarzowi gracza, który otrzyma wszystkie Twoje Karty Mocy jeśli zginiesz.', type:'private', roles:['Miasto','Mafia']},
	{id:'lazarus_protocol', name:'Protokół Łazarz', description:'Możesz wskrzesić losowego gracza, ale nie może on głosować ani otrzymywać Kart Mocy.', type:'public', roles:['Miasto','Mafia']},
	{id:'life_insurance', name:'Polisa na Życie', description:'Wskaż gracza ze Świata Umarłych. Jeśli zginiesz, on natychmiast wraca do gry na Twoje miejsce.', type:'private', roles:['Miasto','Mafia']},
	{id:'list_of_the_damned', name:'Lista Potępionych', description:'Użyj tej karty, aby Martwi wybrali spośród Żywych 2 osoby- to między nimi odbędzie się następne głosowanie.', type:'public', roles:['Miasto','Mafia']},
	{id:'logistical_support', name:'Wsparcie Logistyczne', description:'Wskaż gracza, który otrzyma następnego dnia dodatkową Kartę Mocy.', type:'private', roles:['Miasto','Mafia']},
	{id:'lovers', name:'Anioł Miłości', description:'Wybierz dwóch graczy, aby następnej nocy połączyć ich miłością, silniejszą od przynależności do roli. Jeśli jeden z zakochanych zginie, drugi odpada razem z nim', type:'private', roles:['Miasto','Mafia']},
	{id:'luck_shot', name:'Łut Szczęścia', description:'Zagraj te karte od razu po otrzymaniu. Rzut monetą decyduje czy otrzymasz 2 Karty Mocy czy stracisz 1 którą posiadasz.', type:'public', roles:['Miasto','Mafia']},
	{id:'madman', name:'Szaleniec', description:'Po użyciu tej karty jeśli zostaniesz wyeliminowany w trakcie głosowania, zamiast Ciebie odpada losowy gracz.', type:'private', roles:['Miasto','Mafia']},
	{id:'miracle_worker', name:'Cudotwórca', description:'Wskaż osobę ze Świata Umarłych, która natychmiast powróci do gry.', type:'public', roles:['Miasto','Mafia']},
	{id:'misfire', name:'Błędny Strzał', description:'Najbliższej nocy osoba wyeliminowana przez mafie jest losowa. Strzał może również trafić w członka mafii.', type:'private', roles:['Miasto','Mafia']},
	{id:'poison_blade', name:'Zatrute Ostrze', description:'Użycie tej karty sprawia, że cel Mafii nie ginie natychmiast, lecz zostaje otruty. Traci wszystkie karty i umiera następnej nocy.', type:'private', roles:['Mafia']},
	{id:'power_for_selected', name:'Moc Dla Wybranych', description:'Ty oraz dwie wybrane przez Ciebie osoby otrzymujecie kartę mocy.', type:'public', roles:['Miasto','Mafia']},
	{id:'power_theft', name:'Kradzież Mocy', description:'Wybierz Gracza, któremu chcesz ukraść jedną Kartę Mocy.', type:'public', roles:['Miasto','Mafia']},
	{id:'purification', name:'Oczyszczenie', description:'Ujawniasz wszystkim swoją rolę, ale tracisz wszystkie inne karty oraz możliwość oddania głosu.', type:'public', roles:['Miasto']},
	{id:'rebound', name:'Rykoszet', description:'Jeśli ktoś użyje na Tobie negatywnej Karty Mocy w tej rundzie, jej efekt odbije się w nadawcę.', type:'private', roles:['Miasto','Mafia']},
	{id:'recruit', name:'Rekrut', description:'Dołączasz do grona Mafii i budzisz się z nimi w najbliższej fazie nocy. Zostajesz Mafią do końca gry.', type:'private', roles:['Miasto','Mafia']},
	{id:'rigged_vote', name:'Fałszywy Wynik', description:'Użyj tej karty, aby w nastepnym głosowaniu Miasta odpadł losowy gracz.', type:'private', roles:['Mafia']},
	{id:'second_chance', name:'Druga Szansa', description:'Użyj tej karty, aby pierwsza wyeliminowana z gry osoba wróciła do Żywych.', type:'public', roles:['Miasto','Mafia']},
	{id:'secret_alliance', name:'Tajne Porozumienie', description:'Użyj tej karty, aby Gospodarz wskazał Ci innego Mieszkańca. Otrzymasz prywatną informację o jego tożsamości, a on dowie się, że Ty również jesteś po stronie Miasta.', type:'private', roles:['Miasto']},
	{id:'silence_card', name:'Wyciszenie', description:'Użycie tej karty blokuje możliwość zagrania jakiejkolwiek innej karty do końca rundy.', type:'public', roles:['Miasto','Mafia']},
	{id:'silent_sabotage', name:'Zmowa Milczenia', description:'Wskaż Gospodarzowi gracza, który ma zostać uciszony następnego dnia. Nie może on rozmawiać ani głosować', type:'private', roles:['Mafia']},
	{id:'sniper', name:'Snajper', description:'Wskaż osobę którą chcesz wyeliminować z gry. Jeżeli trafisz Obywatela- odpadasz razem z nim.', type:'public', roles:['Miasto','Mafia']},
	{id:'spiritual_seance', name:'Seans Spirytystyczny', description:'Wybierz gracza ze Świata Umarłych, który będzie mógł wypowiadać się podczas najbliższej Dyskusji.', type:'public', roles:['Miasto','Mafia']},
	{id:'spying', name:'Echo Zamachu', description:'Jako gracz otrzymasz informacje o każdej nieudanej eliminacji przez Mafie. Nie możesz podzielić się tą informacją.', type:'private', roles:['Miasto']},
	{id:'support', name:'Wsparcie', description:'Wskaż gospodarzowi osobę, z którą będziesz bezpieczny najbliższej nocy.', type:'private', roles:['Miasto','Mafia']},
	{id:'suspect_profile', name:'Profil Podejrzanego', description:'Użyj tej karty, aby wszyscy poznali tożsamość wyeliminowanej w następnym głosowaniu osoby.', type:'public', roles:['Miasto','Mafia']},
	{id:'tribunal_of_state', name:'Trybunał Stanu', description:'Wskaż osobę, która automatycznie trafia przed Sąd Żywych. Miasto decyduje większością głosów czy zostanie wyeliminowana.', type:'public', roles:['Miasto','Mafia']},
	{id:'tribune', name: 'Trybuna Umarłych', description:'Użyj tej karty aby uciszyć żyjących i przenieść dalszą dyskusję z głosowaniem na ręce umarłych. Dziś to oni zdecydują kto odpada.', type: 'public', roles:['Miasto','Mafia']},
	{id:'uncertain_info', name:'Niepewna Informacja', description:'Wskaż Gospodarzowi trzy podejrzane osoby a ten poinformuje Cię ilu Mafiozów jest wśród nich. Nie możesz się z nikim podzielić tą informacją.', type:'private', roles:['Miasto','Mafia']},
	{id:'untouchable', name:'Nietykalny', description:'Użyj tej karty by otrzymać nietykalność. Nie możesz zostać wyeliminowany następnej nocy przez Mafie.', type:'private', roles:['Miasto','Mafia']},
    {id:'veto', name:'Veto', description:'Możesz anulować głosowanie w bieżącej fazie dnia.', type:'public', roles:['Miasto','Mafia']},
    {id:'voice_of_reason', name:'Głos Rozsądku', description:'Zadaj Gospodarzowi jedno pytanie o stan gry, na które ten musi odpowiedzieć Tak lub Nie.', type:'private', roles:['Miasto','Mafia']}
];

// =========================
// 🔥 SOCKET.IO
// =========================
io.on('connection', socket => {
	
	// 🔥 RZUT MONETĄ (DECYZJA DONA)
	socket.on('tossCoin', (data) => {
		const { hostId, type } = data; // odbieramy ID hosta i typ rzutu
		const host = players.find(p => p.id === hostId && p.isHost);
		if (!host) return;

		let result, color, chatLabel;
		const isSuccess = Math.random() < 0.5;

		if (type === 'luck') {
			// --- Wariant dla Łut Szczęścia ---
			result = isSuccess ? 'SZCZĘŚCIE' : 'PECH';
			color = isSuccess ? '#2ecc71' : '#e74c3c';
			chatLabel = isSuccess ? '☘️ ŁUT SZCZĘŚCIA: Gracz otrzymuje 2 karty!' : '💀 ŁUT SZCZĘŚCIA: Gracz traci kartę!';
		} else {
			// --- Wariant domyślny (Decyzja Dona) ---
			result = isSuccess ? 'Łaska Dona' : 'Wyrok Dona';
			color = isSuccess ? '#2ecc71' : '#e74c3c';
			chatLabel = isSuccess ? '⚖️ DECYZJA DONA: Łaska! Gracz zostaje w grze.' : '⚖️ DECYZJA DONA: Wyrok! Gracz odpada.';
		}

		io.emit('coinResult', { result, color, chatLabel, type });
	});
	
	socket.on('mafiaVote', (targetId) => {
		const sender = players.find(p => p.id === socket.id);
		const target = players.find(p => p.id === targetId);
		
        if (!target) return;
		
		if (target.isHost) {
			socket.emit('systemMessage', '❌ Nie możesz wyeliminować Gospodarza!');
			return;
		}
	
		if (typeof godfatherId !== 'undefined' && godfatherId !== null) {
			if (godfatherId !== socket.id) {
				socket.emit('systemMessage', '🕴️ Tylko Ojciec Chrzestny decyduje o eliminacji.');
				return;
			}
		}
		
		// Tylko żywa mafia może wybierać cel i tylko w nocy
		if (sender && sender.role === 'Mafia' && sender.alive && currentPhase === 'Noc') {
			mafiaTarget = targetId;
			
			const targetName = target.name || "Nieznajomy";
        
			// Informujemy całą mafię o wyborze (żeby widzieli kogo wybrali koledzy)
			players.forEach(p => {
				if (p.role === 'Mafia' && p.alive) {
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
			doubleVote: false,
			blackmailedBy: null
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


    // 🕹 START GRY Z WYBOREM LICZBY MAFII
    socket.on('startGame', (data) => {
        // Obsługa obu formatów: starego (ID jako string) i nowego (obiekt z manualMafiaCount)
        const hostId = typeof data === 'string' ? data : data.hostId;
        const manualCount = data.manualMafiaCount || 1;

        console.log("Otrzymano próbę startu od:", hostId, "Wybrana liczba Mafii:", manualCount);

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
        allPlayers.forEach(p => {
            if (p.isHost) {
                p.role = 'Gospodarz';
                p.faction = 'Neutralny';
            } else {
                p.role = 'Miasto';
                p.faction = 'Miasto';
            }
        });

        // 2. Dynamiczne losowanie wybranej liczby Mafii
        // Zabezpieczenie: Mafia nie może stanowić wszystkich graczy (zawsze min. 1 mieszkaniec Miasta)
        const maxPossibleMafia = Math.max(1, participants.length - 1);
        const finalMafiaCount = Math.min(manualCount, maxPossibleMafia);
        
        const shuffled = [...participants].sort(() => 0.5 - Math.random());

        for (let i = 0; i < finalMafiaCount; i++) {
            shuffled[i].role = 'Mafia';
            shuffled[i].faction = 'Mafia';
        }

        // 3. Synchronizacja
        io.emit('updatePlayers', Object.values(players));
        
        // Wysyłamy rolę do każdego gracza indywidualnie
        Object.values(players).forEach(p => {
            io.to(p.id).emit('yourRole', { role: p.role, faction: p.faction });
            io.to(p.id).emit('systemMessage', `🕵️ Twoja rola w tej rozgrywce to: ${p.role.toUpperCase()}`);
        });

        currentPhase = 'Dzień';
        io.emit('phaseChanged', currentPhase);
        io.emit('systemMessage', `Gra rozpoczęta! Nastał DZIEŃ (Liczba Mafii: ${finalMafiaCount}).`);
        console.log(`Gra pomyślnie wystartowała z ${finalMafiaCount} mafiosami.`);
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
						
						if (hiddenVictimActive) {
							io.emit('systemMessage', '🛡️ Ktoś uniknął śmierci tej nocy!'); // Zmyłka dla graczy
							socket.emit('systemMessage', `⚠️ [TAJNE] Ukryta Ofiara to: ${victim.name}. Pamiętaj o ręcznej eliminacji po głosowaniu.`);
        
							hiddenVictimActive = false;
							io.emit('updateHiddenVictimState', false);
							
							mafiaTarget = null;
						}
						
						else if (poisonBladeActive) {
							victim.cards = []; // Traci karty zgodnie z opisem
							io.to(victim.id).emit('updateCards', []);
							io.emit('systemMessage', `🤢 TRUCIZNA! Gracz ${victim.name} został raniony zatrutym ostrzem. Jego karty tracą moc, a on sam może nie dożyć jutra...`);
        
							poisonBladeActive = false; // Resetujemy efekt po użyciu
							io.emit('updatePoisonBladeState', false); // Wyłączamy świecenie u Hosta
						}
						else {
							victim.alive = false;
							victim.cards = [];
							io.emit('systemMessage', `🚨 Noc była niespokojna... Nie żyje: ${victim.name}`);
							io.to(victim.id).emit('updateCards', []);
						}
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
            }
            
            // Czyszczenie osłon na koniec nocy
            players.forEach(p => p.protected = false);
			godfatherId = null; // Rola wygasa po nocy
			mafiaTarget = null;
			poisonBladeActive = false;
			hiddenVictimActive = false;
			io.emit('updatePoisonBladeState', false);
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
		
		if (rigVotingActive) {
			const livingPlayers = players.filter(p => p.alive && !p.isHost);
			if (livingPlayers.length > 0) {
				const randomVictim = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
				eliminated = randomVictim.id;
				io.emit('systemMessage', '⚠️ DOSZŁO DO MANIPULACJI WYNIKAMI! Oficjalny protokół został podmieniony...');
			}
			rigVotingActive = false; // Resetujemy po użyciu
			io.emit('updateRigVotingState', false);
		} else {

			for (let targetId in voteCounts) {
				if (voteCounts[targetId] > maxPoints) {
					maxPoints = voteCounts[targetId];
					eliminated = targetId;
					tie = false;
				} else if (voteCounts[targetId] === maxPoints && maxPoints > 0) {
					tie = true; 
				}
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
		
		// --- LOGIKA KARTY: ŁAWA PRZYSIĘGŁYCH ---
		let voteReport = "📜 [ŁAWA PRZYSIĘGŁYCH] Raport z głosowania:\n";
		for (let vId in votes) {
			const voter = players.find(p => p.id === vId);
			const target = players.find(p => p.id === votes[vId]);
			if (voter && target) {
				voteReport += `• ${voter.name} zagłosował na: ${target.name}\n`;
			}
		}

		// Wysyłamy raport TYLKO do Hosta, aby mógł go potem przekazać szeptem
		if (host) {
			io.to(host.id).emit('chatMessage', { 
				msg: voteReport, 
				from: 'SYSTEM', 
				type: 'private' 
			});
			io.to(host.id).emit('systemMessage', '📋 Otrzymałeś raport Ławy Przysięgłych. Przekaż go posiadaczowi karty.');
		}

        // 4. Czyścimy głosy i odświeżamy widok
        votes = {};
		players.forEach(p => p.blackmailedBy = null);
		fogOfWarActive = false;
		graveWhisperActive = false;
		io.emit('updateGraveWhisperState', false);
        io.emit('updateVotes', votes); 
        io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
    });
	
    // 🗳️ ODDANIE GŁOSU
    socket.on('vote', ({voterId, targetId}) => {
        const voter = players.find(p => p.id === voterId);
        if (!voter || !votingActive || votes[voterId]) return;
		
		// --- LOGIKA SZANTAŻU ---
		if (voter.blackmailedBy) {
			if (voter.blackmailedBy !== targetId) {
				io.to(voterId).emit('systemMessage', '❌ TWOJA DŁOŃ DRŻY... Szantażysta nie pozwala Ci zagłosować na tę osobę. Musisz wybrać wskazany cel!');
				io.to(voterId).emit('updateVotes', votes);
				return;
			}
		}
        
        // 🔥 NOWE: BLOKADA DLA WYCISZONYCH (OCHRONIARZ)
        if (voter.isMuted) {
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
				if (!graveWhisperActive) {
					io.to(voterId).emit('systemMessage', 'Jako martwy nie możesz teraz głosować!');
					return;
				}
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
	
	socket.on('toggleGraveWhisper', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;
		graveWhisperActive = !graveWhisperActive;
		io.emit('updateGraveWhisperState', graveWhisperActive);
		io.emit('systemMessage', graveWhisperActive ? '🕯️ Grobowy Szept: Umarli będą mogli oddać głos w tym głosowaniu!' : '🕯️ Grobowy Szept wygasł.');
	});
	
	// --- 🎩️ USTAWIANIE OJCA CHRZESTNEGO ---
    socket.on('setGodfather', (targetId) => {
        // Sprawdzamy, czy to Host wysyła żądanie
        const sender = players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) return;

        // Przypisujemy rolę
        godfatherId = targetId; 
    
        // Ustawiamy flagę na obiektach graczy (żeby frontend widział to w playersCache)
        players.forEach(p => {
            p.isGodfather = (p.id === targetId);
        });

        const target = players.find(p => p.id === targetId);

        // Powiadomienie tylko dla Mafii i Hosta
        players.forEach(p => {
             if (['Mafia', 'Killer', 'Boss'].includes(p.role) || p.isHost) {
                io.to(p.id).emit('chatMessage', { 
                    msg: `🎩️ Ojciec Chrzestny: ${target ? target.name : 'Nikt'}. Tylko on może dziś eliminować!`, 
                    from: 'SYSTEM', 
                    type: 'mafia' 
                });
            }
        });

        // Rozsyłamy zaktualizowaną listę graczy z nową flagą isGodfather
        io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
    });
	
// --- OBSŁUGA MECHANIKI: DAR LOSU (ZSYNCHRONIZOWANA) ---

	// 1. Wysyłanie propozycji (Draftu) - bez zmian, jest OK
	socket.on('sendDraft', (data) => {
		const { targetId, hostId } = data;
	
		const allCardIds = cardsDatabase.map(c => c.id);
		const shuffled = [...allCardIds].sort(() => 0.5 - Math.random());
		const draftOptions = [shuffled[0], shuffled[1]];

		io.to(targetId).emit('receiveDraft', { options: draftOptions });
		socket.emit('systemMessage', "Dar Losu został wysłany.");
	});

	// 2. Obsługa wyboru karty przez gracza - TUTAJ BYŁ BŁĄD NAZW
	socket.on('acceptDraftCard', (cardId) => {
		const cardData = cardsDatabase.find(c => c.id === cardId);

		if (cardData) {
			const player = players.find(p => p.id === socket.id);

			if (player) {
				// ZMIANA: Używamy .cards zamiast .inventory, aby było spójne z giveCard
				if (!player.cards || !Array.isArray(player.cards)) {
					player.cards = [];
				}

				// Dodajemy kartę do tej samej tablicy co Host
				player.cards.push(cardData);

				console.log(`[Draft] Gracz ${player.name} otrzymał: ${cardData.name}`);

				// KLUCZOWE: Wysyłamy właściwą tablicę (.cards)
				socket.emit('updateCards', player.cards);

				// Informacja dla Hosta
				const host = players.find(p => p.isHost);
				if (host) {
					io.to(host.id).emit('chatMessage', {
						msg: `Gracz ${player.name} wybrał kartę: ${cardData.name}`,
						from: 'System',
						type: 'system'
					});
				}
			}
		}
	});

	socket.on('toggleProtect', (targetId) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        const target = players.find(p => p.id === targetId);
        if (target) {
            target.protected = !target.protected;
            // Kluczowe: informujemy wszystkich o zmianie, żeby ikona się zaświeciła
            io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
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
	
	socket.on('togglePoisonBlade', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;

		poisonBladeActive = !poisonBladeActive;
		socket.emit('systemMessage', poisonBladeActive 
			? '🧪 Zatrute Ostrze aktywne! Następny cel Mafii zostanie zatruty zamiast zginąć od razu.' 
			: '🧪 Zatrute Ostrze wyłączone.');
    
		io.emit('updatePoisonBladeState', poisonBladeActive);
	});
	
	socket.on('toggleHiddenVictim', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;

		hiddenVictimActive = !hiddenVictimActive;
		io.emit('updateHiddenVictimState', hiddenVictimActive);
		socket.emit('systemMessage', hiddenVictimActive ? '🕵️ Ukryta Ofiara aktywna!' : '🕵️ Ukryta Ofiara wyłączona.');
	});
	
	socket.on('linkLovers', ({ player1Id, player2Id, hostId }) => {
        // Szukamy graczy po ID w tablicy
        const p1 = players.find(p => p.id === player1Id);
        const p2 = players.find(p => p.id === player2Id);
        
        if (p1 && p2) {
            p1.isInLove = true;
            p1.loverId = player2Id;
            p2.isInLove = true;
            p2.loverId = player1Id;
			
			io.to(p1.id).emit('notificationLove');
            io.to(p2.id).emit('notificationLove');
            
            io.to(player1Id).emit('youAreInLove', { loverName: p2.name, loverRole: p2.role });
            io.to(player2Id).emit('youAreInLove', { loverName: p1.name, loverRole: p1.role });
            
            // Wysyłamy wiadomość do wszystkich
            io.emit('chatMessage', {
                text: `💖 Anioł Miłości połączył dwa serca: ${p1.name} i ${p2.name}! Ich los jest teraz wspólny.`, 
                color: "#ff69b4"
            });

            // Odświeżamy listę u wszystkich (żeby host zobaczył różowe ikony)
            io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
        }
    });
	
	socket.on('toggleRigVoting', () => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;
		rigVotingActive = !rigVotingActive;
		io.emit('updateRigVotingState', rigVotingActive);
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
	
	socket.on('toggleGhostTalk', (targetId) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;
		
		const target = players.find(p => p.id === targetId);
        if (target) {
            target.canGhostTalk = !target.canGhostTalk;
			
			if (target.canGhostTalk) {
				io.to(target.id).emit('systemMessage', '✨ Medium nawiązało z Tobą kontakt! Możesz teraz pisać na czacie Miasta.');
			} else {
				io.to(target.id).emit('systemMessage', '✨ Kontakt z medium został przerwany. Znów jesteś tylko obserwatorem.');
			}
			
            io.emit('updatePlayers', players.map(p => ({
                ...p,
                canGhostTalk: p.canGhostTalk
            })));
        }
    });
	
	socket.on('setGodfather', (targetId) => {
        const sender = players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) return;

        godfatherId = targetId; // Ustawiamy kto rządzi
        const target = players.find(p => p.id === targetId);
    
        // Powiadomienie na czat Mafii (tylko oni wiedzą, kto rządzi)
        players.forEach(p => {
            if (['Mafia', 'Killer', 'Boss'].includes(p.role) || p.isHost) {
                io.to(p.id).emit('chatMessage', { 
                    msg: `🕴️ Ojciec Chrzestny został wybrany: ${target ? target.name : 'Nikt'}. Tylko on może dziś eliminować!`, 
                    from: 'SYSTEM', 
                    type: 'mafia' 
                });
            }
        });

        io.emit('updatePlayers', players.map(p => ({ ...p, isGodfather: p.id === godfatherId })));
    });

    // 😇 WSKRZESZENIE
    socket.on('revive', (targetId, hostId)=>{
        const host = players.find(p=>p.id===hostId && p.isHost);
        if(!host) return;
        const player = players.find(p=>p.id===targetId);
        if(player) player.alive=true;
        io.emit('updatePlayers', players.filter(p=>p && p.id && p.name));
    });
	
	socket.on('hostRevealRole', (targetId) => {
        const host = players.find(p => p.id === socket.id && p.isHost);
        if (!host) return;

        const target = players.find(p => p.id === targetId);
        if (target) {
            if (target.role === 'Mafia') {
                target.exposed = true;
            } else if (target.role === 'Miasto') {
                target.isPurified = true;
            }

            io.emit('systemMessage', `💡 Rola gracza ${target.name} została ujawniona!`);
        
            io.emit('updatePlayers', players);
        }
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
	
	socket.on('setBlackmail', ({ victimId, targetId }) => {
		const host = players.find(p => p.id === socket.id && p.isHost);
		if (!host) return;

		const victim = players.find(p => p.id === victimId);
		const target = players.find(p => p.id === targetId);

		if (victim && target) {
			victim.blackmailedBy = targetId;
        
			// Wysyłamy wielkie powiadomienie
			io.to(victimId).emit('notificationBlackmail', { 
				targetName: target.name 
			});

			socket.emit('systemMessage', `✅ Szantaż ustawiony: ${victim.name} vs ${target.name}.`);
		}
	});
	
    // 💬 WIADOMOŚCI
    socket.on('sendMessage', ({msg, from, type, to})=>{
        const sender = players.find(p=>p.id===socket.id);
		if(!sender) return;
		
		if (sender.isMuted) {
            socket.emit('systemMessage', 'Jesteś wyciszony i nie możesz krzyczeć!');
            return;
        }
		
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
			if (!deadTalkActive && !sender.alive && !sender.canGhostTalk) {
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
		
		if (currentPhase === 'Noc' && player.role === 'Miasto') {
			socket.emit('systemMessage', `🚫 Nie możesz używać kart mocy w nocy!`);
			return;
		}
        
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
            socket.emit('systemMessage', `📩 Użyłeś karty prywatnej: ${card.name}. Gospodarz otrzymał powiadomienie.`);
            if(host){
                io.to(host.id).emit('systemMessage', `[TAJNE] ${player.name} użył karty: ${card.name}`);
            }
        }
        
        // Wspólne czyszczenie karty po użyciu
        player.cards = player.cards.filter(c => c.id !== cardId);
        io.to(player.id).emit('updateCards', player.cards);
    });
	
	// --- 🗑️ USUWANIE KARTY PRZEZ HOSTA ---
    socket.on('removePlayerCard', ({ targetId, cardIndex }) => {
        const sender = players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) return;

        const target = players.find(p => p.id === targetId);
        if (target && target.cards) {
            // Usuwamy kartę o konkretnym indeksie
            target.cards.splice(cardIndex, 1);
        
            // Informujemy gracza o zmianie w jego kartach
            io.to(target.id).emit('updateCards', target.cards);
        
            // Odświeżamy widok u wszystkich (żeby Host widział zmiany w podglądzie)
            io.emit('updatePlayers', players.filter(p => p && p.id && p.name));
        }
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
