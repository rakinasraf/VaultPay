'use strict';
/* VaultPay – MFS & Online Banking (HTML+CSS+JS only). The "database" lives in localStorage. */
const K='vaultpay_db',$=s=>document.querySelector(s);
const h=s=>{let x=5381;for(const c of String(s))x=(x*33^c.charCodeAt(0))>>>0;return x.toString(36)}; // demo hash (use password_hash/bcrypt on a real server)
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const M=n=>'৳'+(+n).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
const mask=m=>m.slice(0,3)+'****'+m.slice(-4),D=t=>new Date(t).toLocaleString();
function seed(){
 const u=(id,name,mobile,role,pw,pin,bal,x={})=>({id,name,mobile,email:name.split(' ')[0].toLowerCase()+'@mail.com',nid:'19'+mobile,role,pw:h(pw),pin:h(pin),bal,kyc:role=='customer'?'not_submitted':'verified',fails:0,locked:0,active:1,approved:1,daily:role=='customer'?50000:1e6,...x});
 const d={users:[u(1,'Platform Admin','01700000000','admin','admin123','12345',0),u(2,'Rahim Uddin','01711111111','customer','1234','12345',5000),u(3,'Karima Begum','01722222222','customer','1234','12345',2000),u(4,'Star Agent','01733333333','agent','1234','12345',50000,{shop:'Star Point, Dhaka',low:5000}),u(5,'Golden Mart','01744444444','merchant','1234','12345',0,{shop:'Golden Mart',code:'M1001',mdr:1.5})],
 tx:[],rev:[],inv:[],freq:[],cmp:[],fraud:[],aud:[],plans:[],notes:[{to:0,t:'Welcome to VaultPay 💎',at:Date.now(),read:[]}],out:0,pool:0,minted:57000,seq:10,
 fees:{send_money:{flat:5,pct:0,lim:25000,comm:0},cash_out:{flat:0,pct:1.85,lim:25000,comm:.4},cash_in:{flat:0,pct:0,lim:50000,comm:.2},merchant_payment:{flat:0,pct:0,lim:50000,comm:0},bill_payment:{flat:5,pct:0,lim:30000,comm:0},savings:{flat:0,pct:0,lim:500000,comm:0},bank_transfer:{flat:10,pct:0,lim:100000,comm:0},refund:{flat:0,pct:0,lim:1e6,comm:0}},
 billers:['DESCO Electricity','Titas Gas','WASA Water','Grameenphone Recharge'],prods:[{n:'DPS Saver 12m',r:8,m:12,min:500},{n:'FDR Gold 12m',r:9,m:12,min:5000},{n:'FDR Diamond 24m',r:10,m:24,min:10000}]};
 localStorage.setItem(K,JSON.stringify(d));return d}
let db=JSON.parse(localStorage.getItem(K)||'null')||seed(),me=db.users.find(u=>u.id==sessionStorage.uid),pg,au='Login';
const save=()=>localStorage.setItem(K,JSON.stringify(db)),U=id=>db.users.find(u=>u.id==id),byMob=m=>db.users.find(u=>u.mobile==m);
const toast=(m,b)=>{const t=$('#toast');t.textContent=m;t.className=b?'bad show':'show';setTimeout(()=>t.className='',3200)};
const bad=m=>(toast(m,1),null),log=a=>db.aud.push({u:me?me.id:0,a,at:Date.now()}),note=(to,t)=>db.notes.push({to,t,at:Date.now(),read:[]});
const st=t=>db.rev.includes(t.id)?'reversed':t.st,who=id=>U(id)?E(U(id).name)+' '+mask(U(id).mobile):'Biller / Bank / Platform';
const mk=o=>{const t={id:'TRX'+Date.now().toString(36).toUpperCase()+db.seq++,fee:0,mdr:0,cm:0,st:'completed',note:'',at:Date.now(),...o};db.tx.push(t);return t};
const flag=(u,rule,sev,tx)=>db.fraud.push({id:db.seq++,u:u.id,tx,rule,sev,st:'open',at:Date.now()});
function pinChk(u,p){ // PIN check + lock after 3 wrong attempts
 if(u.locked>Date.now())return bad('PIN locked until '+new Date(u.locked).toLocaleTimeString());
 if(h(p)!==u.pin){u.fails++;if(u.fails>=3){u.locked=Date.now()+3e5;u.fails=0;flag(u,'3 wrong PIN attempts','medium')}save();return bad('Wrong PIN')}
 u.fails=0;return true}
