const form = document.getElementById('booking-form');
const dates = document.getElementById('booking-dates');
const times = document.getElementById('booking-times');
const guests = document.getElementById('booking-guests');
const guestCount = document.getElementById('booking-guest-count');
const freshness = document.getElementById('booking-freshness');
const selection = document.getElementById('booking-selection');
const refreshButton = document.getElementById('booking-refresh');
const monthLabel = document.getElementById('booking-month');
const back = document.getElementById('booking-prev');
const forward = document.getElementById('booking-next');
const telegram = document.getElementById('booking-telegram');
const api = location.hostname === 'w-flopi.github.io'
  ? 'https://vante-craft-in-motion.isievemil.chatgpt.site' : '';
const submit = form.querySelector('button[type="submit"]');
const draft = document.getElementById('booking-draft');
const status = document.getElementById('booking-status');
const monthFormat = new Intl.DateTimeFormat('ru-RU', {month:'long',year:'numeric',timeZone:'UTC'});
const longFormat = new Intl.DateTimeFormat('ru-RU', {dateStyle:'long', timeZone:'UTC'});
const clock = new Intl.DateTimeFormat('ru-RU', {hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const parseDay = day => new Date(day + 'T00:00:00Z');
const formatDate = day => longFormat.format(parseDay(day));
const plural = new Intl.PluralRules('ru');
let schedule = [];
let month = '';
let date = '', time = '', checkedAt, signature;
let loading = false, submitting = false, stale = true;

function people(count) {
  const endings = {one:'участник',few:'участника',many:'участников',other:'участника'};
  return count + ' ' + endings[plural.select(Number(count))];
}
function summary() {
  guestCount.value = guests.value;
  const valid = !stale && !!time && !!date;
  submit.disabled = !valid || submitting;
  selection.textContent = valid
    ? formatDate(date) + ', ' + time + ' МСК · ' + people(guests.value)
    : 'Выберите свободное время, чтобы подготовить заявку.';
}
function option(name,value,title,detail,{selected=false,busy=false}={}) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = selected;
  input.disabled = busy;
  const copy = document.createElement('span');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const sub = document.createElement('small');
  sub.textContent = detail;
  copy.append(heading,sub);
  label.append(input,copy);
  return label;
}
function moveMonth(value, offset) {
  const d=parseDay(value+'-01');
  d.setUTCMonth(d.getUTCMonth()+offset);
  return d.toISOString().slice(0,7);
}
function renderDates() {
  const active = dates.contains(document.activeElement) ? document.activeElement.value : '';
  const first=schedule[0]?.date.slice(0,7), last=schedule.at(-1)?.date.slice(0,7);
  dates.replaceChildren();
  if (!first) { back.disabled=forward.disabled=true;return; }
  if (!month || month<first || month>last) month=date.slice(0,7) || first;
  const firstDay=parseDay(month+'-01');
  monthLabel.textContent=monthFormat.format(firstDay);
  back.disabled=month<=first;
  forward.disabled=month>=last;
  for(let i=0;i<(firstDay.getUTCDay()+6)%7;i++) dates.append(document.createElement('span'));
  const length=new Date(Date.UTC(firstDay.getUTCFullYear(),firstDay.getUTCMonth()+1,0)).getUTCDate();
  for(let day=1;day<=length;day++){
    const key=month+'-'+String(day).padStart(2,'0');
    const record=schedule.find(entry=>entry.date===key);
    const available=record?.slots.some(slot=>!slot.busy);
    const label=option('date',key,String(day),record ? (available?'●':'—'):'',{
      selected:date===key,busy:!record
    });
    label.querySelector('input').setAttribute('aria-label',formatDate(key)+
      (record ? (available?', есть свободное время':', всё занято'):', недоступно'));
    if (!available && record) label.classList.add('day-full');
    dates.append(label);
  }
  if(active) [...dates.querySelectorAll('input')].find(input=>input.value===active)?.focus({preventScroll:true});
}
function renderTimes() {
  const focusValue = times.contains(document.activeElement) ? document.activeElement.value : '';
  const slots = schedule.find(day=>day.date===date)?.slots ?? [];
  times.replaceChildren(...slots.map(slot=>option('time',slot.time,slot.time,
    slot.busy ? 'Занято' : 'Свободно',{selected:time===slot.time,busy:slot.busy})));
  if (focusValue) [...times.querySelectorAll('input')].find(input=>input.value===focusValue)?.focus({preventScroll:true});
  if (slots.length && slots.every(slot=>slot.busy)) {
    const full=document.createElement('p');
    full.textContent='На эту дату всё занято. Выберите другой день.';
    times.append(full);
  }
  if (!slots.length) {
    const empty = document.createElement('p');
    empty.textContent = schedule.length ? 'Свободных дат пока нет.' : 'Нет времени для выбора.';
    times.append(empty);
  }
  summary();
}

async function refresh() {
  if (loading) return;
  loading=true;
  refreshButton.disabled=true;
  try {
    const response=await fetch(api+'/api/slots',{cache:'no-store'});
    if (!response.ok) throw new Error('Расписание недоступно');
    const {schedule:next}=await response.json();
    const nextSignature=JSON.stringify(next);
    checkedAt=new Date();
    const changed=nextSignature!==signature;
    stale=false;
    freshness.textContent='Доступность проверена в '+clock.format(checkedAt)+' МСК';
    if (!changed) {summary();return;}
    signature=nextSignature;
    schedule=next;
    const previousDate=date;
    const previousTime=time;
    const open=schedule.find(day=>day.date===date);
    date=(open??schedule.find(day=>day.slots.some(slot=>!slot.busy)))?.date??'';
    const chosen=schedule.find(day=>day.date===date);
    if (!month && chosen) month=chosen.date.slice(0,7);
    if (date!==previousDate || !chosen?.slots.some(slot=>slot.time===time&&!slot.busy)) time='';
    if (previousTime && !time && !submitting) status.textContent='Выбранное время стало недоступно. Выберите другое.';
    renderDates();
    renderTimes();
  } catch {
    stale=true;
    freshness.textContent='Не удалось обновить доступность. Нажмите «Обновить» или уточните время в Telegram.';
    summary();
  } finally {
    loading=false;
    refreshButton.disabled=false;
  }
}

refreshButton.addEventListener('click',refresh);
back.addEventListener('click',()=>{month=moveMonth(month,-1);renderDates();});
forward.addEventListener('click',()=>{month=moveMonth(month,1);renderDates();});
dates.addEventListener('change',event=>{
  date=event.target.value;
  time='';
  renderTimes();
});
times.addEventListener('change',event=>{time=event.target.value;summary();});
guests.addEventListener('input',summary);
form.addEventListener('input',()=>{draft.hidden=true;telegram.hidden=true;status.textContent='';});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if (submit.disabled || !form.reportValidity()) return;
  const fields=Object.fromEntries(new FormData(form));
  submitting=true;
  draft.hidden=true;
  telegram.hidden=true;
  summary();
  try {
    const response=await fetch(api+'/api/book',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({date:fields.date,time:fields.time})
    });
    if ([409,422].includes(response.status)) {
      await refresh();
      status.textContent='Это время уже занято или прошло. Выберите другой слот.';
      return;
    }
    if (!response.ok) throw new Error('Ошибка записи');
    const {recipient}=await response.json();
    const lines=[
      'Здравствуйте! Хочу записаться на мастер-класс по изготовлению светильника.',
      '',
      'Дата: '+formatDate(fields.date),
      'Время: '+fields.time+' (Москва)',
      'Имя: '+fields.name.trim(),
      'Участников: '+fields.guests,
      'Контакт для ответа: '+fields.contact.trim()
    ];
    if (fields.comment.trim()) lines.push('','Комментарий: '+fields.comment.trim());
    draft.href='mailto:'+recipient+'?subject='+encodeURIComponent('Запись на мастер-класс «Лайтовой»')+
      '&body='+encodeURIComponent(lines.join('\r\n'));
    draft.hidden=false;
    telegram.href='https://t.me/+79996607737?text='+encodeURIComponent(lines.join('\n'));
    telegram.hidden=false;
    status.textContent='Время занято за вашей заявкой. Для подтверждения отправьте данные мастерской в Telegram. Адрес в письме тестовый.';
    window.location.href=draft.href;
    await refresh();
  } catch {
    status.textContent='Не удалось получить подтверждение записи. Расписание будет обновлено.';
    await refresh();
  } finally {
    submitting=false;
    summary();
  }
});
window.addEventListener('focus',()=>{if (!checkedAt || Date.now()-checkedAt>20_000) refresh();});
new IntersectionObserver(([entry])=>{if(entry.isIntersecting && (!checkedAt || Date.now()-checkedAt>30_000)) refresh();}).observe(form);
setInterval(()=>{if (!document.hidden && form.getBoundingClientRect().top<innerHeight && form.getBoundingClientRect().bottom>0) refresh();},45_000);
summary();
refresh();
