const $ = id => document.getElementById(id);

const API_BASE = "https://api.twelvedata.com/time_series";
const SYMBOL = "USD/JPY";
const INTERVAL = "1min";
const STORAGE_KEY = "usdjpyPaperV4";
const API_KEY_STORAGE = "usdjpyTwelveDataKey";

let candles = [];
let model = null;

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {
  balance: 1000, trades: 0, wins: 0, losses: 0, peak: 1000,
  equity: [1000], position: null
};

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function setStatus(id, text, good=false, bad=false){
  const el=$(id); el.textContent=text;
  el.className="status"+(good?" good":"")+(bad?" bad":"");
}

function setMessage(text, bad=false){
  $("dataMessage").textContent=text;
  $("dataMessage").style.color=bad?"#c83333":"";
}

function getKey(){ return localStorage.getItem(API_KEY_STORAGE) || ""; }

function saveKey(){
  const key=$("apiKey").value.trim();
  if(!key){ setMessage("Paste your Twelve Data API key first.", true); return; }
  localStorage.setItem(API_KEY_STORAGE,key);
  setMessage("API key saved in this browser. It is not written to GitHub.");
}

function clearKey(){
  localStorage.removeItem(API_KEY_STORAGE);
  $("apiKey").value="";
  setStatus("dataStatus","Not connected");
  setMessage("API key cleared.");
}

function mean(a){ return a.reduce((x,y)=>x+y,0)/a.length; }
function std(a){
  const m=mean(a);
  return Math.sqrt(mean(a.map(x=>(x-m)**2))) || 1;
}
function sigmoid(z){ return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z)))); }

function ema(values, period){
  const out=new Array(values.length).fill(null), k=2/(period+1);
  let prev=null;
  for(let i=0;i<values.length;i++){
    if(i<period-1) continue;
    if(prev===null) prev=mean(values.slice(i-period+1,i+1));
    else prev=values[i]*k+prev*(1-k);
    out[i]=prev;
  }
  return out;
}

function rsi(values, period=14){
  const out=new Array(values.length).fill(null);
  let gains=0, losses=0;
  for(let i=1;i<values.length;i++){
    const d=values[i]-values[i-1];
    if(i<=period){ gains+=Math.max(d,0); losses+=Math.max(-d,0); if(i===period){
      const rs=(gains/period)/((losses/period)||1e-9); out[i]=100-100/(1+rs);
    }}
    else{
      gains=(gains*(period-1)+Math.max(d,0))/period;
      losses=(losses*(period-1)+Math.max(-d,0))/period;
      const rs=gains/(losses||1e-9); out[i]=100-100/(1+rs);
    }
  }
  return out;
}

function atr(rows, period=14){
  const tr=[];
  for(let i=0;i<rows.length;i++){
    if(i===0) tr.push(rows[i].high-rows[i].low);
    else tr.push(Math.max(rows[i].high-rows[i].low,
      Math.abs(rows[i].high-rows[i-1].close),
      Math.abs(rows[i].low-rows[i-1].close)));
  }
  const out=new Array(rows.length).fill(null);
  for(let i=period-1;i<rows.length;i++) out[i]=mean(tr.slice(i-period+1,i+1));
  return out;
}

function featureRows(rows){
  const close=rows.map(r=>r.close), e9=ema(close,9), e21=ema(close,21);
  const r=rsi(close,14), a=atr(rows,14), result=[];
  for(let i=22;i<rows.length-1;i++){
    if([e9[i],e21[i],r[i],a[i]].some(v=>v===null)) continue;
    const prev=close[i-1], c=close[i];
    const range=rows[i].high-rows[i].low;
    const body=c-rows[i].open;
    const f=[
      (c-prev)/prev,
      (c-close[Math.max(0,i-3)])/close[Math.max(0,i-3)],
      (c-close[Math.max(0,i-5)])/close[Math.max(0,i-5)],
      (e9[i]-e21[i])/c,
      (r[i]-50)/50,
      a[i]/c,
      range/c,
      body/(range||1e-9)
    ];
    const label=rows[i+1].close>c ? 1 : 0;
    result.push({x:f,y:label,index:i});
  }
  return result;
}

function normalize(train, all){
  const n=train[0].x.length, mu=[], sd=[];
  for(let j=0;j<n;j++){
    const col=train.map(r=>r.x[j]); mu[j]=mean(col); sd[j]=std(col);
  }
  return {mu,sd,data:all.map(r=>({...r,x:r.x.map((v,j)=>(v-mu[j])/sd[j])}))};
}