function pay(type,from,to,amt,pin,o={}){ // every money movement goes through here (atomic: validate first, then apply, then append to ledger)
 amt=+amt;const f=db.fees[type];
 if(!(amt>0))return bad('Enter a valid amount');
 if(!pinChk(from,pin))return null;
 if(!from.active)return bad('Wallet is blocked');if(to&&!to.active)return bad('Receiver wallet is blocked');
 if(amt>f.lim)return bad('Per-transaction limit is '+M(f.lim));
 const lim=from.daily*(from.kyc=='verified'?1:.2),used=db.tx.filter(t=>t.from==from.id&&t.at>Date.now()-864e5&&t.type!='reversal').reduce((a,t)=>a+t.amt,0);
 if(used+amt>lim)return bad('Daily limit '+M(lim)+' exceeded'+(from.kyc!='verified'?' – verify your KYC to raise it':''));
 const fee=+(f.flat+amt*f.pct/100).toFixed(2);
 if(from.bal<amt+fee)return bad('Insufficient balance');
 const mdr=o.mdr?+(amt*o.mdr/100).toFixed(2):0,ag=[to,from].find(x=>x&&x.role=='agent'),cm=ag&&f.comm?+(amt*f.comm/100).toFixed(2):0;
 from.bal=+(from.bal-amt-fee).toFixed(2);
 if(to)to.bal=+(to.bal+amt-mdr).toFixed(2);else db.out=+(db.out+amt).toFixed(2);
 db.pool=+(db.pool+fee+mdr-cm).toFixed(2);if(cm)ag.bal=+(ag.bal+cm).toFixed(2);
 const t=mk({type,from:from.id,to:to?to.id:0,amt,fee,mdr,cm,note:o.note||''});
 if(amt>=20000)flag(from,'Large transfer ≥ ৳20,000','high',t.id);
 if(db.tx.filter(x=>x.from==from.id&&x.at>Date.now()-6e5).length>=5)flag(from,'5+ transactions in 10 minutes','medium',t.id);
 if(to)note(to.id,`${M(amt)} received · ${t.id}`);
 save();return t}
