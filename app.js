import { firebaseConfig } from './firebase-config.js';
const $=id=>document.getElementById(id);
const stages=[['call','Por llamar','#94a3b8'],['quote','Cotizando','#f0ad38'],['meeting','Reunión agendada','#00a7bb'],['close','Por cerrar','#10b981']];
const configured=Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.appId);
const productsByLine={
  Automotor:['Autotal 100/500','Vagoneta Segura','Autotal V1','Autotal Eléctrico','Automotor Pesado','Vital'],
  Generales:['Casa Protegida','Responsabilidad civil','Transporte','Todo Riesgo','Otros'],
  Salud:['IFS','SFX','2da. Red','Otros'],
  Vida:['Vida jubilación','Vida Flexible']
};
// Los registros de la versión anterior guardaban el ramo en «product».
const legacyLine=r=>r.productLine || ({Hogar:'Generales',Otros:'Generales'}[r.product] || (productsByLine[r.product]?r.product:''));
function updateProductOptions(line,selected=''){
  const el=$('productSelect');el.replaceChildren();
  el.add(new Option(line?'Seleccione un producto':'Seleccione una línea primero',''));
  for(const value of productsByLine[line]||[])el.add(new Option(value,value));
  el.disabled=!productsByLine[line];
  if((productsByLine[line]||[]).includes(selected))el.value=selected;
}
$('productLine').addEventListener('change',e=>updateProductOptions(e.target.value));
const storageKey='crm-seguros-demo-v1';
let records=[], selectedId=null, editingId=null, closedView=false, activeTab='board', user=null, auth=null, db=null, fb=null;
let holdTimer=null, dragState=null, suppressCardClick=false;
const dt=v=>v?new Date(v).toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'}):'Sin programar';
const localDateKey=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const today=()=>localDateKey(new Date());
const toLocalDateTimeValue=v=>{const d=v?new Date(v):new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const money=v=>Number(v||0).toLocaleString('es-BO',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stageName=s=>[...stages,['won','Cerrado ganado'],['lost','Cerrado perdido']].find(x=>x[0]===s)?.[1]||s;
// Un prospecto vence al terminar su día de creación si no tiene ninguna gestión registrada ese mismo día.
const isDue=r=>{if(!r.createdAt||['won','lost'].includes(r.stage))return false;const createdDay=localDateKey(r.createdAt);if(!createdDay||today()<=createdDay)return false;return !(r.activities||[]).some(a=>a.at&&localDateKey(a.at)===createdDay)};
const isContactExpired=r=>Boolean(r.nextContact&&new Date(r.nextContact).getTime()<Date.now());
const notify=s=>{$('toast').textContent=s;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3000)};
const getRecord=id=>records.find(r=>r.id===id);
async function init(){
  if(!configured){records=JSON.parse(localStorage.getItem(storageKey)||'[]');$('modeLabel').textContent='Modo demostración';render();return;}
  try{
    const [app,authMod,store]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
    const firebaseApp=app.initializeApp(firebaseConfig);auth=authMod.getAuth(firebaseApp);db=store.getFirestore(firebaseApp);fb={...authMod,...store};
    $('connection').textContent='Firebase';$('modeLabel').textContent='Cuenta individual';
    fb.onAuthStateChanged(auth,async u=>{user=u;$('loginPanel').hidden=!!u;$('workspace').hidden=!u;$('logoutBtn').hidden=!u;$('newBtn').hidden=!u;if(u){await reload()}else{records=[];render()}});
  }catch(e){$('loginPanel').hidden=false;$('workspace').hidden=true;$('loginError').textContent='No se pudo inicializar Firebase. Revisa la configuración y conexión. '+e.message;}
}
async function reload(){const q=fb.query(fb.collection(db,'prospects'),fb.where('ownerUid','==',user.uid));const snap=await fb.getDocs(q);records=snap.docs.map(d=>({id:d.id,...d.data()}));render()}
async function persist(rec){
  if(!configured){if(rec.id){records=records.map(x=>x.id===rec.id?rec:x)}else{rec.id=crypto.randomUUID();records.unshift(rec)}localStorage.setItem(storageKey,JSON.stringify(records));render();return;}
  if(!user)throw Error('Debes iniciar sesión');
  if(rec.id){const {id,...data}=rec;await fb.updateDoc(fb.doc(db,'prospects',id),data)}else{const {id,...data}=rec;await fb.addDoc(fb.collection(db,'prospects'),{...data,ownerUid:user.uid})}
  await reload();
}
function render(){
 const q=$('search').value.toLocaleLowerCase(),product=$('productFilter').value;
 const filtered=records.filter(r=>(!product||legacyLine(r)===product)&&[r.name,r.phone,legacyLine(r),r.product,r.asset].some(v=>String(v||'').toLocaleLowerCase().includes(q)));
 const active=records.filter(r=>!['won','lost'].includes(r.stage));$('statActive').textContent=active.length;$('statDue').textContent=active.filter(isDue).length;$('statWon').textContent=records.filter(r=>r.stage==='won').length;$('statPremium').textContent=money(active.reduce((s,r)=>s+Number(r.premium||0),0));
 $('board').innerHTML=stages.map(([key,name,color])=>{const arr=filtered.filter(r=>r.stage===key).sort((a,b)=>Number(isDue(b))-Number(isDue(a))||(b.createdAt||'').localeCompare(a.createdAt||''));return `<div class="lane" data-stage="${key}"><div class="lane-head"><span>${name}</span><span class="lane-count">${arr.length}</span></div><div class="lane-line" style="background:${color}"></div><div class="lane-cards">${arr.map(card).join('')||'<div class="empty">Sin prospectos en esta etapa</div>'}</div></div>`}).join('');
 $('agenda').innerHTML='<h3>Próximos contactos</h3>'+filtered.filter(r=>r.nextContact&&!['won','lost'].includes(r.stage)).sort((a,b)=>a.nextContact.localeCompare(b.nextContact)).map(r=>`<div class="agenda-item"><div><b>${esc(r.name)}</b><p>${esc(stageName(r.stage))} · <span class="${isDue(r)?'due':''}">${esc(dt(r.nextContact))}</span> · ${esc(r.phone)}</p></div><button data-open="${esc(r.id)}">Abrir ficha</button></div>`).join('');
 if(!$('agenda').querySelector('.agenda-item'))$('agenda').innerHTML+='<p class="muted">Aún no hay contactos programados.</p>';
 $('closed').innerHTML='<h3>Prospectos cerrados</h3>'+filtered.filter(r=>['won','lost'].includes(r.stage)).map(r=>`<div class="agenda-item"><div><b>${esc(r.name)}</b><p>${esc(stageName(r.stage))} · ${esc([legacyLine(r),r.product].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Sin producto')} · Bs ${money(r.premium)}</p></div><button data-open="${esc(r.id)}">Abrir ficha</button></div>`).join('');
 if(!$('closed').querySelector('.agenda-item'))$('closed').innerHTML+='<p class="muted">Sin registros cerrados.</p>';
 applyView();
}
function card(r){const initials=r.name.trim().split(/\\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(),expired=isDue(r),contactExpired=isContactExpired(r),contactClass=r.nextContact?(contactExpired?'contact-expired':'contact-valid'):'contact-undefined',contactText=r.nextContact?dt(r.nextContact):'Sin fecha definida';return `<article class="prospect ${expired?'overdue-card':''}" tabindex="0" role="button" data-open="${esc(r.id)}"><div class="card-top"><span class="pill">${esc([legacyLine(r),r.product].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Sin producto')}</span><span>⋮</span></div>${expired?'<div class="overdue-label">⚠ SIN GESTIÓN · VENCIDO</div>':''}<div class="person"><span class="avatar">${esc(initials)}</span><div><b>${esc(r.name)}</b><small>${esc(r.phone)}</small></div></div><div class="card-details"><div><small>Materia asegurada</small><b title="${esc(r.asset||'Sin definir')}">${esc(r.asset||'Sin definir')}</b></div><div><small>Prima estimada</small><b>Bs ${money(r.premium)}</b></div></div><div class="card-foot"><div class="card-dates"><span>◷ Creado: ${esc(dt(r.createdAt))}</span><span class="${contactClass}">◷ Vencimiento: ${esc(contactText)}</span></div><span>☰ ${(r.activities||[]).length}</span></div></article>`}
function applyView(){const v=closedView?'closed':activeTab;$('board').hidden=v!=='board';$('agenda').hidden=v!=='agenda';$('closed').hidden=v!=='closed';$('pageTitle').textContent=v==='board'?'Mi cartera de prospectos':v==='agenda'?'Agenda de seguimiento':'Oportunidades cerradas';$('navBoard').classList.toggle('active',v==='board');$('navAgenda').classList.toggle('active',v==='agenda');$('showClosed').textContent=closedView?'Volver al tablero':'Ver cerrados'}
function openForm(r=null){editingId=r?.id||null;$('formHeading').textContent=r?'Editar prospecto':'Nuevo prospecto';$('prospectForm').reset();$('saveError').textContent='';$('productLine').value=r?legacyLine(r):'';updateProductOptions($('productLine').value,r?.product||'');$('createdAtDisplay').value=toLocalDateTimeValue(r?.createdAt||new Date().toISOString());if(r){for(const [k,v] of Object.entries(r)){if(k==='product'||k==='productLine'||k==='stage'||k==='createdAt'||k==='nextContact')continue;const field=$('prospectForm').elements.namedItem(k);if(field&&typeof v!=='object')field.value=v??''}}$('prospectDialog').showModal()}
function openDetail(id){const r=getRecord(id);if(!r)return;selectedId=id;$('detailName').textContent=r.name;$('detailSubtitle').textContent=([legacyLine(r),r.product].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' / ')||'Producto por definir')+' · '+stageName(r.stage);$('detailContent').innerHTML=`<div class="detail-grid"><div><small>Celular</small><b>${esc(r.phone)}</b></div><div><small>Materia asegurada</small><b>${esc(r.asset||'Sin definir')}</b></div><div><small>Prima estimada</small><b>Bs ${money(r.premium)}</b></div><div><small>Primer contacto</small><b class="${isDue(r)?'due':''}">${isDue(r)?'VENCIDO: sin gestión el día de creación':(r.activities||[]).some(a=>a.at&&localDateKey(a.at)===localDateKey(r.createdAt))?'Gestionado el día de creación':'Pendiente de gestión'}</b></div><div><small>Origen</small><b>${esc(r.source)}</b></div><div><small>Fecha de registro</small><b>${esc(dt(r.createdAt))}</b></div></div><div class="detail-actions"><a href="tel:${encodeURIComponent(r.phone)}">☎ Llamar</a><a target="_blank" rel="noopener noreferrer" href="https://wa.me/${r.phone.replace(/\D/g,'')}">WhatsApp ↗</a></div><p>${esc(r.notes||'Sin observaciones')}</p><label>Cambiar etapa<select id="quickStage">${[...stages,['won','Cerrado ganado'],['lost','Cerrado perdido']].map(([k,n])=>`<option value="${k}" ${r.stage===k?'selected':''}>${n}</option>`).join('')}</select></label>`;
 $('historyList').innerHTML=(r.activities||[]).slice().reverse().map(a=>`<div class="history-item"><b>${esc(a.type)}</b><small>${esc(dt(a.at))}</small><p>${esc(a.detail)}</p></div>`).join('')||'<p class="muted">Todavía no se registraron gestiones.</p>';
 $('activityForm').reset();$('detailDialog').showModal();}
$('prospectForm').addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const now=new Date().toISOString();const old=editingId?getRecord(editingId):null;const rec={...(old||{}),name:String(form.get('name')).trim(),phone:String(form.get('phone')).trim(),productLine:form.get('productLine'),product:form.get('product'),stage:old?.stage||'call',asset:String(form.get('asset')).trim(),premium:Number(form.get('premium')||0),nextContact:old?.nextContact||'',source:form.get('source'),notes:String(form.get('notes')).trim(),createdAt:old?.createdAt||now,updatedAt:now,activities:old?.activities||[]};if(!rec.name||!rec.phone)return;$('saveBtn').disabled=true;try{await persist(rec);$('prospectDialog').close();notify('Prospecto guardado correctamente')}catch(err){$('saveError').textContent='No se pudo guardar: '+err.message}finally{$('saveBtn').disabled=false}});
$('activityForm').addEventListener('submit',async e=>{e.preventDefault();const r=getRecord(selectedId);if(!r)return;const data=new FormData(e.currentTarget),note=String(data.get('detail')).trim();if(!note)return;const nextContact=data.get('nextContact')||r.nextContact;const updated={...r,nextContact,updatedAt:new Date().toISOString(),activities:[...(r.activities||[]),{type:data.get('type'),detail:note,at:new Date().toISOString()}]};try{await persist(updated);$('detailDialog').close();openDetail(r.id);notify('Gestión registrada')}catch(err){notify('Error: '+err.message)}});
$('detailContent').addEventListener('change',async e=>{if(e.target.id!=='quickStage')return;const r=getRecord(selectedId),value=e.target.value;try{await persist({...r,stage:value,updatedAt:new Date().toISOString()});$('detailDialog').close();openDetail(r.id);notify('Etapa actualizada')}catch(err){notify('Error: '+err.message)}});
$('editBtn').onclick=()=>{const r=getRecord(selectedId);$('detailDialog').close();openForm(r)};
$('newBtn').onclick=()=>openForm();$('navBoard').onclick=()=>{closedView=false;activeTab='board';applyView()};$('navAgenda').onclick=()=>{closedView=false;activeTab='agenda';applyView()};$('showClosed').onclick=()=>{closedView=!closedView;applyView()};$('search').oninput=render;$('productFilter').onchange=render;
document.addEventListener('click',e=>{if(suppressCardClick){e.preventDefault();return}const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return}const target=e.target.closest('[data-open]');if(target)openDetail(target.dataset.open)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-open]'))openDetail(e.target.dataset.open)});
// Mover fichas con clic/toque sostenido: mantener 450 ms y soltar sobre otra etapa.
function clearHold(){if(holdTimer){clearTimeout(holdTimer);holdTimer=null}}
function finishCardMove(){
  if(!dragState)return;
  const {id,card:el}=dragState;
  const point=document.elementFromPoint(dragState.x,dragState.y);
  const lane=point?.closest('.lane[data-stage]');
  const destination=lane?.dataset.stage;
  const source=getRecord(id);
  el?.classList.remove('is-dragging');
  document.querySelectorAll('.lane.drop-target').forEach(x=>x.classList.remove('drop-target'));
  dragState=null;
  if(destination&&source&&destination!==source.stage){
    persist({...source,stage:destination,updatedAt:new Date().toISOString()})
      .then(()=>notify(`Prospecto movido a ${stageName(destination)}`))
      .catch(err=>notify('No se pudo mover: '+err.message));
  }
}
document.addEventListener('pointerdown',e=>{
  const cardEl=e.target.closest('.prospect[data-open]');
  if(!cardEl||e.button!==0)return;
  clearHold();
  const startX=e.clientX,startY=e.clientY,id=cardEl.dataset.open;
  holdTimer=setTimeout(()=>{
    holdTimer=null;
    dragState={id,card:cardEl,x:startX,y:startY,pointerId:e.pointerId};
    cardEl.classList.add('is-dragging');
  },450);
  cardEl.dataset.holdX=String(startX);cardEl.dataset.holdY=String(startY);
});
document.addEventListener('pointermove',e=>{
  if(dragState){
    dragState.x=e.clientX;dragState.y=e.clientY;
    const lane=document.elementFromPoint(e.clientX,e.clientY)?.closest('.lane[data-stage]');
    document.querySelectorAll('.lane.drop-target').forEach(x=>x.classList.remove('drop-target'));
    if(lane)lane.classList.add('drop-target');
    e.preventDefault();return;
  }
  if(holdTimer){
    const cardEl=e.target.closest('.prospect[data-open]');
    if(cardEl){
      const dx=e.clientX-Number(cardEl.dataset.holdX||e.clientX),dy=e.clientY-Number(cardEl.dataset.holdY||e.clientY);
      if(Math.hypot(dx,dy)>12)clearHold();
    }
  }
});
document.addEventListener('pointerup',()=>{
  if(holdTimer){clearHold();return}
  if(dragState){suppressCardClick=true;finishCardMove();setTimeout(()=>{suppressCardClick=false},250)}
});
document.addEventListener('pointercancel',()=>{clearHold();if(dragState){dragState.card?.classList.remove('is-dragging');dragState=null;document.querySelectorAll('.lane.drop-target').forEach(x=>x.classList.remove('drop-target'))}});

$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';try{await fb.signInWithEmailAndPassword(auth,$('email').value,$('password').value)}catch(error){$('loginError').textContent='No fue posible iniciar sesión. Verifica el correo y la contraseña.'}});
$('logoutBtn').onclick=()=>fb.signOut(auth);
init();


// Menú lateral expandible/minimizable. La preferencia se conserva en este navegador.
const sidebarToggle=$('sidebarToggle');
const sidebarPref=localStorage.getItem('crmSidebarCollapsed')==='true';
document.body.classList.toggle('sidebar-collapsed',sidebarPref);
function updateSidebarButton(){
  if(!sidebarToggle)return;
  const collapsed=document.body.classList.contains('sidebar-collapsed');
  sidebarToggle.textContent=collapsed?'›':'‹';
  sidebarToggle.title=collapsed?'Expandir menú':'Minimizar menú';
  sidebarToggle.setAttribute('aria-label',sidebarToggle.title);
}
updateSidebarButton();
sidebarToggle?.addEventListener('click',()=>{
  const collapsed=document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('crmSidebarCollapsed',String(collapsed));
  updateSidebarButton();
});