function trainLogistic(rows){
  const feats=featureRows(rows);
  if(feats.length<180) throw new Error("Not enough usable candles. Fetch at least 500 1-minute candles.");
  const n=feats.length;
  const a=Math.floor(n*.60), b=Math.floor(n*.80);
  const rawTrain=feats.slice(0,a), rawVal=feats.slice(a,b), rawTest=feats.slice(b);
  const norm=normalize(rawTrain,feats).data;
  const train=norm.slice(0,a), val=norm.slice(a,b), test=norm.slice(b);

  const w=new Array(train[0].x.length).fill(0), lr=.03, lambda=.0005;
  let bias=0;
  for(let epoch=0;epoch<700;epoch++){
    const grad=new Array(w.length).fill(0), gb=0;
    for(const row of train){
      const p=sigmoid(bias+w.reduce((s,v,j)=>s+v*row.x[j],0));
      const e=p-row.y;
      for(let j=0;j<w.length;j++) grad[j]+=e*row.x[j];
      // accumulate bias separately
      // gb is updated below
    }
    let sumErr=0;
    for(const row of train){
      const p=sigmoid(bias+w.reduce((s,v,j)=>s+v*row.x[j],0));
      sumErr += p-row.y;
    }
    bias -= lr*sumErr/train.length;
    for(let j=0;j<w.length;j++) w[j]-=lr*(grad[j]/train.length+lambda*w[j]);
  }

  function predict(x){ return sigmoid(bias+w.reduce((s,v,j)=>s+v*x[j],0)); }
  const valProb=val.map(r=>predict(r.x)), valY=val.map(r=>r.y);
  let bestT=.55, bestScore=-Infinity;
  for(let t=.50;t<=.70;t+=.01){
    let tp=0,fp=0,fn=0;
    for(let i=0;i<val.length;i++){
      const pred=valProb[i]>=t?1:0;
      if(pred&&valY[i])tp++; else if(pred&&!valY[i])fp++; else if(!pred&&valY[i])fn++;
    }
    const precision=tp/(tp+fp||1), recall=tp/(tp+fn||1);
    const f1=2*precision*recall/(precision+recall||1);
    if(f1>bestScore){bestScore=f1;bestT=t;}
  }

  const probs=test.map(r=>predict(r.x));
  const preds=test.map((r,i)=>probs[i]>=bestT?1:0);
  const acc=preds.filter((p,i)=>p===test[i].y).length/test.length;
  const base=Math.max(test.filter(r=>r.y===1).length,test.filter(r=>r.y===0).length)/test.length;
  const actionable=probs.map(p=>Math.max(p,1-p)>=bestT);
  const tradeAcc=probs.reduce((s,p,i)=>s+(actionable[i]?(preds[i]===test[i].y):0),0)/(actionable.filter(Boolean).length||1);

  return {
    weights:w,bias,mu:normMu(rawTrain),sd:normSd(rawTrain),threshold:bestT,
    trainRows:train.length,valRows:val.length,testRows:test.length,
    testAcc:acc,baseline:base,testTrades:actionable.filter(Boolean).length,actionableAcc:tradeAcc,
    lastIndex:feats[feats.length-1].index
  };
}

function normMu(train){
  const n=train[0].x.length, out=[];
  for(let j=0;j<n;j++) out[j]=mean(train.map(r=>r.x[j]));
  return out;
}
function normSd(train){
  const n=train[0].x.length, out=[];
  for(let j=0;j<n;j++) out[j]=std(train.map(r=>r.x[j]));
  return out;
}

function latestFeatures(rows){
  const close=rows.map(r=>r.close), e9=ema(close,9), e21=ema(close,21);
  const r=rsi(close,14), a=atr(rows,14), i=rows.length-1;
  if(i<23 || [e9[i],e21[i],r[i],a[i]].some(v=>v===null)) return null;
  const prev=close[i-1], c=close[i], range=rows[i].high-rows[i].low;
  return [
    (c-prev)/prev,
    (c-close[i-3])/close[i-3],
    (c-close[i-5])/close[i-5],
    (e9[i]-e21[i])/c,
    (r[i]-50)/50,
    a[i]/c,
    range/c,
    (c-rows[i].open)/(range||1e-9)
  ];
}

async function fetchCandles(){
  const key=getKey();
  if(!key) throw new Error("No Twelve Data API key saved.");
  const count=Number($("candleCount").value);
  const url=`${API_BASE}?symbol=${encodeURIComponent(SYMBOL)}&interval=${INTERVAL}&outputsize=${count}&timezone=UTC&apikey=${encodeURIComponent(key)}`;
  const res=await fetch(url);
  const data=await res.json();
  if(!res.ok || data.status==="error" || !data.values) throw new Error(data.message || "Market-data request failed.");
  const rows=data.values.map(v=>({
    time:v.datetime,open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close)
  })).filter(r=>[r.open,r.high,r.low,r.close].every(Number.isFinite)).reverse();
  if(rows.length<200) throw new Error(`Only ${rows.length} usable candles returned; at least 200 are needed.`);
  return rows;
}

