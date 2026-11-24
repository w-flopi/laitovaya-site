const items = JSON.parse(document.getElementById('media-data').textContent);
const orbit = document.getElementById('orbit');
const mediaGrid = document.getElementById('gallery-grid');
const albumCovers = document.getElementById('album-covers');
const search = document.getElementById('search');
const dialog = document.getElementById('media-dialog');
const preview = document.getElementById('media-preview');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 760px)');
const topics = ['Атмосфера мастерской', 'Светильники', 'Процесс', 'Мастерская'];
const sorted = topics.flatMap(topic => items.filter(item => item.group === topic));
const orbitItems = items.filter(item => item.group === 'Атмосфера мастерской');
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
let openAlbum = null, matches = sorted, activeList, activeIndex, dialogOpener;
let phase = .022, spin = 0, onScreen = true, bounds, rail, bookW, bookH, grabbed;
let cursor = {x:0,y:0};
function mediaImage(item,{lazy=false,label='',draggable=false}={}) {
  const img=element('img');
  img.src=item.image;
  img.alt=label;
  img.draggable=draggable;
  if (lazy) img.loading='lazy';
  if (!item.gif) return img;
  const picture=element('picture');
  const source=element('source');
  source.media='(prefers-reduced-motion: no-preference)';
  source.type='image/gif';
  source.srcset=item.gif;
  picture.append(source,img);
  return picture;
}

const coverImages = ['./media/opening-03.jpg', './media/photo-0.jpg', './media/opening-09.jpg', './media/photo-7.jpg'];
const albums = new Map(topics.map((topic, index) => {
  const cover = element('button', 'album-cover');
  const photo = element('img', 'album-front');
  const back = element('img', 'album-back');
  const panel = element('section', 'media-album');
  const clip = element('div', 'album-clip');
  const grid = element('div', 'gallery-grid');
  photo.src = coverImages[index];
  photo.alt = '';
  photo.loading = 'lazy';
  back.src = sorted.filter(item => item.group === topic)[1]?.image ?? photo.src;
  back.alt = '';
  back.loading = 'lazy';
  cover.type = 'button';
  cover.id = 'album-cover-' + index;
  panel.id = 'album-panel-' + index;
  cover.setAttribute('aria-controls', panel.id);
  panel.setAttribute('aria-labelledby', cover.id);
  cover.append(back, photo, element('span', 'album-name', topic));
  cover.addEventListener('click', () => {
    openAlbum = openAlbum === topic ? null : topic;
    updateGallery();
    if (openAlbum === topic) clip.scrollTop = 0;
  });
  clip.tabIndex = 0;
  clip.setAttribute('aria-label', topic + ' — материалы альбома');
  clip.append(grid);
  panel.append(clip);
  albumCovers.append(cover);
  mediaGrid.append(panel);
  return [topic, {cover, panel, grid}];
}));

const tiles = sorted.map(item => {
  const tile=element('button',item.gif ? 'media-tile gif-tile' : 'media-tile');
  const frame=element('span','tile-image');
  tile.type='button';
  frame.append(mediaImage(item,{lazy:true}));
  tile.append(frame,element('span','tile-title',item.title));
  tile.addEventListener('click',()=>openMedia(item,matches.filter(match => match.group === item.group)));
  albums.get(item.group).grid.append(tile);
  return tile;
});

function updateGallery() {
  const q = normalize(search.value);
  matches = sorted.filter((item, i) => {
    const show = normalize(item.title + ' ' + item.group + (item.gif ? ' gif видео рилс' : ' фото')).includes(q);
    tiles[i].hidden = !show;
    return show;
  });
  const visibleGroups = new Set(matches.map(item => item.group));
  if (q && !visibleGroups.has(openAlbum) && openAlbum !== null) openAlbum = visibleGroups.values().next().value ?? null;
  albums.forEach(({cover, panel}, topic) => {
    const expanded = topic === openAlbum && visibleGroups.has(topic);
    cover.hidden = !visibleGroups.has(topic);
    cover.setAttribute('aria-expanded', String(expanded));
    panel.classList.toggle('is-open', expanded);
    panel.inert = !expanded;
  });
  document.getElementById('gallery-count').textContent = q
    ? (matches.length ? 'Найдено материалов: ' + matches.length : 'Ничего не найдено. Попробуйте другой запрос.')
    : '';
}

