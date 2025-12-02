// Full pack script: audio, dialogue trees, quests, more enemies
const TILE=32;
const ROWS=16, COLS=16;
const canvas=document.getElementById('map');
const ctx=canvas.getContext('2d');
canvas.focus();

let assets={};
const loadImage = src => new Promise(res=>{const i=new Image(); i.onload=()=>res(i); i.src=src});

async function loadAssets(){
  assets.player = await loadImage('assets/player.png');
  assets.goblin = await loadImage('assets/goblin.png');
  assets.skeleton = await loadImage('assets/skeleton.png');
  assets.npc    = await loadImage('assets/npc.png');
  assets.grass  = await loadImage('assets/grass.png');
  assets.wall   = await loadImage('assets/wall.png');
  assets.water  = await loadImage('assets/water.png');
}

let dialogues = {};
let quests = {};
async function loadJson(){
  dialogues = await (await fetch('assets/dialogues.json')).json();
  quests = await (await fetch('assets/quests.json')).json();
}

let audio = {
  bgm: document.getElementById('bgm'),
  attack: document.getElementById('sfxAttack'),
  heal: document.getElementById('sfxHeal'),
  win: document.getElementById('sfxWin')
};

let game = {
  player:{x:1,y:1,hp:100, gold:0, level:1, inventory:[]},
  enemies: [{id:'g1', type:'goblin', x:6,y:6,hp:30},{id:'s1',type:'skeleton',x:10,y:4,hp:40}],
  npcs: [{id:'npc_1', x:3,y:3, dialog:'npc_1'},{id:'npc_2', x:8,y:2, dialog:'npc_2'}],
  map:[],
  inBattle:false,
  currentEnemy:null,
  activeQuests: {}
};

function genMap(){
  for(let r=0;r<ROWS;r++){
    game.map[r]=[];
    for(let c=0;c<COLS;c++){
      if(r===0 || c===0 || r===ROWS-1 || c===COLS-1) game.map[r][c]='wall';
      else if((r===5 && c>2 && c<10) || (c===9 && r>8 && r<14)) game.map[r][c]='wall';
      else if(r==12 && c>4 && c<12) game.map[r][c]='water';
      else game.map[r][c]='grass';
    }
  }
}

function draw(){
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const tile=game.map[r][c] || 'grass';
      const img=assets[tile];
      ctx.drawImage(img, c*TILE, r*TILE, TILE, TILE);
    }
  }
  // NPCs & enemies
  game.npcs.forEach(n=> ctx.drawImage(assets.npc, n.x*TILE, n.y*TILE, TILE, TILE));
  game.enemies.forEach(e=>{
    const img = e.type==='goblin' ? assets.goblin : assets.skeleton;
    ctx.drawImage(img, e.x*TILE, e.y*TILE, TILE, TILE);
  });
  // player
  ctx.drawImage(assets.player, game.player.x*TILE, game.player.y*TILE, TILE, TILE);
  updateHud();
}

function updateHud(){
  document.getElementById('playerHp').innerText = game.player.hp;
  document.getElementById('gold').innerText = game.player.gold;
  document.getElementById('level').innerText = game.player.level;
  const inv = document.getElementById('inventory');
  inv.innerHTML='';
  game.player.inventory.forEach(it=>{ const li=document.createElement('li'); li.innerText=it; inv.appendChild(li)});
  const ql=document.getElementById('questsList');
  ql.innerHTML='';
  Object.values(game.activeQuests).forEach(q=>{
    const li=document.createElement('li'); li.innerText = q.title + (q.completed ? ' (Done)' : '');
    ql.appendChild(li);
  });
}

function isBlocked(x,y){
  if(x<0||y<0||x>=COLS||y>=ROWS) return true;
  if(game.map[y][x]==='wall' || game.map[y][x]==='water') return true;
  if(game.enemies.some(e=>e.x===x && e.y===y && e.hp>0)) return true;
  return false;
}

function checkForNpc(x,y){
  return game.npcs.find(n=>n.x===x && n.y===y);
}

function checkForEnemyAt(x,y){
  return game.enemies.find(e=>e.x===x && e.y===y && e.hp>0);
}

document.addEventListener('keydown', e => {
  if(game.inBattle) return;
  const k=e.key;
  let nx=game.player.x, ny=game.player.y;
  if(k==='ArrowUp') ny--;
  if(k==='ArrowDown') ny++;
  if(k==='ArrowLeft') nx--;
  if(k==='ArrowRight') nx++;
  if(nx===game.player.x && ny===game.player.y) return;
  if(isBlocked(nx,ny)){
    const npc = checkForNpc(nx,ny);
    if(npc){ startDialogue(npc); return; }
    const enemy = checkForEnemyAt(nx,ny);
    if(enemy){ startBattle(enemy); return; }
    return;
  }
  game.player.x=nx; game.player.y=ny;
  draw();
});