function runPrediction(){
  const x=latestFeatures(candles);
  if(!x) throw new Error("Latest candle does not contain enough data for features.");
  const z=x.map((v,i)=>(v-model.mu[i])/model.sd[i]);
  const p=sigmoid(model.bias+model.weights.reduce((s,w,i)=>s+w*z[i],0));
  const up=p, down=1-p;
  let signal="NO TRADE";
  if(p>=model.threshold) signal="UP";
  else if(p<=(1-model.threshold)) signal="DOWN";
  return {price:candles.at(-1).close,up,down,signal};
}

function formatCandleTime(utcString){
  // Twelve Data timestamps are UTC. Convert them to the phone/browser timezone
  // for display, while keeping the original UTC timestamp visible for reference.
  const raw=String(utcString).trim();
  const iso=raw.endsWith("Z") ? raw : raw.replace(" ","T")+"Z";
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return {local:raw,utc:raw+" UTC"};
  const local=new Intl.DateTimeFormat(undefined,{
    dateStyle:"medium", timeStyle:"medium"
  }).format(d);
  const utc=new Intl.DateTimeFormat("en-GB",{
    timeZone:"UTC", dateStyle:"medium", timeStyle:"medium", hour12:false
  }).format(d)+" UTC";
  return {local,utc};
}

function renderAnalysis(a){
  $("price").textContent=a.price.toFixed(3);
  $("up").textContent=(a.up*100).toFixed(1)+"%";
  $("down").textContent=(a.down*100).toFixed(1)+"%";
  $("upbar").style.width=(a.up*100)+"%";
  $("downbar").style.width=(a.down*100)+"%";
  $("signal").textContent=a.signal;
  $("signal").className=a.signal==="UP"?"up":a.signal==="DOWN"?"down":"no-trade";
  $("reason").textContent=a.signal==="NO TRADE"
    ? `Below model threshold ${(model.threshold*100).toFixed(0)}%.`
    : `Model confidence ${(Math.max(a.up,a.down)*100).toFixed(1)}%.`;
  $("price").dataset.price=a.price;
  const t=formatCandleTime(candles.at(-1).time);
  $("change").textContent=`Candle time: ${t.local} · Source: ${t.utc}`;
}

async function refreshAnalysis(){
  try{
    setStatus("dataStatus","Fetching…");
    setMessage("Downloading USD/JPY 1-minute candles and training the model…");
    candles=await fetchCandles();
    model=trainLogistic(candles);
    const a=runPrediction();
    renderAnalysis(a);
    $("trainRows").textContent=model.trainRows;
    $("valRows").textContent=model.valRows;
    $("testRows").textContent=model.testRows;
    $("testAcc").textContent=(model.testAcc*100).toFixed(1)+"%";
    $("testBase").textContent=(model.baseline*100).toFixed(1)+"%";
    $("testTrades").textContent=model.testTrades;
    $("splitNote").textContent=`Chronological 60/20/20 split. Test accuracy ${(model.testAcc*100).toFixed(1)}%; baseline ${(model.baseline*100).toFixed(1)}%; validation-selected threshold ${(model.threshold*100).toFixed(0)}%.`;
    setStatus("dataStatus",`${candles.length} candles`,true);
    setStatus("modelStatus","Trained",true);
    setMessage("Live data loaded. Signal is research-only and paper-trading only.");
    if(state.position) renderStats();
  }catch(err){
    console.error(err);
    setStatus("dataStatus","Error",false,true);
    setStatus("modelStatus","Not trained",false,true);
    setMessage(err.message || "Something went wrong.",true);
  }
}

function renderRisk(){
  const balance=Number($("balance").value)||0, risk=Number($("risk").value)||0;
  const stop=Number($("stop").value)||1, target=Number($("target").value)||1;
  $("riskAmount").textContent="$"+(balance*risk/100).toFixed(2);
  $("rr").textContent="1:"+(target/stop).toFixed(2);
}