search.addEventListener('input', () => {
  if (!openAlbum) openAlbum = topics[0];
  updateGallery();
});
updateGallery();

function showMedia() {
  const item = activeList[activeIndex];
  preview.replaceChildren(mediaImage(item,{label:item.title}));
  document.getElementById('media-title').textContent=item.title;
  document.getElementById('media-topic').textContent=item.group;
  const original=document.getElementById('media-original');
  original.hidden=!item.original;
  if(item.original) original.href=item.original;
}
function openMedia(item,list) {
  dialogOpener = document.activeElement;
  activeList = list;
  activeIndex = list.indexOf(item);
  showMedia();
  dialog.showModal();
  document.getElementById('media-close').focus();
}
function moveMedia(by) {
  activeIndex = (activeIndex + by + activeList.length) % activeList.length;
  showMedia();
}
document.getElementById('media-close').addEventListener('click',()=>dialog.close());
document.getElementById('media-prev').addEventListener('click',()=>moveMedia(-1));
document.getElementById('media-next').addEventListener('click',()=>moveMedia(1));
dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close',()=>{ preview.replaceChildren(); dialogOpener?.focus({preventScroll:true}); });
dialog.addEventListener('keydown',event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    moveMedia(event.key === 'ArrowLeft' ? -1 : 1);
  }
});

const books = orbitItems.map((item,i) => {
  const button = element('button','orbit-card');
  button.type = 'button';
  button.setAttribute('aria-label',item.title);
  const face=element('span','card-face');
  face.append(mediaImage(item));
  button.append(face,element('span','card-back'),element('span','card-spine'),element('span','card-edge'));
  orbit.append(button);
  const book = {button, item, i, x:0,y:0,vx:0,vy:0,hover:false,tilt:[-12,8,-9,12,-7,10,-16,7,-8,14,-9,7][i]};
  button.addEventListener('pointerenter',event=>{book.hover = event.pointerType === 'mouse';});
  button.addEventListener('pointerleave',()=>{book.hover = false;});
  button.addEventListener('focus',()=>{book.hover = true;});
  button.addEventListener('blur',()=>{book.hover = false;});
  button.addEventListener('click',event=>{
    if (book.suppress && event.detail) return;
    openMedia(item,sorted);
  });
  button.addEventListener('pointerdown',event=>{
    if (event.button !== 0) return;
    grabbed = {book, id:event.pointerId, sx:event.clientX,sy:event.clientY,
      offsetX:book.x - (event.clientX-bounds.left), offsetY:book.y-(event.clientY-bounds.top),
      lastX:event.clientX,lastY:event.clientY,lastTime:event.timeStamp, vx:0,vy:0,moved:false};
  });
  return book;
});