// Dialogue system with trees
let dialogState = {};
function startDialogue(npc){
  const dlg=document.getElementById('dialogue');
  const treeName = npc.dialog;
  const tree = dialogues[treeName];
  if(!tree){ dlg.innerText = '...'; return; }
  dialogState = {tree: tree, lineId: tree.lines[0].id, npcId: npc.id};
  renderDialog();
}

function renderDialog(){
  const dlg=document.getElementById('dialogue');
  const tree = dialogState.tree;
  const line = tree.lines.find(l=>l.id===dialogState.lineId);
  dlg.innerHTML = '<strong>NPC:</strong> ' + line.text + '\\n\\n';
  line.options.forEach((opt, idx)=>{
    const btn = document.createElement('button');
    btn.innerText = opt.text;
    btn.addEventListener('click', ()=>{
      if(opt.goto==='end'){ dlg.innerText = 'Dialogue ended.'; checkQuestCompletion(); return; }
      dialogState.lineId = opt.goto;
      renderDialog();
    });
    dlg.appendChild(btn);
  });
}

function checkQuestCompletion(){
  // check simple quests (matching gold)
  Object.values(quests).forEach(q=>{
    if(q.goal.gold && game.player.gold >= q.goal.gold && !game.activeQuests[q.id]){
      game.activeQuests[q.id] = {title:q.title, completed:true};
      game.player.inventory.push(q.reward.item);
      document.getElementById('dialogue').innerText = 'Quest completed: ' + q.title + '\\nReward received: ' + q.reward.item;
      audio.win.play();
    }
  });
  updateHud();
}

// BATTLE system
function startBattle(enemy){
  game.inBattle = true;
  game.currentEnemy = enemy;
  document.getElementById('battle').classList.remove('hidden');
  document.getElementById('dialogue').classList.add('hidden');
  document.getElementById('enemyInfo').innerText = enemy.type + ' HP: ' + enemy.hp;
}

document.getElementById('atkBtn').addEventListener('click', ()=>{
  audio.attack.currentTime = 0; audio.attack.play();
  const dmg = Math.floor(Math.random()*14)+6;
  game.currentEnemy.hp -= dmg;
  document.getElementById('enemyInfo').innerText = game.currentEnemy.type + ' HP: ' + Math.max(0, game.currentEnemy.hp);
  if(game.currentEnemy.hp<=0){ winBattle(); return; }
  enemyAttack();
});

document.getElementById('defBtn').addEventListener('click', ()=>{
  const selfDmg = Math.max(0, Math.floor(Math.random()*8)+2 - 6);
  game.player.hp -= selfDmg;
  enemyAttack();
  updateHud();
});

document.getElementById('runBtn').addEventListener('click', ()=>{
  const chance = Math.random();
  if(chance>0.5){ endBattle('You escaped!'); }
  else { enemyAttack(); }
});

function enemyAttack(){
  const dmg = Math.floor(Math.random()*12)+4;
  game.player.hp -= dmg;
  updateHud();
  if(game.player.hp<=0){ endBattle('You were defeated...'); return; }
}

function winBattle(){
  game.player.gold += Math.floor(Math.random()*6)+2;
  game.currentEnemy.hp = 9999; // mark as dead
  audio.win.play();
  endBattle('You won! Gained gold.');
}

function endBattle(msg){
  game.inBattle=false;
  game.currentEnemy=null;
  document.getElementById('battle').classList.add('hidden');
  document.getElementById('dialogue').classList.remove('hidden');
  document.getElementById('dialogue').innerText = msg;
  game.enemies = game.enemies.filter(e=>e.hp>0 && e.hp<999);
  draw();
}

// Save / Load with localStorage
document.getElementById('saveBtn').addEventListener('click', ()=>{
  localStorage.setItem('miniRpgFullSave', JSON.stringify(game));
  document.getElementById('dialogue').innerText = 'Game saved.';
});
document.getElementById('loadBtn').addEventListener('click', ()=>{
  const s = localStorage.getItem('miniRpgFullSave');
  if(s){ game = JSON.parse(s); document.getElementById('dialogue').innerText='Save loaded.'; draw(); updateHud(); }
  else document.getElementById('dialogue').innerText='No save found.';
});

// music toggle
document.getElementById('musicToggle').addEventListener('click', ()=>{
  if(audio.bgm.paused) audio.bgm.play(); else audio.bgm.pause();
});

// init
(async ()=>{
  genMap();
  await loadAssets();
  await loadJson();
  draw();
})();
