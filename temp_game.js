
		// Minimal Spades implementation (single-file) â€” user is South.
		const suits = ['â™ ','â™¥','â™¦','â™£'];
		const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

		function makeDeck(){
			const deck = [];
			for(const s of suits){
				for(const r of ranks){
					deck.push({suit:s, rank:r, value:ranks.indexOf(r)+2});
				}
			}
			return deck;
		}

		// Shuffle
		function shuffle(a){
			for(let i=a.length-1;i>0;i--){
				const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
			}
			return a;
		}

		// Players: 0: South(user), 1: West(CPU), 2: North(CPU), 3: East(CPU). Play clockwise.
		let hands=[], bids=[0,0,0,0], tricksWon=[0,0,0,0], scores=[0,0,0,0];
		let turn=0; // current player index
		let leadSuit=null; let trickCards=[]; let spadesBroken=false; let playerSubmittedBid=false; let round=0;

		const el = id=>document.getElementById(id);
		const southHandEl = el('south-hand');
		const bidSelect = el('bidSelect');
		const submitBidBtn = el('submitBid');
		const startRoundBtn = el('startRound');
		const statusEl = el('status');
		const logEl = el('log');
		const scoresEl = el('scores');

		function log(msg){ const p=document.createElement('div'); p.textContent=msg; logEl.prepend(p); }

		function renderScores(){ scoresEl.innerHTML=''; ['South','West','North','East'].forEach((name,i)=>{
			const d=document.createElement('div'); d.className='score'; d.innerHTML=`<strong>${name}</strong><div>${scores[i]} pts</div><div class="small">Bid ${bids[i]} â€¢ Won ${tricksWon[i]}</div>`; scoresEl.appendChild(d);
		})}

		function cardHTML(card){
			const div=document.createElement('div'); div.className='card';
			if(card.suit==='â™ ') div.classList.add('spade');
			if(card.suit==='â™¥' || card.suit==='â™¦') div.classList.add('suit-red');
			div.dataset.suit=card.suit; div.dataset.rank=card.rank; div.dataset.value=card.value;
			div.innerHTML=`<div class="top">${card.rank}${card.suit}</div><div style="text-align:center;font-size:20px">${card.suit}</div><div class="bot">${card.rank}${card.suit}</div>`;
			return div;
		}

		function deal(){
			const deck=shuffle(makeDeck());
			hands=[[],[],[],[]];
			for(let i=0;i<52;i++){ hands[i%4].push(deck[i]); }
			// sort hands for nicer display (suit then value)
			for(const h of hands){ h.sort((a,b)=>{ if(a.suit===b.suit) return a.value-b.value; return suits.indexOf(a.suit)-suits.indexOf(b.suit); }); }
		}

		function resetRound(){ bids=[0,0,0,0]; tricksWon=[0,0,0,0]; trickCards=[]; spadesBroken=false; leadSuit=null; playerSubmittedBid=false; round++; logEl.innerHTML=''; }

		function startNewRound(){
			resetRound(); deal(); renderAllHands(); populateBidSelect(); renderScores(); statusEl.textContent='Bidding: submit your bid.';
			// let CPUs bid after user submits; but also compute their bids now and show as '?' until reveal
			for(let p=1;p<4;p++) bids[p]=cpuBidEstimate(hands[p]);
			// user must submit bid; set turn to South
			turn=0; updateTableSlots();
		}

		function populateBidSelect(){ bidSelect.innerHTML=''; for(let i=0;i<=13;i++){ const opt=document.createElement('option'); opt.value=i; opt.text=i; bidSelect.appendChild(opt);} }

		// Very simple CPU bidding heuristic
		function cpuBidEstimate(hand){
			let score=0; let spades=hand.filter(c=>c.suit==='â™ '); let highCards=hand.filter(c=>['A','K','Q','J'].includes(c.rank));
			score += highCards.length * 0.9;
			score += spades.length * 0.8;
			// extra value for A/K of spades
			for(const c of hand){ if(c.suit==='â™ ' && c.rank==='A') score+=1.2; if(c.suit==='â™ ' && c.rank==='K') score+=0.8; }
			// long suits add small bonus
			const suitCounts = {};
			for(const s of suits) suitCounts[s]=hand.filter(c=>c.suit===s).length;
			for(const s in suitCounts){ if(suitCounts[s]>=6) score += (suitCounts[s]-5)*0.4; }
			const bid=Math.max(0, Math.round(score));
			// avoid bidding 0 if really strong
			return bid;
		}

		submitBidBtn.addEventListener('click', ()=>{
			if(playerSubmittedBid) return; bids[0]=parseInt(bidSelect.value,10); playerSubmittedBid=true; log(`You bid ${bids[0]}`);
			// reveal CPU bids
			for(let p=1;p<4;p++){ log(`${['West','North','East'][p-1]} bids ${bids[p]}`); }
			renderScores(); statusEl.textContent='Play: South leads.'; // south leads
			// south leads (turn is 0)
			renderAllHands(); updateTableSlots();
		});

		startRoundBtn.addEventListener('click', ()=>{ startNewRound(); });

		function renderAllHands(){
			// render south hand
			southHandEl.innerHTML='';
			hands[0].forEach((c,idx)=>{
				const ch=cardHTML(c);
				ch.dataset.idx=idx;
				ch.addEventListener('click', ()=>onUserPlay(idx));
				southHandEl.appendChild(ch);
			});
			// show counts for CPUs
			el('north-info').textContent = `${hands[2].length} cards â€¢ Bid ${bids[2]}`;
			el('east-info').textContent = `${hands[3].length} cards â€¢ Bid ${bids[3]}`;
			el('west-info').textContent = `${hands[1].length} cards â€¢ Bid ${bids[1]}`;
			renderScores(); updateTableSlots();
		}

		function updateTableSlots(){ // show trick cards
			['slot-west','slot-north','slot-east','slot-south'].forEach(id=>el(id).innerHTML='');
			for(const tc of trickCards){ const target = tc.player===1?'slot-west':tc.player===2?'slot-north':tc.player===3?'slot-east':'slot-south'; el(target).appendChild(cardHTML(tc.card)); }
		}

		function onUserPlay(idx){
			if(turn!==0 || !playerSubmittedBid){ statusEl.textContent='It is not your turn or you must bid first.'; return; }
			const card = hands[0][idx];
			if(!isLegalPlay(0, card)){ statusEl.textContent='Follow suit if possible.'; return; }
			playCard(0, card); hands[0].splice(idx,1);
			renderAllHands(); advanceTurn();
		}

		function isLegalPlay(player, card){
			// If leadSuit is null it's the lead; can't lead spade until broken unless only spades
			if(!leadSuit){ if(card.suit==='â™ ' && !spadesBroken){ const nonSpades=hands[player].some(c=>c.suit!=='â™ '); if(nonSpades) return false; } return true; }
			// must follow suit if possible
			const hasSuit = hands[player].some(c=>c.suit===leadSuit);
			if(hasSuit) return card.suit===leadSuit;
			return true;
		}

		function playCard(player, card){
			if(!leadSuit) leadSuit=card.suit;
			if(card.suit==='â™ ') spadesBroken=true;
			trickCards.push({player, card});
			log(`${playerName(player)} plays ${card.rank}${card.suit}`);
			updateTableSlots();
		}

		function playerName(i){ return ['South','West','North','East'][i]; }

		function advanceTurn(){
			// find next player with cards
			// if trick still incomplete, go to next player and auto-play if CPU
			if(trickCards.length<4){
				turn=(turn+1)%4;
				// skip players with 0 cards
				while(hands[turn].length===0 && turn!==0) { turn=(turn+1)%4; }
				if(turn!==0){ setTimeout(()=>cpuPlay(turn), 500); }
				return;
			}
			// evaluate trick
			const winner = evaluateTrick();
			tricksWon[winner]++;
			log(`${playerName(winner)} wins the trick.`);
			// clear trick
			trickCards.length=0; leadSuit=null; turn=winner;
			// if round over?
			if(hands[0].length===0){ // all cards played
				endRound(); return;
			}
			updateTableSlots(); renderScores(); // continue
			// if winner is CPU, play next automatically
			if(turn!==0){ setTimeout(()=>cpuPlay(turn), 400); }
		}

		function evaluateTrick(){
			// winner is highest spade if any spade played; otherwise highest of lead suit
			const spadePlays = trickCards.filter(t=>t.card.suit==='â™ ');
			if(spadePlays.length>0){ let best=spadePlays[0]; for(const t of spadePlays){ if(t.card.value>best.card.value) best=t; } return best.player; }
			const lead = trickCards[0].card.suit; let best=trickCards[0];
			for(const t of trickCards){ if(t.card.suit===lead && t.card.value>best.card.value) best=t; }
			return best.player;
		}

		// basic CPU play: try to follow suit with lowest winning card or lowest card
		function cpuPlay(player){
			if(hands[player].length===0) return;
			// determine playable cards
			const playable = hands[player].filter(c=>isLegalPlay(player,c));
			let chosen;
			if(!leadSuit){ // lead: prefer non-spade lead unless only spades
				const nonSpades = playable.filter(c=>c.suit!=='â™ ');
				if(nonSpades.length) chosen = chooseLeadCard(nonSpades, player);
				else chosen = chooseLeadCard(playable, player);
			} else {
				// we are following; if can beat current best, try to; otherwise throw lowest
				const bestSoFar = currentBestInTrick();
				// try to beat
				const sameSuit = playable.filter(c=>c.suit===leadSuit);
				if(sameSuit.length){
					const beating = sameSuit.filter(c=>c.value>bestSoFar.card.value && bestSoFar.card.suit===leadSuit);
					if(beating.length) chosen = beating.reduce((a,b)=>a.value<b.value?a:b); else chosen = sameSuit.reduce((a,b)=>a.value<b.value?a:b);
				} else {
					// no lead suit: could use spade to trump
					const spadesHere = playable.filter(c=>c.suit==='â™ ');
					if(spadesHere.length){ // use smallest spade that beats spades if any else smallest
						if(bestSoFar.card.suit==='â™ '){ const beatingSpades = spadesHere.filter(c=>c.value>bestSoFar.card.value); if(beatingSpades.length) chosen = beatingSpades.reduce((a,b)=>a.value<b.value?a:b); else chosen = spadesHere.reduce((a,b)=>a.value<b.value?a:b); }
						else chosen = spadesHere.reduce((a,b)=>a.value<b.value?a:b);
						spadesBroken=true;
					} else {
						chosen = playable.reduce((a,b)=>a.value<b.value?a:b);
					}
				}
			}
			// play chosen
			const idx = hands[player].indexOf(chosen);
			playCard(player, chosen);
			hands[player].splice(idx,1);
			renderAllHands();
			advanceTurn();
		}

		function currentBestInTrick(){
			if(trickCards.length===0) return null;
			let best = trickCards[0];
			for(const t of trickCards){
				if(t.card.suit==='â™ '){
					if(best.card.suit!=='â™ ' || t.card.value>best.card.value) best=t;
				} else if(best.card.suit===t.card.suit && t.card.value>best.card.value && best.card.suit!=='â™ '){
					best=t;
				}
			}
			return best;
		}

		function chooseLeadCard(candidates, player){
			// prefer to lead highest of longest suit to try to take tricks, but simple: play highest non-spade if bidding > 0, else low
			const longSuitCount = {};
			for(const s of suits) longSuitCount[s]=hands[player].filter(c=>c.suit===s).length;
			candidates.sort((a,b)=>a.value-b.value);
			// if CPU bid is 0, throw low
			if(bids[player]===0) return candidates[0];
			// else lead highest of longest suit
			const suitOrder = Object.entries(longSuitCount).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
			for(const s of suitOrder){ const cs = candidates.filter(c=>c.suit===s); if(cs.length) return cs[cs.length-1]; }
			return candidates[candidates.length-1];
		}

		function endRound(){
			// scoring
			for(let i=0;i<4;i++){
				if(bids[i]===0){ // nil
					if(tricksWon[i]===0) scores[i]+=100; else scores[i]-=100;
				} else if(tricksWon[i] >= bids[i]){
					scores[i] += 10*bids[i] + (tricksWon[i]-bids[i]);
				} else {
					scores[i] -= 10*bids[i];
				}
			}
			renderScores(); log('Round complete. Click New Round to play again.'); statusEl.textContent='Round finished.';
		}

		// initialize
		(function init(){
			for(let i=0;i<=13;i++){ const opt=document.createElement('option'); opt.value=i; opt.text=i; bidSelect.appendChild(opt); }
			startNewRound();
		})();

	