function resize() {
  bounds = orbit.getBoundingClientRect();
  const {width:w,height:h} = bounds;
  bookW = narrow.matches ? Math.min(139,w*.306) : Math.min(153, Math.max(99,w*.104));
  bookH = bookW * 1.23;
  orbit.style.setProperty('--card-w',bookW+'px');
  orbit.style.setProperty('--card-h',bookH+'px');
  orbit.style.setProperty('--depth',bookW*.034+'px');
  const samples = [], rx = w * (narrow.matches ? .414 : .418), ry = h * .333;
  let distance = 0;
  for (let i = 0; i <= 360; i++) {
    const a = i*Math.PI/180, cx = Math.cos(a), sy = Math.sin(a);
    const x = w*.5 + rx*Math.sign(cx)*Math.sqrt(Math.abs(cx));
    const y = h*.47 + ry*Math.sign(sy)*Math.sqrt(Math.abs(sy));
    if (i) distance += Math.hypot(x-samples[i-1].x,y-samples[i-1].y);
    samples.push({x,y,d:distance});
  }
  rail = samples;
  books.forEach((book,i)=>{book.button.hidden = narrow.matches && i % 2 === 1;});
  paint(0,true);
}
function railPoint(offset) {
  const progress = ((offset % 1) + 1) % 1;
  const distance = rail.at(-1).d * progress;
  let lo = 0, hi = rail.length - 1;
  while (hi-lo > 1) {
    const mid = (hi+lo)>>1;
    if (rail[mid].d < distance) lo = mid;
    else hi = mid;
  }
  const a = rail[lo], b = rail[hi], mix = (distance-a.d)/(b.d-a.d);
  return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix};
}
function paint(time,snap=false,dt=.016) {
  const active = books.filter(book=>!book.button.hidden);
  active.forEach((book,k) => {
    const point = railPoint(phase+k/active.length);
    if (!reduce.matches) {
      point.x -= cursor.x * 13;
      point.y += Math.sin(time*.0008+k*1.4)*4 - cursor.y*8;
    }
    const dragging = grabbed?.book === book && grabbed.moved;
    if (dragging) {
      book.x=grabbed.lastX-bounds.left+grabbed.offsetX;
      book.y=grabbed.lastY-bounds.top+grabbed.offsetY;
    } else if (snap || reduce.matches) {
      book.x=point.x;book.y=point.y;book.vx=0;book.vy=0;
    } else {
      for (let step=0;step<3;step++) {
        book.vx += ((point.x-book.x)*126-book.vx*17)*dt/3;
        book.vy += ((point.y-book.y)*126-book.vy*17)*dt/3;
        book.x += book.vx*dt/3;book.y += book.vy*dt/3;
      }
    }
    const focus = book.hover || dragging;
    const yaw = dragging ? grabbed.vx*.014 : (book.i%2 ? 17 : -17) + cursor.x*8;
    const tilt = book.tilt * (focus ? .45 : 1);
    book.button.style.zIndex = focus ? '20' : String(2+Math.floor(book.y/bounds.height*8));
    book.button.style.transform = 'translate3d('+ (book.x-bookW/2) +'px,'+ (book.y-bookH/2) +
      'px,'+(focus ? 55 : 0)+'px) rotateZ('+tilt+'deg) rotateX('+(-cursor.y*8)+'deg) rotateY('+yaw+
      'deg) scale('+(focus ? 1.06 : 1)+')';
  });
}
window.addEventListener('pointermove',event=>{
  if (grabbed?.id === event.pointerId) {
    const d=grabbed;
    const dx=event.clientX-d.sx, dy=event.clientY-d.sy;
    if (!d.moved && Math.hypot(dx,dy) > 6 && (!narrow.matches || Math.abs(dx) > Math.abs(dy))) {
      d.moved=true;
      d.book.button.setPointerCapture(event.pointerId);
    }
    const dt=Math.max(12,event.timeStamp-d.lastTime)/1000;
    d.vx=(event.clientX-d.lastX)/dt;d.vy=(event.clientY-d.lastY)/dt;
    d.lastX=event.clientX;d.lastY=event.clientY;d.lastTime=event.timeStamp;
  }
  if (!onScreen || event.pointerType !== 'mouse') return;
  const box=orbit.getBoundingClientRect();
  cursor.x=Math.max(-.5,Math.min(.5,(event.clientX-box.left)/box.width-.5));
  cursor.y=Math.max(-.5,Math.min(.5,(event.clientY-box.top)/box.height-.5));
},{passive:true});
function release(event) {
  if (grabbed?.id !== event.pointerId) return;
  const {book,moved,vx,vy} = grabbed;
  if (moved) {
    book.suppress = true;
    book.vx=Math.max(-1100,Math.min(1100,vx));
    book.vy=Math.max(-800,Math.min(800,vy));
    setTimeout(()=>{book.suppress=false;},150);
  }
  grabbed=null;
}
window.addEventListener('pointerup',release);
window.addEventListener('pointercancel',release);
orbit.addEventListener('wheel',event=>{
  if (!reduce.matches && (event.shiftKey || Math.abs(event.deltaX)>Math.abs(event.deltaY))) {
    spin += (event.deltaX || event.deltaY) * .000095;
  }
},{passive:true});
new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;}).observe(orbit);
const transition = createGalleryTransition();
new ResizeObserver(() => {resize();transition.reset();}).observe(orbit);
window.addEventListener('scroll',()=>{
  bounds=orbit.getBoundingClientRect();
  transition.dirty=true;
},{passive:true});
reduce.addEventListener('change',()=>transition.reset());

const steps = document.querySelectorAll('.steps li');
const stepObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('step-in-view');
    stepObserver.unobserve(entry.target);
  }
}, {threshold:.25});
steps.forEach(step=>stepObserver.observe(step));

