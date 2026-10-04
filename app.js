const P=window.PLACES,G=window.GASTRO,W=window.PLANS,E=window.EVENTS;
const pMap=Object.fromEntries(P.map(x=>[x.id,x])),gMap=Object.fromEntries(G.map(x=>[x.id,x]));
let state={view:'home',area:'All',tag:'All',foodType:'All',foodArea:'All',foodExtras:new Set(),eventTag:'All',activeDetail:null,returnTarget:null,map:null};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const areaCoords={
'Antibes':[43.5804,7.1251],'Nice':[43.7102,7.2620],'Biot / Sophia':[43.6286,7.0954],'Saint-Paul / Vence':[43.704,7.118],
'Mouans-Sartoux / Grasse':[43.64,6.95],'Cannes / Le Cannet':[43.565,7.00],'Cap Ferrat / Corniches':[43.697,7.335],'Èze / Menton':[43.75,7.43],'Monaco':[43.7384,7.4246],'Peyrassol':[43.39,6.22]
};
const tierLabel={key:'KEY STOP',strong:'WORTH A LOOK',optional:'OPTIONAL'};
const outdoorLabel={destination:'Outdoor ★★★',pleasant:'Outdoor ★★',basic:'Outdoor ★',unknown:'Outdoor ?'};
function showView(v,push=true){state.view=v;$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));if(v==='detail')$$('.nav').forEach(x=>x.classList.remove('active'));window.scrollTo({top:0,behavior:'instant'});if(v==='mapview')setTimeout(initMap,60);if(push)history.pushState({view:v},'', '#'+v)}
document.addEventListener('click',e=>{const v=e.target.closest('[data-view]');if(v){if(v.dataset.foodFilter){state.foodType='All';state.foodArea='All';state.foodExtras.clear();if(v.dataset.foodFilter==='Coffee')state.foodType='Coffee';else if(v.dataset.foodFilter==='Aperitif')state.foodExtras.add('Aperitif');renderFoodControls();renderFood()}showView(v.dataset.view);return}const pp=e.target.closest('[data-open-place]');if(pp){openPlace(pp.dataset.openPlace);return}const ff=e.target.closest('[data-open-food]');if(ff){openFood(ff.dataset.openFood);return}const ww=e.target.closest('[data-open-plan]');if(ww){openPlan(ww.dataset.openPlan);return}});
$('#detailBack').onclick=()=>{const t=state.returnTarget;if(t?.type==='plan'){openPlan(t.id,false);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:t.scrollY||0,behavior:'instant'})));return}showView(t?.view||'home')};
window.addEventListener('popstate',()=>showView(location.hash.replace('#','')||'home',false));
function setReturn(defaultView){if(state.view==='detail'&&state.activeDetail?.type==='plan'){state.returnTarget={type:'plan',id:state.activeDetail.id,scrollY:window.scrollY}}else state.returnTarget={type:'view',view:state.view==='detail'?defaultView:state.view}}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let detailPlanMap=null;
function routeMode(plan){return plan.mode==='walking'?'walking':plan.mode==='transit'?'transit':'driving'}
function googleDirectionsUrl({origin='',destination='',waypoints=[],mode='driving'}){
  const params=[`api=1`];
  if(origin)params.push(`origin=${encodeURIComponent(origin)}`);
  if(destination)params.push(`destination=${encodeURIComponent(destination)}`);
  if(waypoints?.length)params.push(`waypoints=${encodeURIComponent(waypoints.join('|'))}`);
  if(mode)params.push(`travelmode=${encodeURIComponent(mode)}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}
function directions(address,mode='driving'){return googleDirectionsUrl({destination:address,mode})}
function mapLinkAttrs(){return isIOS?'':'target="_blank" rel="noopener"'}
function stopAddress(stop){return stop.place?pMap[stop.place]?.address:stop.food?gMap[stop.food]?.address:stop.address||''}
function routeCandidates(plan,{includeOptional=false}={}){
  const seen=new Set();
  return plan.stops.map((stop,idx)=>({stop,idx,address:stopAddress(stop)}))
    .filter(x=>x.address && (includeOptional || !x.stop.optional))
    .filter(x=>{const key=x.address.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true;})
    .map(x=>({index:x.idx,address:x.address,title:stopData(x.stop)?.title||`Stop ${x.idx+1}`,optional:!!x.stop.optional}));
}
function compressRoutePoints(points,maxPoints=5){
  if(points.length<=maxPoints)return points;
  if(maxPoints<=2)return [points[0],points[points.length-1]];
  const res=[points[0]];
  const interior=points.slice(1,-1);
  const slots=maxPoints-2;
  for(let i=0;i<slots;i++){
    const idx=Math.round((i+1)*(interior.length+1)/(slots+1))-1;
    const pick=interior[Math.max(0,Math.min(interior.length-1,idx))];
    if(pick && !res.includes(pick))res.push(pick);
  }
  res.push(points[points.length-1]);
  return res;
}
function planOverviewPoints(plan){
  return plan.stops.map((stop,idx)=>({
    index:idx,
    address:stopAddress(stop),
    title:stopData(stop)?.title||`Stop ${idx+1}`,
    optional:!!stop.optional,
    type:stopData(stop)?.type||'note'
  })).filter(x=>x.address);
}
function planCoreRoutePoints(plan){
  let points=routeCandidates(plan,{includeOptional:false});
  if(points.length<2)points=routeCandidates(plan,{includeOptional:true});
  return points;
}
function planDirections(plan){
  const mode=routeMode(plan);
  const points=compressRoutePoints(planCoreRoutePoints(plan),5);
  if(points.length<2)return points[0]?directions(points[0].address,mode):'#';
  return googleDirectionsUrl({origin:points[0].address,destination:points[points.length-1].address,waypoints:points.slice(1,-1).map(x=>x.address),mode});
}
let geocodeLastRequest=0;
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function geocodeFetch(query){
  const wait=Math.max(0,1050-(Date.now()-geocodeLastRequest));
  if(wait)await sleep(wait);
  geocodeLastRequest=Date.now();
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q=${encodeURIComponent(query)}`;
  const res=await fetch(url,{headers:{'Accept-Language':'en'}});
  if(!res.ok)return null;
  const json=await res.json();
  if(!json?.[0])return null;
  return [parseFloat(json[0].lat),parseFloat(json[0].lon)];
}
async function geocodeAddress(address,title=''){
  const key=`antibes-geocode-v2-${address}`;
  try{const cached=localStorage.getItem(key);if(cached)return JSON.parse(cached)}catch(e){}
  try{
    let coords=await geocodeFetch(address);
    if(!coords && title)coords=await geocodeFetch(`${title}, Côte d'Azur, France`);
    if(!coords)return null;
    try{localStorage.setItem(key,JSON.stringify(coords))}catch(e){}
    return coords;
  }catch(err){return null}
}
function markerGroupKey(point){return point.address.trim().toLowerCase()}
async function renderPlanOverviewMap(plan){
  const el=$('#planOverviewMap');
  if(!el||typeof L==='undefined')return;
  if(detailPlanMap){detailPlanMap.remove();detailPlanMap=null}
  el.innerHTML='<div class="plan-map-loading">Loading map overview…</div>';
  const points=planOverviewPoints(plan);
  const coords=[];
  for(const point of points){
    const latlng=await geocodeAddress(point.address,point.title);
    if(latlng)coords.push({...point,latlng});
  }
  if(coords.length===0){el.innerHTML='<div class="plan-map-fallback">Map preview unavailable for this plan.</div>';return}
  el.innerHTML='';
  detailPlanMap=L.map(el,{zoomControl:true,dragging:true,scrollWheelZoom:false,doubleClickZoom:true,boxZoom:false,keyboard:false,tap:true,touchZoom:true,attributionControl:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(detailPlanMap);
  const grouped=[];
  const byAddress=new Map();
  coords.forEach(point=>{
    const key=markerGroupKey(point);
    if(!byAddress.has(key)){const group={...point,points:[point]};byAddress.set(key,group);grouped.push(group)}
    else byAddress.get(key).points.push(point);
  });
  grouped.forEach(group=>{
    const nums=group.points.map(p=>p.index+1).join('/');
    const allOptional=group.points.every(p=>p.optional);
    const titles=group.points.map(p=>`${p.index+1}. ${p.title}${p.optional?' (optional)':''}`).join('<br>');
    const icon=L.divIcon({className:'',html:`<div class="plan-marker ${allOptional?'optional':''}">${nums}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
    L.marker(group.latlng,{icon}).addTo(detailPlanMap).bindTooltip(titles,{permanent:false,direction:'top'});
  });
  const latlngs=coords.map(c=>c.latlng);
  if(latlngs.length>1){
    L.polyline(latlngs,{color:'#1f5f8b',weight:4,opacity:.68,dashArray:'8 7'}).addTo(detailPlanMap);
    detailPlanMap.fitBounds(L.latLngBounds(latlngs).pad(.10),{maxZoom:16});
  }else detailPlanMap.setView(latlngs[0],13);
  const missing=points.length-coords.length;
  if(missing>0){
    const note=document.createElement('div');
    note.className='plan-map-missing';
    note.textContent=`${missing} stop${missing===1?'':'s'} could not be placed on the overview map.`;
    el.parentElement.appendChild(note);
  }
  setTimeout(()=>detailPlanMap.invalidateSize(),0);
}
function statusKey(type,id){return `antibes-status-${type}-${id}`}
function getStatus(type,id){return localStorage.getItem(statusKey(type,id))||'want'}
function statusHTML(type,id){const cur=getStatus(type,id);return `<div class="status-row">${[['want','Want to go'],['maybe','Maybe'],['been','Been']].map(([v,l])=>`<button class="status-btn ${cur===v?'active':''}" data-status-type="${type}" data-status-id="${id}" data-status="${v}">${l}</button>`).join('')}</div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-status]');if(!b)return;localStorage.setItem(statusKey(b.dataset.statusType,b.dataset.statusId),b.dataset.status);b.parentElement.querySelectorAll('.status-btn').forEach(x=>x.classList.toggle('active',x===b))});
function fmtEventDate(x){const d=new Date(x.date+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});if(x.endDate){const e=new Date(x.endDate+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});return d+'–'+e}return d}
function renderHome(){const sensitive=P.filter(x=>['until','from','limited'].includes(x.availability?.status));$('#sensitiveCount').textContent=`${sensitive.length} ITEMS`;$('#sensitiveList').innerHTML=sensitive.map(x=>`<button class="mini-card sensitive-card" data-open-place="${x.id}"><div class="mini-copy"><small class="mini-kicker">${x.area} · ${x.type}</small><b>${x.title}</b><p>${x.availability?.note||''}</p></div><span class="mini-badge">${x.availability.label}</span></button>`).join('');const events=[...E].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);$('#eventList').innerHTML=events.map(x=>`<a class="mini-card event-mini-card" href="${x.url}" target="_blank" rel="noopener"><div class="mini-copy"><small class="mini-kicker">${fmtEventDate(x)}${x.time?` · ${x.time}`:''}</small><b>${x.title}</b><p>${x.area} · ${x.type}</p></div><span class="mini-link">↗</span></a>`).join('')}
function areaGroup(area){if(area==='Antibes')return 'Antibes';if(area==='Nice')return 'Nice';return 'Around'}
function areaMatches(area,selected){return selected==='All'||areaGroup(area)===selected}
function renderExploreControls(){const areas=['All','Antibes','Nice','Around'];$('#areaChips').innerHTML=areas.map(a=>`<button class="chip ${state.area===a?'active':''}" data-area="${a}">${a==='All'?'All areas':a}</button>`).join('');$('#areaChips').querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{state.area=b.dataset.area;renderExploreControls();renderExplore()});const tags=['All','Art','Architecture','Garden','Walk','Town','Market','Neighborhood','Innovation','Workation'];$('#tagChips').innerHTML=tags.map(t=>`<button class="chip ${state.tag===t?'active':''}" data-tag="${t}">${t}</button>`).join('');$('#tagChips').querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{state.tag=b.dataset.tag;renderExploreControls();renderExplore()})}
function renderExplore(){const q=$('#exploreSearch').value.trim().toLowerCase();let arr=P.filter(x=>areaMatches(x.area,state.area)&&(state.tag==='All'||x.tags.includes(state.tag)||x.type===state.tag));if(q)arr=arr.filter(x=>(x.title+' '+x.area+' '+x.short+' '+x.take+' '+x.tags.join(' ')).toLowerCase().includes(q));$('#exploreCount').textContent=String(arr.length).padStart(2,'0');$('#exploreGrid').innerHTML=arr.map(x=>`<button class="place-card explore-card" data-open-place="${x.id}"><span class="tier ${x.tier}">${tierLabel[x.tier]}</span><span class="avail">${x.availability?.label||'November ✓'}</span><span class="corner">→</span><h2>${x.title}</h2><p class="short">${x.short}</p><p class="why"><b>Warum interessant:</b> ${x.take}</p><div class="tags"><span class="tag">${x.area}</span>${x.tags.slice(0,4).map(t=>`<span class="tag">${t}</span>`).join('')}</div></button>`).join('')}
$('#exploreSearch').oninput=renderExplore;
function foodTypeMatches(x,type){if(type==='All')return true;if(type==='Coffee')return x.tags.includes('Coffee')||x.kind==='cafe';if(type==='Wine')return x.kind==='wine'||x.tags.includes('Wine');if(type==='Restaurant')return x.kind==='restaurant';return true}
function foodExtraMatches(x,extra){if(extra==='Outdoor')return ['destination','pleasant'].includes(x.outdoor);if(extra==='Rooftop')return x.kind==='rooftop'||x.tags.includes('Rooftop');if(extra==='Aperitif')return x.tags.includes('Aperitif')||x.kind==='rooftop';return true}
function renderFoodControls(){const types=['All','Coffee','Wine','Restaurant'];$('#foodTypeChips').innerHTML=types.map(t=>`<button class="chip ${state.foodType===t?'active':''}" data-food-type="${t}">${t}</button>`).join('');$('#foodTypeChips').querySelectorAll('[data-food-type]').forEach(b=>b.onclick=()=>{state.foodType=b.dataset.foodType;renderFoodControls();renderFood()});const extras=['Outdoor','Rooftop','Aperitif'];$('#foodExtraChips').innerHTML=extras.map(t=>`<button class="chip toggle ${state.foodExtras.has(t)?'active':''}" data-food-extra="${t}">${t}</button>`).join('');$('#foodExtraChips').querySelectorAll('[data-food-extra]').forEach(b=>b.onclick=()=>{const t=b.dataset.foodExtra;state.foodExtras.has(t)?state.foodExtras.delete(t):state.foodExtras.add(t);renderFoodControls();renderFood()});const areas=['All','Antibes','Nice','Around'];$('#foodAreaChips').innerHTML=areas.map(a=>`<button class="chip ${state.foodArea===a?'active':''}" data-food-area="${a}">${a==='All'?'All areas':a}</button>`).join('');$('#foodAreaChips').querySelectorAll('[data-food-area]').forEach(b=>b.onclick=()=>{state.foodArea=b.dataset.foodArea;renderFoodControls();renderFood()})}
function renderFood(){const q=$('#foodSearch').value.trim().toLowerCase();let arr=G.filter(x=>foodTypeMatches(x,state.foodType)&&areaMatches(x.area,state.foodArea)&&[...state.foodExtras].every(extra=>foodExtraMatches(x,extra)));if(q)arr=arr.filter(x=>(x.title+' '+x.area+' '+x.best+' '+x.take+' '+x.tags.join(' ')).toLowerCase().includes(q));$('#foodCount').textContent=String(arr.length).padStart(2,'0');$('#foodGrid').innerHTML=arr.map(x=>`<button class="food-card" data-open-food="${x.id}"><span class="avail">NOVEMBER ✓</span><span class="corner">→</span><h2>${x.title}</h2><div class="bestfor">${x.best}</div><p class="short">${x.take}</p><div class="tags"><span class="tag">${x.area}</span>${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="outdoor">${outdoorLabel[x.outdoor]||''}</div></button>`).join('')}
$('#foodSearch').oninput=renderFood;

function renderEventControls(){const tags=['All','Photography','Art / Digital','Architecture','Innovation','Community','Music'];$('#eventChips').innerHTML=tags.map(t=>`<button class="chip ${state.eventTag===t?'active':''}" data-event-tag="${t}">${t}</button>`).join('');$('#eventChips').querySelectorAll('[data-event-tag]').forEach(b=>b.onclick=()=>{state.eventTag=b.dataset.eventTag;renderEventControls();renderEvents()})}
function renderEvents(){let arr=[...E].sort((a,b)=>a.date.localeCompare(b.date));if(state.eventTag!=='All')arr=arr.filter(x=>x.type===state.eventTag);$('#eventCount').textContent=String(arr.length).padStart(2,'0');$('#eventGrid').innerHTML=arr.map(x=>`<article class="event-card"><div class="event-top"><span class="event-date">${fmtEventDate(x)}${x.time?` · ${x.time}`:''}</span>${x.free?`<span class="event-free">KOSTENLOS</span>`:''}</div><p class="eyebrow">${x.area} · ${x.type}</p><h2>${x.title}</h2><p class="short">${x.note}</p><div class="event-booking">${x.booking||''}</div><a class="event-link" href="${x.url}" target="_blank" rel="noopener">Official info ↗</a></article>`).join('')}

function renderPlans(){$('#planCount').textContent=String(W.length).padStart(2,'0');$('#planGrid').innerHTML=W.map((x,i)=>`<button class="plan-card ${x.mood}" data-open-plan="${x.id}"><span class="plan-num">${String(i+1).padStart(2,'0')}</span><p class="eyebrow">PLAN ${String(i+1).padStart(2,'0')}</p><h2>${x.title}</h2><p class="short">${x.subtitle}</p>${x.timing?`<div class="plan-alert"><b>Plan around:</b> ${x.timing}</div>`:''}<div class="tags">${x.meta.map(t=>`<span class="tag">${t}</span>`).join('')}</div></button>`).join('')}
function openPlace(id){const x=pMap[id];if(!x)return;setReturn('explore');state.activeDetail={type:'place',id};$('#detailContext').textContent='EXPLORE';$('#detailBody').innerHTML=`<div class="detail-hero"><p class="eyebrow">${x.area} · ${x.type}</p><h1>${x.title}</h1><p>${x.short}</p></div><section class="detail-section"><span class="avail">${x.availability?.label||'November ✓'}</span><h2>Warum gespeichert?</h2><p>${x.take}</p><p><b>November:</b> ${x.availability?.note||'Open.'}</p></section><section class="detail-section"><h2>Status</h2>${statusHTML('place',id)}</section><section class="detail-section"><div class="actions"><a class="action primary" href="${directions(x.address)}" ${mapLinkAttrs()}>Directions</a>${x.website?`<a class="action" href="${x.website}" target="_blank" rel="noopener">Website ↗</a>`:''}</div></section>`;showView('detail')}
function openFood(id){const x=gMap[id];if(!x)return;setReturn('food');state.activeDetail={type:'food',id};$('#detailContext').textContent='EAT & DRINK';$('#detailBody').innerHTML=`<div class="detail-hero food"><p class="eyebrow">${x.area} · ${x.kind.toUpperCase()}</p><h1>${x.title}</h1><p>${x.best}</p></div><section class="detail-section"><h2>Our take</h2><p>${x.take}</p><div class="tags">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="outdoor">${outdoorLabel[x.outdoor]||''}</div></section><section class="detail-section"><h2>Status</h2>${statusHTML('food',id)}</section><section class="detail-section"><div class="actions"><a class="action primary" href="${directions(x.address)}" ${mapLinkAttrs()}>Directions</a>${x.website?`<a class="action" href="${x.website}" target="_blank" rel="noopener">Website ↗</a>`:''}</div></section>`;showView('detail')}
function stopData(s){if(s.place){const x=pMap[s.place];return x?{title:x.title,desc:x.short,type:'place',id:x.id,optional:!!s.optional}:null}if(s.food){const x=gMap[s.food];return x?{title:x.title,desc:x.best,type:'food',id:x.id,optional:!!s.optional}:null}if(s.label)return {title:s.label,desc:s.note||'',type:'note',optional:!!s.optional};return null}
function openPlan(id,push=true){const x=W.find(p=>p.id===id);if(!x)return;state.returnTarget={type:'view',view:'plans'};state.activeDetail={type:'plan',id};$('#detailContext').textContent='PLANS';const steps=x.stops.map(stopData).filter(Boolean);$('#detailBody').innerHTML=`<div class="detail-hero plan"><p class="eyebrow">${x.meta.join(' · ')}</p><h1>${x.title}</h1><p>${x.subtitle}</p></div>${x.timing?`<section class="detail-section timing-box"><p class="eyebrow">BEST DAY / WATCH OUT</p><p>${x.timing}</p></section>`:''}<section class="detail-section"><h2>Why this works</h2><p>${x.intro}</p>${x.source?`<a class="source-link" href="${x.source}" target="_blank" rel="noopener">${x.sourceLabel||'Source walk'} ↗</a>`:''}</section><section class="detail-section plan-map-section"><h2>Route overview</h2><p class="plan-map-copy">All mappable stops at a glance. Numbers match the stop list; lighter markers are optional. Google Maps below still uses the simpler core route.</p><div id="planOverviewMap" class="plan-overview-map"></div></section><section class="detail-section"><h2>Stop by stop</h2>${steps.map((s,i)=>`<div class="step ${s.optional?'optional-step':''}"><div class="step-num">${i+1}</div><div><h3>${s.title}${s.optional?` <span class="optional-label">OPTIONAL</span>`:''}</h3><p>${s.desc}</p>${s.type==='place'?`<button data-open-place="${s.id}">Details</button>`:s.type==='food'?`<button data-open-food="${s.id}">Details</button>`:''}</div></div>`).join('')}</section><section class="detail-section"><div class="actions"><a class="action primary" href="${planDirections(x)}" ${mapLinkAttrs()}>Open route ↗</a><button class="action" data-view="plans">All plans</button></div></section>`;showView('detail',push);setTimeout(()=>renderPlanOverviewMap(x),40)}
function initMap(){if(state.map){setTimeout(()=>state.map.invalidateSize(),0);return}state.map=L.map('map',{scrollWheelZoom:false}).setView([43.67,7.16],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(state.map);Object.entries(areaCoords).forEach(([area,coords])=>{const count=P.filter(x=>x.area===area).length+G.filter(x=>x.area===area).length;const icon=L.divIcon({className:'',html:`<div class="map-bubble">${count}</div>`,iconSize:[42,42],iconAnchor:[21,21]});const m=L.marker(coords,{icon}).addTo(state.map);m.bindPopup(`<b>${area}</b><br>${count} saved items`);m.on('click',()=>{});})}
$('#themeToggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('antibes-theme',document.body.classList.contains('dark')?'dark':'light')};if(localStorage.getItem('antibes-theme')==='dark')document.body.classList.add('dark');
renderHome();renderExploreControls();renderExplore();renderFoodControls();renderFood();renderEventControls();renderEvents();renderPlans();
if('serviceWorker' in navigator){
  const isDev=['localhost','127.0.0.1'].includes(location.hostname);
  if(isDev){
    navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(r=>r.unregister()))).catch(()=>{});
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('antibes-our-way-')).map(k=>caches.delete(k)))).catch(()=>{});
  }else{
    navigator.serviceWorker.register('./service-worker.js?v=1.4',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
  }
}
