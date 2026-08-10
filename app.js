const $ = id => document.getElementById(id);

let state = JSON.parse(localStorage.getItem("usdjpyPaper") || "null") || {
  balance: 1000, trades: 0, wins: 0, losses: 0, peak: 1000,
  equity: [1000], position: null
};

function save(){ localStorage.setItem("usdjpyPaper", JSON.stringify(state)); }

function demoAnalysis(){
  // Demo placeholder. Replace with backend/ML inference later.
  const up = 0.35 + Math.random()*0.30;
  const down = 1-up;
  let signal = "NO TRADE";
  if(up >= .60) signal = "UP";
  if(down >= .60) signal = "DOWN";
  return {price:156 + (Math.random()-.5)*.5, up, down, signal};
}

function renderAnalysis(){
  const a = demoAnalysis();
  $("price").textContent = a.price.toFixed(3);
  $("up").textContent = (a.up*100).toFixed(1)+"%";
  $("down").textContent = (a.down*100).toFixed(1)+"%";
  $("upbar").style.width = (a.up*100)+"%";
  $("downbar").style.width = (a.down*100)+"%";
  $("signal").textContent = a.signal;
  $("signal").className = a.signal === "UP" ? "up" : a.signal === "DOWN" ? "down" : "no-trade";
  $("reason").textContent = a.signal === "NO TRADE" ? "Confidence below demo threshold." : "Demo probability threshold met.";
  $("price").dataset.price = a.price;
}

function renderRisk(){
  const balance = Number($("balance").value)||0;
  const risk = Number($("risk").value)||0;
  const stop = Number($("stop").value)||1;
  const target = Number($("target").value)||1;
  $("riskAmount").textContent = "$"+(balance*risk/100).toFixed(2);
  $("rr").textContent = "1:"+(target/stop).toFixed(2);
}

function renderStats(){
  $("pBalance").textContent="$"+state.balance.toFixed(2);
  $("trades").textContent=state.trades;
  $("wins").textContent=state.wins;
  $("losses").textContent=state.losses;
  $("winrate").textContent=(state.trades ? state.wins/state.trades*100 : 0).toFixed(1)+"%";
  $("dd").textContent=((state.peak-state.balance)/state.peak*100).toFixed(2)+"%";
  $("tradeStatus").textContent = state.position ?
    `Open PAPER ${state.position.side} at ${state.position.price.toFixed(3)}` :
    "No open paper position.";
  drawChart();
}

function drawChart(){
  const c=$("chart"), ctx=c.getContext("2d"), dpr=devicePixelRatio||1;
  const w=c.clientWidth, h=180;
  c.width=w*dpr; c.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const arr=state.equity, min=Math.min(...arr), max=Math.max(...arr), span=(max-min)||1;
  ctx.beginPath();
  arr.forEach((v,i)=>{
    const x=10+(w-20)*(i/Math.max(1,arr.length-1));
    const y=h-15-(h-30)*(v-min)/span;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.strokeStyle="#2775e8"; ctx.lineWidth=3; ctx.stroke();
}

function openPaper(side){
  if(state.position) return;
  const price=Number($("price").dataset.price||156);
  state.position={side,price};
  save(); renderStats();
}

function closePaper(){
  if(!state.position) return;
  const current=Number($("price").dataset.price||156);
  const diff = state.position.side==="BUY" ? current-state.position.price : state.position.price-current;
  const pnl = diff*20; // demo unit sizing
  state.balance += pnl;
  state.trades++;
  pnl>=0 ? state.wins++ : state.losses++;
  state.peak=Math.max(state.peak,state.balance);
  state.equity.push(state.balance);
  state.position=null;
  save(); renderStats();
}

$("refresh").onclick=renderAnalysis;
$("paperBuy").onclick=()=>openPaper("BUY");
$("paperSell").onclick=()=>openPaper("SELL");
$("closeTrade").onclick=closePaper;
["balance","risk","stop","target"].forEach(id=>$(id).addEventListener("input",renderRisk));
$("reset").onclick=()=>{ if(confirm("Reset paper trading data?")){ localStorage.removeItem("usdjpyPaper"); location.reload(); }};

renderAnalysis(); renderRisk(); renderStats();
window.addEventListener("resize",drawChart);