if (!reduce.matches) {
  const revealItems = document.querySelectorAll(
    '.section-heading > h2, .section-heading > p, .booking-panel > h3, .booking-notice > strong, .booking-notice > p'
  );
  const revealObserver = new IntersectionObserver(entries => {
    let delay = 0;
    for (const entry of entries.sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)) {
      if (!entry.isIntersecting) continue;
      entry.target.style.setProperty('--reveal-delay', delay + 'ms');
      entry.target.classList.replace('scroll-pending', 'scroll-in');
      revealObserver.unobserve(entry.target);
      delay = Math.min(delay + 85, 170);
    }
  });
  for (const item of revealItems) {
    if (item.getBoundingClientRect().top < innerHeight) continue;
    item.classList.add('scroll-pending');
    revealObserver.observe(item);
  }
}

function createGalleryTransition() {
  const layer = element('div','gallery-flight');
  layer.setAttribute('aria-hidden','true');
  document.body.append(layer);

  // Pair each card with its own media tile, even when their orders differ.
  const pairs = books.map(book => {
    const target = tiles[sorted.indexOf(book.item)].querySelector('.tile-image');
    const image = element('img');
    image.src = book.item.image;
    image.alt = '';
    const card = element('div','gallery-flight-card');
    card.hidden=true;
    card.append(image);
    layer.append(card);
    return {book,target,card};
  });
  const state = {active:false,dirty:true,update,reset};
  let displayed=0;
  function reset() {
    state.active=false;
    state.dirty=true;
    displayed=0;
    orbit.classList.remove('is-morphing');
    for (const pair of pairs) {
      pair.target.style.removeProperty('--landing-opacity');
      pair.card.hidden=true;
    }
  }
  function update(dt) {
    state.dirty=false;
    const y=scrollY, viewport=innerHeight, box=orbit.getBoundingClientRect();
    const heroTop=box.top+y;
    const start=heroTop+box.height*.08;
    const finish=Math.max(start+box.height*.52,
      albums.get(topics[0]).panel.getBoundingClientRect().top+y-viewport*.36);
    const wanted=Math.max(0,Math.min(1,(y-start)/(finish-start)));
    if (openAlbum !== topics[0] || reduce.matches || dialog.open || y>finish+viewport*.72 || (!state.active && (wanted===0 || wanted===1))) {
      if(state.active) {reset();state.dirty=false;}
      return;
    }
    displayed+=(wanted-displayed)*(1-Math.exp(-dt*9));
    if (Math.abs(wanted-displayed)<.006) displayed=wanted;
    const progress=displayed;
    if (progress===0 || progress===1) {
      if (state.active) {reset();state.dirty=false;}
      else if(wanted!==progress) state.dirty=true;
      return;
    }
    if(!state.active){
      state.active=true;
      orbit.classList.add('is-morphing');
    }
    const eased=progress*progress*(3-2*progress);
    const reveal=Math.max(0,(progress-.82)/.18);
    const mix=(a,b)=>a+(b-a)*eased;
    for(const {book,target,card} of pairs){
      if(book.button.hidden || target.closest('[hidden], [inert]')){
        card.hidden=true;
        target.style.removeProperty('--landing-opacity');
        continue;
      }
      const to=target.getBoundingClientRect();
      const fromX=box.left+book.x-bookW/2;
      const fromY=heroTop-start+book.y-bookH/2;
      card.hidden=false;
      card.style.width=bookW+'px';
      card.style.height=bookH+'px';
      card.style.opacity=String(1-reveal);
      card.style.transform='translate3d('+mix(fromX,to.left)+'px,'+mix(fromY,to.top)+'px,0) '+
        'rotateZ('+book.tilt*(1-eased)+'deg) rotateY('+((book.i%2?17:-17)*(1-eased))+'deg) '+
        'scale('+mix(1,to.width/bookW)+','+mix(1,to.height/bookH)+')';
      target.style.setProperty('--landing-opacity',String(reveal));
    }
  }
  return state;
}

let last;
function frame(time) {
  const dt=Math.min(.033,(time-(last??time))/1000);
  last=time;
  if ((onScreen || transition.active) && !dialog.open) {
    if (!reduce.matches) {phase += dt*.026+spin;spin*=.91;}
    paint(time,false,dt);
  }
  if (transition.dirty || transition.active) transition.update(dt);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