function renderStats(){
  $("pBalance").textContent="$"+state.balance.toFixed(2);
  $("trades").textContent=state.trades;
  $("wins").textContent=state.wins;
  $("losses").textContent=state.losses;
  $("winrate").textContent=(state.trades?state.wins/state.trades*100:0).toFixed(1)+"%";
  $("dd").textContent=((state.peak-state.balance)/state.peak*100).toFixed(2)+"%";
  $("tradeStatus").textContent=state.position
    ? `Open PAPER ${state.position.side} at ${state.position.price.toFixed(3)} · ${state.position.units.toFixed(0)} units`
    : "No open paper position.";
  drawChart();
}

function drawChart(){
  const c=$("chart"),ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=180;
  c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const arr=state.equity,min=Math.min(...arr),max=Math.max(...arr),span=(max-min)||1;
  ctx.beginPath();
  arr.forEach((v,i)=>{const x=10+(w-20)*(i/Math.max(1,arr.length-1));const y=h-15-(h-30)*(v-min)/span;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.strokeStyle="#2775e8";ctx.lineWidth=3;ctx.stroke();
}

function openPaper(side){
  if(state.position) return;
  const price=Number($("price").dataset.price);
  if(!Number.isFinite(price)){alert("Fetch live data first.");return;}
  const balance=Number($("balance").value)||state.balance;
  const riskPct=Number($("risk").value)||1;
  const stop=Number($("stop").value)||5;
  const riskAmount=balance*riskPct/100;
  // Approximate USD/JPY position sizing in USD account currency.
  const units=riskAmount/(stop*0.01/price);
  state.position={side,price,units,stop,target:Number($("target").value)||10};
  save();renderStats();
}

function closePaper(){
  if(!state.position) return;
  const current=Number($("price").dataset.price);
  if(!Number.isFinite(current)){alert("Fetch live data first.");return;}
  const p=state.position;
  const jpyPnl=p.side==="BUY"?(current-p.price)*p.units:(p.price-current)*p.units;
  const usdPnl=jpyPnl/current;
  state.balance+=usdPnl;state.trades++;
  usdPnl>=0?state.wins++:state.losses++;
  state.peak=Math.max(state.peak,state.balance);state.equity.push(state.balance);
  state.position=null;save();renderStats();
}

$("apiKey").value=getKey();
$("saveKey").onclick=saveKey;
$("clearKey").onclick=clearKey;
$("refresh").onclick=refreshAnalysis;
$("paperRefresh").onclick=refreshAnalysis;
$("paperBuy").onclick=()=>openPaper("BUY");
$("paperSell").onclick=()=>openPaper("SELL");
$("closeTrade").onclick=closePaper;
["balance","risk","stop","target"].forEach(id=>$(id).addEventListener("input",renderRisk));
$("reset").onclick=()=>{if(confirm("Reset paper trading data?")){localStorage.removeItem(STORAGE_KEY);location.reload();}};
renderRisk();renderStats();
window.addEventListener("resize",drawChart);


// V4.2: automatically refresh market data every 60 seconds.
// The API key remains in localStorage and is never written into the repository.
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = Date.now() + AUTO_REFRESH_MS;

function setRefreshStatus(message) {
  const el = $("refreshStatus");
  if (el) el.textContent = message;
}

function updateRefreshCountdown() {
  const el = $("refreshCountdown");
  if (!el) return;
  const seconds = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
  el.textContent = seconds === 0
    ? "Refreshing market data…"
    : `Next market-data refresh in ${seconds}s.`;
}

async function autoRefreshMarketData() {
  try {
    // V4.2 expects the existing V4/V4.1 fetch-and-train function to be available.
    // Try the common function names used by the V4 app.
    if (typeof fetchAndTrain === "function") {
      await fetchAndTrain();
    } else if (typeof fetchAndTrainModel === "function") {
      await fetchAndTrainModel();
    } else if (typeof loadMarketData === "function") {
      await loadMarketData();
    } else {
      // Fallback: click the existing Fetch & train button so V4.2 remains
      // compatible with the existing UI without duplicating API logic.
      const btn = $("fetchTrain") || $("fetch") || $("train");
      if (btn) btn.click();
      else throw new Error("V4 fetch/train function or button was not found.");
    }
    setRefreshStatus("Auto-refresh ON · updated just now");
  } catch (err) {
    console.error("Automatic market-data refresh failed:", err);
    setRefreshStatus("Auto-refresh ON · refresh failed");
  } finally {
    nextRefreshAt = Date.now() + AUTO_REFRESH_MS;
    updateRefreshCountdown();
  }
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);

  nextRefreshAt = Date.now() + AUTO_REFRESH_MS;
  updateRefreshCountdown();

  autoRefreshTimer = setInterval(autoRefreshMarketData, AUTO_REFRESH_MS);
  countdownTimer = setInterval(updateRefreshCountdown, 1000);
}

startAutoRefresh();
