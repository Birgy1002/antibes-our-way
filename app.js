const P=window.PLACES,G=window.GASTRO,W=window.PLANS;
const STAY_START='2026-11-06',STAY_END='2026-11-23';
const E=(window.EVENTS||[]).filter(x=>x.date<=STAY_END&&(x.endDate||x.date)>=STAY_START);
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

/* French address geocoding: official IGN/BAN first, OSM only as a fallback.
   Search results are checked against Antibes' geographic extent. Never use an
   artwork's name as a substitute for its street address. */
const ANTIBES_BOUNDS={south:43.52,north:43.68,west:7.00,east:7.23};
const geocodePending=new Map();
let nominatimLastRequest=0;
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function validAntibesLocation(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=ANTIBES_BOUNDS.south&&lat<=ANTIBES_BOUNDS.north&&lon>=ANTIBES_BOUNDS.west&&lon<=ANTIBES_BOUNDS.east;
}
function streetSearchText(address){
  const parts=address.split(',').map(s=>s.trim());
  const street=parts.find(s=>/^(?:\d+(?:-\d+)?\s+)?(?:rue|avenue|boulevard|route|chemin|allée|allee|traverse|passage|rampe|voie|d35|rd\s?\d+|rond-point)/i.test(s));
  return street ? street+', Antibes, France' : address;
}
function isApproximateAddress(address,feature){
  const requested=streetSearchText(address);
  const hasNumber=/^\d+(?:-\d+)?\s+/i.test(requested);
  const type=(feature?.properties?.type||feature?.type||'').toLowerCase();
  return !hasNumber||!['housenumber','house'].includes(type);
}
async function fetchGeocodeJson(url,timeout=7000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const res=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json','Accept-Language':'fr'}});
    if(!res.ok)throw new Error('Geocoder HTTP '+res.status);
    return await res.json();
  }finally{clearTimeout(timer)}
}
async function ignGeocode(address){
  const queries=[streetSearchText(address)];
  if(queries[0]!==address)queries.push(address);
  for(const q of queries){
    try{
      const url='https://data.geopf.fr/geocodage/search/?q='+encodeURIComponent(q)+'&limit=5&autocomplete=0';
      const data=await fetchGeocodeJson(url);
      const choices=(data.features||[]).map(feature=>{
        const xy=feature.geometry?.coordinates||[];
        const p=feature.properties||{};
        const lat=Number(xy[1]),lon=Number(xy[0]);
        const city=String(p.city||p.citycode||'').toLowerCase();
        if(!validAntibesLocation(lat,lon))return null;
        if(city && !city.includes('antibes')&&city!=='06004')return null;
        const score=Number(p.score??0.5);
        if(score<0.38)return null;
        return {coords:[lat,lon],approx:isApproximateAddress(q,feature),source:'IGN/BAN',score,label:p.label||q};
      }).filter(Boolean).sort((a,b)=>b.score-a.score);
      if(choices.length)return choices[0];
    }catch(err){ /* retry with a simplified address, then OSM */ }
  }
  return null;
}
async function osmGeocode(address){
  const wait=Math.max(0,1150-(Date.now()-nominatimLastRequest));
  if(wait)await sleep(wait);
  nominatimLastRequest=Date.now();
  try{
    const q=streetSearchText(address);
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=fr&viewbox=7.0%2C43.68%2C7.23%2C43.52&bounded=1&q='+encodeURIComponent(q);
    const data=await fetchGeocodeJson(url,6500);
    const item=(data||[]).find(p=>{
      const lat=Number(p.lat),lon=Number(p.lon);
      const name=String(p.display_name||'').toLowerCase();
      return validAntibesLocation(lat,lon)&&(name.includes('antibes')||String(p.address?.city||'').toLowerCase().includes('antibes'));
    });
    return item?{coords:[Number(item.lat),Number(item.lon)],approx:!(/^\d+\s/.test(q))||!['house','building'].includes(String(item.type).toLowerCase()),source:'OpenStreetMap',label:item.display_name}:null;
  }catch(err){return null}
}
async function geocodeAddress(address,title=''){
  if(!address)return null;
  const cacheKey='antibes-geocode-v3-'+address;
  try{
    const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');
    if(cached?.coords&&validAntibesLocation(...cached.coords))return cached;
  }catch(err){}
  if(geocodePending.has(address))return geocodePending.get(address);
  const promise=(async()=>{
    const result=await ignGeocode(address)||await osmGeocode(address);
    if(result)try{localStorage.setItem(cacheKey,JSON.stringify(result))}catch(err){}
    return result;
  })();
  geocodePending.set(address,promise);
  try{return await promise}finally{geocodePending.delete(address)}
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
  detailPlanMap=L.map(el,{zoomControl:true,dragging:true,scrollWheelZoom:false,doubleClickZoom:true,boxZoom:false,keyboard:false,tap:true,touchZoom:true,attributionControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(detailPlanMap);
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
function renderExploreControls(){const areas=['All','Antibes','Nice','Around'];$('#areaChips').innerHTML=areas.map(a=>`<button class="chip ${state.area===a?'active':''}" data-area="${a}">${a==='All'?'All areas':a}</button>`).join('');$('#areaChips').querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{state.area=b.dataset.area;renderExploreControls();renderExplore()});const tags=['All','Art','Street Art','Architecture','Garden','Walk','Town','Market','Neighborhood','Wine','Innovation','Workation'];$('#tagChips').innerHTML=tags.map(t=>`<button class="chip ${state.tag===t?'active':''}" data-tag="${t}">${t}</button>`).join('');$('#tagChips').querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{state.tag=b.dataset.tag;renderExploreControls();renderExplore()})}
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
function detailSectionsHTML(x){return (x.detailSections||[]).map(s=>`<section class="detail-section"><h2>${s.title}</h2><p>${s.body}</p></section>`).join('')}
function openPlace(id){const x=pMap[id];if(!x)return;setReturn('explore');state.activeDetail={type:'place',id};$('#detailContext').textContent='EXPLORE';$('#detailBody').innerHTML=`<div class="detail-hero"><p class="eyebrow">${x.area} · ${x.type}</p><h1>${x.title}</h1><p>${x.short}</p></div><section class="detail-section"><span class="avail">${x.availability?.label||'November ✓'}</span><h2>Warum gespeichert?</h2><p>${x.take}</p><p><b>November:</b> ${x.availability?.note||'Open.'}</p></section>${detailSectionsHTML(x)}<section class="detail-section"><h2>Status</h2>${statusHTML('place',id)}</section><section class="detail-section"><div class="actions"><a class="action primary" href="${directions(x.address)}" ${mapLinkAttrs()}>Directions</a>${x.website?`<a class="action" href="${x.website}" target="_blank" rel="noopener">Website ↗</a>`:''}</div></section>`;showView('detail')}
function openFood(id){const x=gMap[id];if(!x)return;setReturn('food');state.activeDetail={type:'food',id};$('#detailContext').textContent='EAT & DRINK';$('#detailBody').innerHTML=`<div class="detail-hero food"><p class="eyebrow">${x.area} · ${x.kind.toUpperCase()}</p><h1>${x.title}</h1><p>${x.best}</p></div><section class="detail-section"><h2>Our take</h2><p>${x.take}</p><div class="tags">${x.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="outdoor">${outdoorLabel[x.outdoor]||''}</div></section><section class="detail-section"><h2>Status</h2>${statusHTML('food',id)}</section><section class="detail-section"><div class="actions"><a class="action primary" href="${directions(x.address)}" ${mapLinkAttrs()}>Directions</a>${x.website?`<a class="action" href="${x.website}" target="_blank" rel="noopener">Website ↗</a>`:''}</div></section>`;showView('detail')}
function stopData(s){if(s.place){const x=pMap[s.place];return x?{title:x.title,desc:x.short,type:'place',id:x.id,optional:!!s.optional}:null}if(s.food){const x=gMap[s.food];return x?{title:x.title,desc:x.best,type:'food',id:x.id,optional:!!s.optional}:null}if(s.label)return {title:s.label,desc:s.note||'',type:'note',optional:!!s.optional};return null}
let streetClusterMaps=[];
let streetMapGeneration=0;
const streetClusterFocus=new Map();
// The list works as a secondary control for Leaflet markers. If a pin is unavailable,
// the same interaction opens the existing Google Maps destination instead.
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-street-focus]');
  if(!btn)return;
  const focus=streetClusterFocus.get(btn.dataset.streetFocus);
  if(focus){
    focus.map.flyTo(focus.marker.getLatLng(),Math.max(focus.map.getZoom(),17));
    focus.marker.openPopup();
    focus.map.getContainer().scrollIntoView({behavior:'smooth',block:'center'});
  }else{
    const link=btn.closest('.street-item')?.querySelector('.street-map-btn');
    if(link)link.click();
  }
});
function clearStreetClusterMaps(){
  streetMapGeneration++;
  streetClusterFocus.clear();
  streetClusterMaps.forEach(m=>{try{m.remove()}catch(e){}});
  streetClusterMaps=[];
}
function itemMapUrl(item,mode='walking'){
  return item.mapUrl||directions(item.address,mode);
}
function uniqueClusterStops(cluster){
  const byAddress=new Map();
  (cluster.items||[]).forEach((item,index)=>{
    if(!item.address)return;
    const key=item.address.trim().toLowerCase();
    if(!byAddress.has(key))byAddress.set(key,{address:item.address,items:[{item,index}]});
    else byAddress.get(key).items.push({item,index});
  });
  return [...byAddress.values()];
}
function routeChunks(cluster,maxStops=5){
  const stops=uniqueClusterStops(cluster);
  if(stops.length<=maxStops)return stops.length?[stops]:[];
  const chunks=[];
  let start=0;
  while(start<stops.length-1){
    const chunk=stops.slice(start,Math.min(stops.length,start+maxStops));
    if(chunk.length<2)break;
    chunks.push(chunk);
    start+=maxStops-1;
  }
  return chunks;
}
function chunkRouteUrl(chunk,mode){
  if(chunk.length===1)return directions(chunk[0].address,mode);
  return googleDirectionsUrl({
    origin:chunk[0].address,
    destination:chunk[chunk.length-1].address,
    waypoints:chunk.slice(1,-1).map(x=>x.address),
    mode
  });
}
function clusterRouteButtons(cluster,defaultMode='walking'){
  const mode=cluster.mode||defaultMode;
  const chunks=routeChunks(cluster,5);
  if(!chunks.length)return '';
  if(chunks.length===1){
    const url=chunkRouteUrl(chunks[0],mode);
    return '<a class="cluster-map-btn" href="'+url+'" '+mapLinkAttrs()+'>'+(chunks[0].length===1?'Open in Google Maps ↗':'Route in Google Maps ↗')+'</a>';
  }
  return '<div class="cluster-route-group">'+chunks.map((chunk,i)=>'<a class="cluster-map-btn" href="'+chunkRouteUrl(chunk,mode)+'" '+mapLinkAttrs()+'>Route '+String.fromCharCode(65+i)+' ↗</a>').join('')+'</div>';
}
function streetPopupGroup(group,mode){
  const rows=group.items.map(({item,index})=>{
    const facts=item.facts?'<div class="street-popup-facts">'+item.facts+'</div>':'';
    const desc=item.description?'<div class="street-popup-description">'+item.description+'</div>':'';
    const access=item.access?'<div class="street-popup-access">'+item.access+'</div>':'';
    const maps=item.address?'<a href="'+itemMapUrl(item,mode)+'" '+mapLinkAttrs()+'>Google Maps ↗</a>':'';
    return '<div class="street-popup-work"><b>'+(index+1)+'. '+item.title+'</b>'+facts+desc+access+maps+'</div>';
  }).join('');
  return '<div class="street-popup">'+rows+'</div>';
}
async function renderStreetClusterMap(plan,cluster,ci,generation){
  const el=document.getElementById('streetClusterMap-'+ci);
  if(!el||typeof L==='undefined')return;
  el.innerHTML='<div class="plan-map-loading">Karte wird geladen…</div>';
  const groups=uniqueClusterStops(cluster);
  if(!groups.length){el.innerHTML='<div class="plan-map-fallback">Für diesen Cluster gibt es keinen festen Kartenpunkt.</div>';return}
  let map=null;
  const latlngs=[];
  let missing=0;
  for(const group of groups){
    const title=group.items.map(x=>x.item.title).join(' / ');
    const latlng=group.items.find(x=>Array.isArray(x.item.coords))?.item.coords || await geocodeAddress(group.address,title);
    if(generation!==streetMapGeneration||!el.isConnected)return;
    if(!latlng){missing++;continue}
    if(!map){
      el.innerHTML='';
      map=L.map(el,{zoomControl:true,dragging:true,scrollWheelZoom:false,doubleClickZoom:true,boxZoom:false,keyboard:false,tap:true,touchZoom:true,attributionControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
      streetClusterMaps.push(map);
    }
    latlngs.push(latlng);
    const nums=group.items.map(x=>x.index+1).join('/');
    const markerWidth=Math.max(34,Math.min(64,22+nums.length*5));
    const icon=L.divIcon({className:'',html:'<div class="plan-marker">'+nums+'</div>',iconSize:[markerWidth,34],iconAnchor:[markerWidth/2,17]});
    const marker=L.marker(latlng,{icon}).addTo(map).bindPopup(streetPopupGroup(group,cluster.mode||plan.mode));
    group.items.forEach(({index})=>streetClusterFocus.set(ci+':'+index,{map,marker}));
    if(latlngs.length===1)map.setView(latlng,15);
    else map.fitBounds(L.latLngBounds(latlngs).pad(.12),{maxZoom:16});
    setTimeout(()=>map.invalidateSize(),0);
  }
  if(!map){el.innerHTML='<div class="plan-map-fallback">Kartenpunkte konnten nicht geladen werden. Die Google-Maps-Links funktionieren trotzdem.</div>';return}
  if(missing){
    const msg=document.createElement('div');
    msg.className='street-map-warning';
    msg.textContent=missing+' Standort'+(missing===1?'':'e')+' konnte'+(missing===1?'':'n')+' nicht automatisch auf der Leaflet-Karte gesetzt werden; der Eintrag und Google-Maps-Link bleiben unten erhalten.';
    el.parentElement.insertBefore(msg,el.nextSibling);
  }
}
async function renderStreetClusterMaps(plan){
  clearStreetClusterMaps();
  const generation=streetMapGeneration;
  for(let ci=0;ci<(plan.clusters||[]).length;ci++){
    if(generation!==streetMapGeneration)break;
    await renderStreetClusterMap(plan,plan.clusters[ci],ci,generation);
  }
}
function planSpecialsHTML(plan){
  if(!plan.specials?.length)return '';
  return '<section class="detail-section street-specials"><p class="eyebrow">OHNE FESTEN PIN</p><h2>Besondere Fälle</h2>'+
    plan.specials.map(x=>'<div class="street-special"><h3>'+x.title+'</h3>'+(x.facts?'<div class="street-facts">'+x.facts+'</div>':'')+'<p>'+x.note+'</p></div>').join('')+
    '</section>';
}
function planClustersHTML(plan){
  return (plan.clusters||[]).map((cluster,ci)=>`<section class="detail-section street-cluster">
    <div class="street-cluster-head"><div><p class="eyebrow">${cluster.meta||''}</p><h2>${cluster.title}</h2></div>${clusterRouteButtons(cluster,plan.mode)}</div>
    <p class="street-cluster-note">${cluster.note||''}</p>
    ${cluster.hunt?`<p class="street-hunt">${cluster.hunt}</p>`:''}
    <div id="streetClusterMap-${ci}" class="street-cluster-map"></div>
    <div class="street-map-caption">Orientierungskarte · Nummern entsprechen der Liste. Marker antippen für Werkinfos und Google Maps. Die Straßenroute öffnen die Buttons A, B und C.</div>
    <div class="street-list">${(cluster.items||[]).map((item,i)=>`<div class="street-item"><div class="street-num">${i+1}</div><div class="street-copy"><h3>${item.title}</h3>${item.facts?`<div class="street-facts">${item.facts}</div>`:''}${item.description?`<p class="street-description">${item.description}</p>`:''}${item.access?`<div class="street-access">${item.access}</div>`:''}</div><div class="street-links"><button type="button" class="street-focus-btn" data-street-focus="${ci}:${i}">Auf Karte</button>${item.address?`<a class="street-map-btn" href="${itemMapUrl(item,cluster.mode||plan.mode)}" ${mapLinkAttrs()}>Maps ↗</a>`:''}</div></div>`).join('')}</div>
  </section>`).join('');
}
function openPlan(id,push=true){
  clearStreetClusterMaps();
  if(detailPlanMap){detailPlanMap.remove();detailPlanMap=null}
  const x=W.find(p=>p.id===id);if(!x)return;
  state.returnTarget={type:'view',view:'plans'};state.activeDetail={type:'plan',id};$('#detailContext').textContent='PLANS';
  const steps=(x.stops||[]).map(stopData).filter(Boolean);
  const clustered=Array.isArray(x.clusters)&&x.clusters.length>0;
  $('#detailBody').innerHTML=`<div class="detail-hero plan"><p class="eyebrow">${x.meta.join(' · ')}</p><h1>${x.title}</h1><p>${x.subtitle}</p></div>${x.timing?`<section class="detail-section timing-box"><p class="eyebrow">BEST DAY / WATCH OUT</p><p>${x.timing}</p></section>`:''}<section class="detail-section"><h2>Why this works</h2><p>${x.intro}</p>${x.source?`<a class="source-link" href="${x.source}" target="_blank" rel="noopener">${x.sourceLabel||'Source walk'} ↗</a>`:''}</section>${clustered?planSpecialsHTML(x)+planClustersHTML(x):`<section class="detail-section plan-map-section"><h2>Route overview</h2><p class="plan-map-copy">All mappable stops at a glance. Numbers match the stop list; lighter markers are optional. Google Maps below still uses the simpler core route.</p><div id="planOverviewMap" class="plan-overview-map"></div></section><section class="detail-section"><h2>Stop by stop</h2>${steps.map((s,i)=>`<div class="step ${s.optional?'optional-step':''}"><div class="step-num">${i+1}</div><div><h3>${s.title}${s.optional?` <span class="optional-label">OPTIONAL</span>`:''}</h3><p>${s.desc}</p>${s.type==='place'?`<button data-open-place="${s.id}">Details</button>`:s.type==='food'?`<button data-open-food="${s.id}">Details</button>`:''}</div></div>`).join('')}</section>`}<section class="detail-section"><div class="actions">${clustered?'':`<a class="action primary" href="${planDirections(x)}" ${mapLinkAttrs()}>Open route ↗</a>`}<button class="action" data-view="plans">All plans</button></div></section>`;
  showView('detail',push);
  if(clustered)setTimeout(()=>renderStreetClusterMaps(x),40);else setTimeout(()=>renderPlanOverviewMap(x),40);
}
function initMap(){if(state.map){setTimeout(()=>state.map.invalidateSize(),0);return}state.map=L.map('map',{scrollWheelZoom:false}).setView([43.67,7.16],9);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(state.map);Object.entries(areaCoords).forEach(([area,coords])=>{const count=P.filter(x=>x.area===area).length+G.filter(x=>x.area===area).length;const icon=L.divIcon({className:'',html:`<div class="map-bubble">${count}</div>`,iconSize:[42,42],iconAnchor:[21,21]});const m=L.marker(coords,{icon}).addTo(state.map);m.bindPopup(`<b>${area}</b><br>${count} saved items`);m.on('click',()=>{});})}
$('#themeToggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('antibes-theme',document.body.classList.contains('dark')?'dark':'light')};if(localStorage.getItem('antibes-theme')==='dark')document.body.classList.add('dark');
renderHome();renderExploreControls();renderExplore();renderFoodControls();renderFood();renderEventControls();renderEvents();renderPlans();
if('serviceWorker' in navigator){
  const isDev=['localhost','127.0.0.1'].includes(location.hostname);
  if(isDev){
    navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(r=>r.unregister()))).catch(()=>{});
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('antibes-our-way-')).map(k=>caches.delete(k)))).catch(()=>{});
  }else{
    navigator.serviceWorker.register('./service-worker.js?v=2.7',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
  }
}