const run=(ty,to,d,o)=>{const t=pay(ty,me,to,d.amt,d.pin,o);if(t){log(ty+' '+t.id);toast('✅ Done · '+t.id);render()}return t};
/* ---------- UI helpers ---------- */
const T=(hd,r)=>`<div class=tw><table><tr>${hd.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan=${hd.length}>Nothing here yet</td></tr>`}</table></div>`;
const F=(id,fs,b)=>`<form id=${id}>${fs.map(([n,l,t='text',x=''])=>`<label>${l}${t=='select'?`<select name=${n}>${x}</select>`:`<input name=${n} type=${t} ${x} ${x.includes('data-o')?'':'required'} autocomplete=off>`}</label>`).join('')}<button>${b}</button></form>`;
const mine=()=>me.role=='admin'?db.tx:db.tx.filter(t=>t.from==me.id||t.to==me.id);
const NOREV=['float_topup','reversal','add_money','savings_close'];
const TX=l=>T(['TrxID','Type','From → To','Amount','Fee','Status','Time',''],l.slice().reverse().map(t=>[t.id,t.type,`${who(t.from)} → ${who(t.to)}`,M(t.amt),M(t.fee),st(t),D(t.at),`<button onclick="A.rc('${t.id}')">🧾</button>`+(me.role=='admin'&&!db.rev.includes(t.id)&&!NOREV.includes(t.type)?` <button onclick="A.rv('${t.id}')">↩</button>`:'')]));
const pend=()=>db.users.filter(u=>u.role=='customer'?u.kyc=='pending':u.approved===0);
const invT=()=>T(['Invoice','Customer','Amount','Due','Status',''],db.inv.filter(i=>i.m==me.id).map(i=>[i.no,mask(i.mob),M(i.amt),i.due,i.st,i.st=='pending'?`<button onclick="A.ci(${i.id})">Cancel</button>`:i.trx||'']));
const UL=q=>T(['Name','Mobile','Role','Balance','KYC','Status',''],db.users.filter(u=>(u.name+u.mobile).toLowerCase().includes(q.toLowerCase())).map(u=>[E(u.name),u.mobile,u.role,M(u.bal),u.kyc,u.active?'active':'blocked',`<button onclick="A.bl(${u.id})">${u.active?'Block':'Unblock'}</button> <button onclick="A.ul(${u.id})">Unlock PIN</button>`]));
const lookF=(l,n)=>[n,l,'text','oninput="A.look(this)"'];
/* ---------- Pages ---------- */
const P={
cHome:()=>{const lim=me.daily*(me.kyc=='verified'?1:.2),u=db.tx.filter(t=>t.from==me.id&&t.at>Date.now()-864e5).reduce((a,t)=>a+t.amt,0);return`<div class=card><h2>💰 My Vault <small>${me.mobile}</small></h2><div class=bal id=bal>${M(me.bal)}</div><button onclick="A.eye()">👁 Show / Hide</button><p>KYC: <span class=tag>${me.kyc}</span> · Daily limit used ${M(u)} of ${M(lim)}</p></div><h3>Recent transactions</h3>${TX(mine().slice(-5))}`},
cSend:()=>`<div class=card><h2>💸 Send Money</h2><p>Fee ${M(db.fees.send_money.flat)} · Max ${M(db.fees.send_money.lim)} per transaction</p>${F('send',[lookF('Receiver mobile','to'),['amt','Amount','number','min=1'],['pin','PIN','password','maxlength=5']],'Send')}<small id=nm></small></div>`,
cCashOut:()=>`<div class=card><h2>🏧 Cash Out</h2><p>Fee ${db.fees.cash_out.pct}% of amount</p>${F('cout',[lookF('Agent mobile (demo: 01733333333)','to'),['amt','Amount','number','min=1'],['pin','PIN','password','maxlength=5']],'Cash Out')}<small id=nm></small></div>`,
cPay:()=>`<div class=card><h2>🛍 Pay Merchant</h2>${F('mpay',[['code','Merchant code (demo: M1001)'],['amt','Amount (leave blank to pay an invoice)','number','data-o'],['inv','Invoice no (optional)','text','data-o'],['pin','PIN','password','maxlength=5']],'Pay')}</div><h3>My pending invoices</h3>${T(['Invoice','Merchant','Amount','Due'],db.inv.filter(i=>i.mob==me.mobile&&i.st=='pending').map(i=>[i.no,E(U(i.m).shop),M(i.amt),i.due]))}`,
cBills:()=>`<div class=card><h2>💡 Bills & Recharge</h2>${F('bill',[['b','Biller','select',db.billers.map((b,i)=>`<option value=${i}>${b}</option>`).join('')],['ref','Customer reference / mobile'],['amt','Amount','number','min=1'],['pin','PIN','password','maxlength=5']],'Pay Bill')}</div><h3>Bill history</h3>${TX(mine().filter(t=>t.type=='bill_payment'&&t.from==me.id))}`,
cBank:()=>`<div class=card><h2>🏦 Bank (simulated)</h2>${F('bank',[['dir','Direction','select','<option value=out>Wallet → Bank</option>'+(me.role=='customer'?'<option value=in>Bank → Wallet (add money)</option>':'')],['bk','Bank & account number'],['amt','Amount','number','min=1'],['pin','PIN','password','maxlength=5']],'Confirm')}</div>`,
cSave:()=>`<div class=card><h2>🏆 DPS / FDR Savings</h2>${F('save',[['p','Product','select',db.prods.map((p,i)=>`<option value=${i}>${p.n} · ${p.r}% · min ${p.min}</option>`).join('')],['amt','Deposit','number','min=1'],['pin','PIN','password','maxlength=5']],'Open plan')}</div>${T(['Plan','Deposit','Maturity amount','Maturity date','Status',''],db.plans.filter(p=>p.u==me.id).map(p=>[db.prods[p.p].n,M(p.dep),M(p.mat),p.end,p.st,p.st=='active'?`<button onclick="A.cl(${p.id})">Close</button>`:'']))}`,
cKYC:()=>`<div class=card><h2>🪪 KYC</h2><p>Status: <span class=tag>${me.kyc}</span> ${me.kyc=='rejected'?'– rejected, please resubmit':''}</p>${me.kyc=='verified'||me.kyc=='pending'?'':F('kyc',[['a','NID front','file'],['b','NID back','file'],['c','Photo','file']],'Submit for review')}</div>`,
History:()=>`<div class=card><h2>📜 Transactions</h2><div class=grid><select id=ft onchange=A.hf()><option value="">All types</option>${Object.keys(db.fees).concat(['float_topup','reversal','add_money','savings_close']).map(k=>`<option>${k}</option>`).join('')}</select><input id=fq placeholder="Search TrxID" oninput=A.hf()></div></div><div id=hl>${TX(mine())}</div>`,
Help:()=>`<div class=card><h2>📨 Raise a complaint</h2>${F('cmp',[['t','TrxID'],['d','Describe the problem']],'Submit')}</div>${T(['ID','Trx','Issue','Status','Admin note'],db.cmp.filter(c=>c.u==me.id).map(c=>[c.id,c.t,E(c.d),c.st,E(c.n||'')]))}`,
Alerts:()=>`<div class=card><h2>🔔 Notifications</h2>${db.notes.map((n,i)=>[n,i]).filter(([n])=>!n.to||n.to==me.id).reverse().map(([n,i])=>{const r=n.read.includes(me.id);return`<p>${r?'':'🟡 '}${E(n.t)} <small>${D(n.at)}</small> ${r?'':`<button onclick="A.rd(${i})">Mark read</button>`}</p>`}).join('')}</div>`,
gHome:()=>{const td=db.tx.filter(t=>t.at>Date.now()-864e5&&(t.from==me.id||t.to==me.id)),ci=td.filter(t=>t.type=='cash_in'),co=td.filter(t=>t.type=='cash_out'),s=l=>l.reduce((a,t)=>a+t.amt,0);return`${me.bal<me.low?'<div class="card warn">⚠️ Low e-float! Request a top-up.</div>':''}<div class=grid><div class=card>E-float<div class=bal>${M(me.bal)}</div></div><div class=card>Cash-in today<b>${ci.length} · ${M(s(ci))}</b></div><div class=card>Cash-out today<b>${co.length} · ${M(s(co))}</b></div><div class=card>Commission today<b>${M(td.reduce((a,t)=>a+t.cm,0))}</b></div></div>`},
gCashIn:()=>`<div class=card><h2>💵 Cash-in for customer</h2>${F('cin',[lookF('Customer mobile (demo: 01711111111)','to'),['amt','Amount','number','min=1'],['pin','Agent PIN','password','maxlength=5']],'Cash-in')}<small id=nm></small></div>`,
gFloat:()=>`<div class=card><h2>⚡ E-float</h2>${F('freq',[['amt','Request amount','number','min=1']],'Request top-up')}${F('low',[['v','Low-float alert threshold (now '+me.low+')','number','min=0']],'Save threshold')}</div>${T(['ID','Amount','Status','Note'],db.freq.filter(r=>r.u==me.id).map(r=>[r.id,M(r.amt),r.st,E(r.n||'')]))}`,
gStatement:()=>{const l=mine().filter(t=>t.cm),i=mine().filter(t=>t.type=='cash_in'&&t.from==me.id).reduce((a,t)=>a+t.amt,0),o=mine().filter(t=>t.type=='cash_out'&&t.to==me.id).reduce((a,t)=>a+t.amt,0);return`<div class=card><h2>📒 Commission & end-of-day reconciliation</h2><p>Commission earned: <b>${M(l.reduce((a,t)=>a+t.cm,0))}</b></p><p>Cash received (cash-in) ${M(i)} · Cash paid out (cash-out) ${M(o)} → <b>Expected cash in hand ${M(i-o)}</b></p><button onclick="print()">🖨 Print</button></div>${T(['TrxID','Type','Amount','Commission','Time'],l.map(t=>[t.id,t.type,M(t.amt),M(t.cm),D(t.at)]))}`},
mHome:()=>{const s=db.tx.filter(t=>t.type=='merchant_payment'&&t.to==me.id&&t.at>Date.now()-864e5);return`<div class=grid><div class=card>Wallet<div class=bal>${M(me.bal)}</div></div><div class=card>Today's sales<b>${M(s.reduce((a,t)=>a+t.amt,0))}</b></div><div class=card>Pending invoices<b>${db.inv.filter(i=>i.m==me.id&&i.st=='pending').length}</b></div><div class=card>Merchant code<div class=bal>${me.code}</div><small>MDR ${me.mdr}%</small></div></div><h3>Recent payments</h3>${TX(s.slice(-5))}`},
mInvoices:()=>`<div class=card><h2>🧾 New invoice</h2>${F('inv',[['mob','Customer mobile'],['amt','Amount','number','min=1'],['ds','Description'],['due','Due date','date']],'Create')}</div><div id=il>${invT()}</div>`,
mPayments:()=>`<div class=card><h2>🔍 Verify payment by TrxID</h2>${F('ver',[['t','TrxID']],'Verify')}<p id=vr></p></div>${T(['TrxID','Customer','Gross','Fee','Net','Status',''],db.tx.filter(t=>t.type=='merchant_payment'&&t.to==me.id).map(t=>[t.id,who(t.from),M(t.amt),M(t.mdr),M(t.amt-t.mdr),st(t),db.rev.includes(t.id)?'':`<button onclick="A.rf('${t.id}')">Refund</button>`]))}`,
aHome:()=>{const c=r=>db.users.filter(u=>u.role==r).length,td=db.tx.filter(t=>t.at>Date.now()-864e5);return`<div class=grid><div class=card>Customers<b>${c('customer')}</b></div><div class=card>Agents<b>${c('agent')}</b></div><div class=card>Merchants<b>${c('merchant')}</b></div><div class=card>E-money in wallets<b>${M(db.users.reduce((a,u)=>a+u.bal,0))}</b></div><div class=card>Today<b>${td.length} txns · ${M(td.reduce((a,t)=>a+t.amt,0))}</b></div><div class=card>Net fee revenue<b>${M(db.pool)}</b></div><div class=card>Pending approvals<b>${pend().length}</b></div><div class=card>Open fraud alerts<b>${db.fraud.filter(f=>f.st=='open').length}</b></div></div><p><button onclick="A.rec()">⚖️ Run daily reconciliation</button></p>`},
aApprovals:()=>`<h2>✅ KYC & account approvals</h2>${T(['Name','Role','Mobile','NID','Waiting for',''],pend().map(u=>[E(u.name),u.role,u.mobile,u.nid,u.role=='customer'?'KYC':'Approval',`<button onclick="A.ap(${u.id},1)">Approve</button> <button onclick="A.ap(${u.id},0)">Reject</button>`]))}`,
aFloat:()=>`<h2>⚡ Agent e-float requests</h2>${T(['ID','Agent','Amount','Status',''],db.freq.map(r=>[r.id,E(U(r.u).name),M(r.amt),r.st,r.st=='pending'?`<button onclick="A.fa(${r.id},1)">Approve</button> <button onclick="A.fa(${r.id},0)">Reject</button>`:'']))}`,
aFees:()=>`<div class=card><h2>⚙️ Fee rules, commissions & limits</h2>${T(['Type','Flat ৳','Fee %','Per-txn limit','Agent comm %'],Object.keys(db.fees).map(k=>[k,...['flat','pct','lim','comm'].map(f=>`<input id=f_${k}_${f} type=number step=any value=${db.fees[k][f]}>`)]))}<button onclick="A.fs()">Save rules</button></div>`,
aFraud:()=>`<h2>🚨 Fraud monitor</h2>${T(['ID','User','Rule','Severity','Trx','Status',''],db.fraud.map(f=>[f.id,E(U(f.u).name),f.rule,f.sev,f.tx||'—',f.st,f.st=='open'?`<button onclick="A.fr(${f.id},'cleared')">Clear</button> <button onclick="A.fr(${f.id},'escalated')">Escalate</button> <button onclick="A.fr(${f.id},'block')">Block wallet</button>`:'']))}`,
aComplaints:()=>`<h2>📨 Complaints</h2>${T(['ID','User','Trx','Issue','Status',''],db.cmp.map(c=>[c.id,E(U(c.u).name),c.t,E(c.d),c.st,c.st!='resolved'?`<button onclick="A.cr(${c.id})">Resolve</button>`:E(c.n||'')]))}`,
aUsers:()=>`<div class=card><h2>👥 Users</h2><input id=us placeholder="Live search name / mobile" oninput="$('#ul').innerHTML=UL(this.value)"></div><div id=ul>${UL('')}</div>`,
aAudit:()=>`<h2>🕵️ Audit log</h2>${T(['Time','User','Action'],db.aud.slice().reverse().slice(0,150).map(a=>[D(a.at),U(a.u)?E(U(a.u).name):'—',E(a.a)]))}`,
aAnnounce:()=>`<div class=card><h2>📢 Announcement</h2>${F('ann',[['t','Message to all users']],'Broadcast')}</div>`};
P.mBank=P.cBank;
const NAV={customer:['Home','Send','CashOut','Pay','Bills','Bank','Save','History','KYC','Help','Alerts'],agent:['Home','CashIn','Float','Statement','History','Help','Alerts'],merchant:['Home','Invoices','Payments','Bank','History','Help','Alerts'],admin:['Home','Approvals','Float','Fees','History','Fraud','Complaints','Users','Audit','Announce']},PX={customer:'c',agent:'g',merchant:'m',admin:'a'};
const authView=()=>`<div class=card style="max-width:430px;margin:30px auto"><h2>💎 Money in the Vault</h2><nav><a class="${au=='Login'?'on':''}" onclick="au='Login';render()">Login</a><a class="${au=='Login'?'':'on'}" onclick="au='Register';render()">Register</a></nav>`+(au=='Login'?F('login',[['m','Mobile number'],['p','Password','password']],'Enter the Vault')+'<p><small>Demo logins: Admin 01700000000 / admin123 · Customer 01711111111 / 1234 · Agent 01733333333 / 1234 · Merchant 01744444444 / 1234 · PIN 12345 · OTP 1234</small></p>':F('reg',[['r','Account type','select','<option>customer</option><option>agent</option><option>merchant</option>'],['n','Full name'],['m','Mobile (01XXXXXXXXX)'],['e','Email','email'],['nid','NID number'],['s','Shop / business name (agent, merchant)','text','data-o'],['p','Password','password'],['pin','5-digit PIN','password','maxlength=5'],['otp','OTP (simulated: 1234)']],'Create account'))+'</div>';
function go(p){pg=p;render()}
function render(){
 $('#who').innerHTML=me?`${E(me.name)} · <i>${me.role}</i> <button onclick="A.out()">Logout</button>`:'';
 if(!me){$('#nav').innerHTML='';$('#app').innerHTML=authView();return}
 const ps=NAV[me.role];if(!ps.includes(pg))pg=ps[0];
 const un=db.notes.filter(n=>(!n.to||n.to==me.id)&&!n.read.includes(me.id)).length;
 $('#nav').innerHTML=ps.map(p=>`<a class="${p==pg?'on':''}" onclick="go('${p}')">${p=='Alerts'&&un?`Alerts (${un})`:p}</a>`).join('');
 $('#app').innerHTML=(P[PX[me.role]+pg]||P[pg])()}
/* ---------- Form handlers ---------- */
const H={
login:d=>{const u=byMob(d.m);if(!u||u.pw!==h(d.p))return bad('Wrong mobile or password');if(u.role!='customer'&&u.approved!==1)return bad(u.approved===0?'Awaiting admin approval':'Application rejected');sessionStorage.uid=u.id;me=u;pg='';log('login');save();render()},
reg:d=>{if(!/^01\d{9}$/.test(d.m))return bad('Mobile must be 11 digits starting with 01');if(!/^\d{5}$/.test(d.pin))return bad('PIN must be exactly 5 digits');if(d.p.length<4)return bad('Password too short');if(d.otp!='1234')return bad('Wrong OTP');if(byMob(d.m))return bad('Mobile already registered');const c=d.r=='customer';db.users.push({id:db.seq++,name:d.n,mobile:d.m,email:d.e,nid:d.nid,role:d.r,pw:h(d.p),pin:h(d.pin),bal:0,kyc:c?'not_submitted':'verified',fails:0,locked:0,active:1,approved:c?1:0,daily:c?50000:1e6,shop:d.s||d.n,low:5000,mdr:1.5,code:d.r=='merchant'?'M'+(1000+db.seq):''});save();toast(c?'Account created – please log in':'Submitted – wait for admin approval');au='Login';render()},
send:d=>{const r=byMob(d.to);if(!r||r==me||r.role!='customer')return bad('Receiver wallet not found');run('send_money',r,d)},
cout:d=>{const a=byMob(d.to);if(!a||a.role!='agent')return bad('Agent not found');run('cash_out',a,d)},
cin:d=>{const c=byMob(d.to);if(!c||c.role!='customer')return bad('Customer not found');run('cash_in',c,d)},
mpay:d=>{const m=db.users.find(u=>u.code==d.code.toUpperCase());if(!m)return bad('Merchant code not found');const iv=d.inv&&db.inv.find(i=>i.no==d.inv&&i.st=='pending'&&i.mob==me.mobile&&i.m==m.id);if(d.inv&&!iv)return bad('Invoice not found for this merchant');if(iv)d.amt=iv.amt;const t=run('merchant_payment',m,d,{mdr:m.mdr});if(t&&iv){iv.st='paid';iv.trx=t.id;save()}},
bill:d=>run('bill_payment',null,d,{note:db.billers[d.b]+' · '+d.ref}),
bank:d=>{if(!(+d.amt>0))return bad('Invalid amount');if(d.dir=='in'){if(!pinChk(me,d.pin))return;me.bal+=+d.amt;db.minted+=+d.amt;mk({type:'add_money',from:0,to:me.id,amt:+d.amt,note:d.bk});save();toast('✅ Money added');render()}else run('bank_transfer',null,d,{note:d.bk})},
save:d=>{const p=db.prods[d.p];if(+d.amt<p.min)return bad('Minimum deposit is '+M(p.min));if(run('savings',null,d,{note:p.n})){db.plans.push({id:db.seq++,u:me.id,p:+d.p,dep:+d.amt,mat:+(d.amt*(1+p.r/100*p.m/12)).toFixed(2),end:new Date(Date.now()+p.m*2592e6).toISOString().slice(0,10),st:'active'});save();render()}},
kyc:()=>{me.kyc='pending';log('kyc submitted');save();toast('KYC submitted for review');render()},
cmp:d=>{db.cmp.push({id:db.seq++,u:me.id,t:d.t,d:d.d,st:'open'});log('complaint '+d.t);save();toast('Complaint submitted');render()},
freq:d=>{db.freq.push({id:db.seq++,u:me.id,amt:+d.amt,st:'pending'});save();toast('Request sent');render()},
low:d=>{me.low=+d.v;save();toast('Threshold saved');render()},
inv:d=>{const n='INV'+db.seq;db.inv.push({id:db.seq++,no:n,m:me.id,mob:d.mob,amt:+d.amt,ds:d.ds,due:d.due,st:'pending'});const c=byMob(d.mob);if(c)note(c.id,`New invoice ${n} from ${me.shop}: ${M(d.amt)}`);save();toast('Invoice '+n+' created');render()},
ver:d=>{const t=db.tx.find(x=>x.id==d.t.trim().toUpperCase()&&x.to==me.id&&x.type=='merchant_payment');$('#vr').textContent=t?`✅ ${M(t.amt)} from ${mask(U(t.from).mobile)} · ${st(t)}`:'❌ No such payment'},
ann:d=>{note(0,d.t);log('announcement');save();toast('Broadcast sent');render()}};
document.addEventListener('submit',e=>{e.preventDefault();const f=H[e.target.id];f&&f(Object.fromEntries(new FormData(e.target)))});
/* ---------- Button actions ---------- */
const A={
out(){sessionStorage.clear();me=null;render()},
eye(){const b=$('#bal');b.dataset.h=b.dataset.h?'':1;b.textContent=b.dataset.h?'৳ ••••••':M(me.bal)},
look(i){setTimeout(()=>{const u=byMob(i.value);$('#nm').textContent=u?'👤 '+u.name+' ('+mask(u.mobile)+')':i.value.length>10?'❌ Not found':''},150)}, // simulated AJAX lookup
hf(){$('#hl').innerHTML=TX(mine().filter(t=>(!$('#ft').value||t.type==$('#ft').value)&&t.id.includes($('#fq').value.toUpperCase())))},
rd(i){db.notes[i].read.push(me.id);save();render()},
cl(id){const p=db.plans.find(x=>x.id==id);p.st='closed';me.bal+=p.dep;db.out-=p.dep;mk({type:'savings_close',from:0,to:me.id,amt:p.dep,note:'plan closed'});save();render()},
ci(id){db.inv.find(i=>i.id==id).st='cancelled';save();render()},
rc(id){const t=db.tx.find(x=>x.id==id),w=open('','r','width=380,height=480');w.document.write(`<pre style="font:14px monospace">💎 VAULTPAY RECEIPT\n------------------\n${t.id}\n${D(t.at)}\nType   : ${t.type}\nFrom   : ${U(t.from)?mask(U(t.from).mobile):'-'}\nTo     : ${U(t.to)?mask(U(t.to).mobile):'-'}\nAmount : ${M(t.amt)}\nFee    : ${M(t.fee)}\nStatus : ${st(t)}</pre><script>print()<\/script>`)},
rf(id){const t=db.tx.find(x=>x.id==id),pin=prompt('Enter your PIN to refund '+M(t.amt-t.mdr));if(pin&&pay('refund',me,U(t.from),t.amt-t.mdr,pin,{note:'Refund of '+id})){db.rev.push(id);log('refund '+id);save();render()}},
ap(id,ok){const u=U(id),r=ok?'':prompt('Reason for rejection?')||'n/a';if(u.role=='customer')u.kyc=ok?'verified':'rejected';else u.approved=ok?1:-1;note(u.id,ok?'Your account was approved ✅':'Rejected: '+r);log((ok?'approved ':'rejected ')+u.mobile);save();render()},
fa(id,ok){const r=db.freq.find(x=>x.id==id),a=U(r.u);r.st=ok?'approved':'rejected';if(ok){a.bal+=r.amt;db.minted+=r.amt;mk({type:'float_topup',from:0,to:a.id,amt:r.amt,note:'e-float top-up'})}log('float '+r.st+' '+r.id);save();render()},
fs(){Object.keys(db.fees).forEach(k=>['flat','pct','lim','comm'].forEach(f=>db.fees[k][f]=+$('#f_'+k+'_'+f).value));log('fee rules updated');save();toast('Fee rules saved')},
fr(id,a){const f=db.fraud.find(x=>x.id==id);f.st=a=='block'?'escalated':a;if(a=='block')U(f.u).active=0;log('fraud '+a+' '+id);save();render()},
cr(id){const c=db.cmp.find(x=>x.id==id);c.n=prompt('Resolution note?')||'Resolved';c.st='resolved';note(c.u,'Complaint '+id+' resolved');log('complaint resolved '+id);save();render()},
bl(id){const u=U(id);u.active=u.active?0:1;log('toggle wallet '+u.mobile);save();render()},
ul(id){const u=U(id);u.locked=0;u.fails=0;log('PIN unlocked '+u.mobile);save();toast('PIN unlocked')},
rv(id){const t=db.tx.find(x=>x.id==id),r=prompt('Reason for reversal?');if(!r)return;
 const ag=[U(t.to),U(t.from)].find(x=>x&&x.role=='agent'),dl={};const add=(u,v)=>dl[u.id]=(dl[u.id]||0)+v;
 if(U(t.from))add(U(t.from),t.amt+t.fee);if(U(t.to))add(U(t.to),-(t.amt-t.mdr));else db.out-=t.amt;if(t.cm)add(ag,-t.cm);
 if(Object.keys(dl).some(k=>U(k).bal+dl[k]<0))return bad('Cannot reverse – balance would go negative');
 Object.keys(dl).forEach(k=>U(k).bal=+(U(k).bal+dl[k]).toFixed(2));db.pool=+(db.pool-t.fee-t.mdr+t.cm).toFixed(2);
 mk({type:'reversal',from:t.to,to:t.from,amt:t.amt,note:r+' (ref '+t.id+')'});db.rev.push(id);log('reversed '+id+': '+r);save();render()},
rec(){const s=db.users.reduce((a,u)=>a+u.bal,0)+db.pool+db.out,ok=Math.abs(s-db.minted)<.01;log('reconciliation');save();toast(ok?`✅ Balanced: wallets + fees + settled = ${M(db.minted)}`:`❌ Mismatch ${M(s-db.minted)}`,!ok)}};
/* ---------- Theme, flying money, polling ---------- */
const th=t=>{document.documentElement.dataset.theme=t;localStorage.vtheme=t;$('#th').textContent=t=='dark'?'☀️':'🌙'};
$('#th').onclick=()=>th(document.documentElement.dataset.theme=='dark'?'light':'dark');th(localStorage.vtheme||'dark');
$('#fx').innerHTML=Array.from({length:26},(_,i)=>`<span style="left:${Math.random()*100}%;font-size:${18+Math.random()*26}px;animation-duration:${9+Math.random()*12}s;animation-delay:-${Math.random()*20}s">${['💵','💎','🪙','💰','💸'][i%5]}</span>`).join('');
setInterval(()=>{if(me&&me.role=='merchant'&&pg=='Invoices'&&$('#il')){db=JSON.parse(localStorage[K]);me=U(me.id);$('#il').innerHTML=invT()}},3000); // AJAX-style polling: paid invoices appear without reload
render();
