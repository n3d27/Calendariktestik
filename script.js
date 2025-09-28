<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Календарь дней рождения — Telegram Mini App</title>
  <style>
    :root{--bg:#f7f7fb;--card:#fff;--muted:#666;--accent:#2b6cb0}
    html,body{height:100%;margin:0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:#111}
    .app{max-width:980px;margin:18px auto;padding:18px}
    header{display:flex;justify-content:space-between;align-items:center}
    h1{font-size:18px;margin:0}
    .controls{display:flex;gap:8px;align-items:center}
    .card{background:var(--card);padding:14px;border-radius:12px;box-shadow:0 6px 18px rgba(10,10,20,0.06)}
    .calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:12px}
    .day{min-height:80px;padding:6px;border-radius:8px;background:linear-gradient(180deg,#fff, #fbfdff);position:relative}
    .day .date{font-weight:600}
    .day .birth{display:block;margin-top:6px;padding:4px;border-radius:6px;font-size:12px;background:#f0f8ff;color:#08306b}
    .nav{display:flex;gap:8px;align-items:center}
    button{background:var(--accent);color:#fff;border:0;padding:8px 10px;border-radius:8px;cursor:pointer}
    button.ghost{background:transparent;color:var(--accent);border:1px solid rgba(43,108,176,0.15)}
    .sidebar{margin-top:12px;display:flex;gap:12px}
    .col{flex:1}
    label{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
    input,select,textarea{width:100%;padding:8px;border-radius:8px;border:1px solid #e6e9ef}
    .list{max-height:300px;overflow:auto;margin-top:8px}
    .item{display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f1f4f8}
    .small{font-size:12px;color:var(--muted)}
    .actions button{margin-left:6px;padding:6px 8px}
    footer{margin-top:12px;text-align:center;color:var(--muted);font-size:12px}
    /* modal */
    .modal-wrap{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,12,20,0.45)}
    .modal{width:420px;background:#fff;padding:14px;border-radius:12px}
    .modal h2{margin:0 0 8px 0}
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>Календарь дней рождения</h1>
      <div class="controls">
        <div id="currentMonth" class="small"></div>
        <button id="prev">◀</button>
        <button id="next">▶</button>
        <button id="addBirthday" class="ghost">Добавить</button>
      </div>
    </header>

    <main class="card">
      <div class="calendar" id="calendar"></div>
      <div class="sidebar">
        <div class="col card" style="flex:0.46">
          <label>Список дней рождения (в этом месяце)</label>
          <div id="monthList" class="list"></div>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button id="export">Экспорт JSON</button>
            <button id="import" class="ghost">Импорт</button>
          </div>
          <input id="importFile" type="file" accept="application/json" style="display:none;margin-top:8px" />
        </div>
        <div class="col card">
          <label>Ближайшие дни рождения</label>
          <div id="upcoming" class="list"></div>
        </div>
      </div>
    </main>

    <footer class="small">Хранение локально в localStorage. Поддерживает импорт/экспорт.</footer>
  </div>

  <div class="modal-wrap" id="modal">
    <div class="modal card">
      <h2 id="modalTitle">Добавить</h2>
      <label>Имя</label>
      <input id="bName" />
      <label>Дата (ГГГГ-ММ-ДД или ММ-ДД)</label>
      <input id="bDate" placeholder="2025-09-29 или 09-29" />
      <label>Комментарий</label>
      <input id="bNote" />
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button id="save">Сохранить</button>
        <button id="cancel" class="ghost">Отмена</button>
      </div>
    </div>
  </div>

  <script>
    // Основано на: ваш запрос. Реализация single-file app. Хранение: localStorage (tg_birthdays).

    const storageKey = 'tg_birthdays';
    let birthdays = JSON.parse(localStorage.getItem(storageKey) || '[]');

    // Utilities
    const pad = n => (n<10? '0'+n : ''+n);

    function saveAll(){ localStorage.setItem(storageKey, JSON.stringify(birthdays)); }

    // Telegram WebApp ready if available
    try{ if(window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.ready==='function') window.Telegram.WebApp.ready(); }catch(e){/* ignore */}

    // Calendar state
    let viewYear, viewMonth; // month: 0..11
    const now = new Date(); viewYear = now.getFullYear(); viewMonth = now.getMonth();

    // DOM
    const calendarEl = document.getElementById('calendar');
    const currentMonthEl = document.getElementById('currentMonth');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const addBtn = document.getElementById('addBirthday');
    const modalWrap = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const bName = document.getElementById('bName');
    const bDate = document.getElementById('bDate');
    const bNote = document.getElementById('bNote');
    const saveBtn = document.getElementById('save');
    const cancelBtn = document.getElementById('cancel');
    const monthList = document.getElementById('monthList');
    const upcomingEl = document.getElementById('upcoming');
    const exportBtn = document.getElementById('export');
    const importBtn = document.getElementById('import');
    const importFile = document.getElementById('importFile');

    let editId = null; // if editing

    function render(){
      // header
      const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
      currentMonthEl.textContent = monthNames[viewMonth] + ' ' + viewYear;

      // build calendar grid starting from monday
      calendarEl.innerHTML = '';
      // weekday headers
      const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      weekdays.forEach(w => {
        const h = document.createElement('div'); h.className='day card'; h.style.minHeight='28px'; h.style.display='flex'; h.style.alignItems='center'; h.style.justifyContent='center'; h.style.fontWeight='700'; h.textContent = w; calendarEl.appendChild(h);
      });

      const first = new Date(viewYear, viewMonth, 1);
      const startDay = (first.getDay() + 6) % 7; // monday=0
      const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

      // blank cells
      for(let i=0;i<startDay;i++){ const el = document.createElement('div'); el.className='day'; el.style.background='transparent'; el.style.boxShadow='none'; calendarEl.appendChild(el); }

      for(let d=1;d<=daysInMonth;d++){
        const el = document.createElement('div'); el.className='day card';
        const dateSpan = document.createElement('div'); dateSpan.className='date'; dateSpan.textContent = d;
        el.appendChild(dateSpan);
        const isoDate = `${viewYear}-${pad(viewMonth+1)}-${pad(d)}`;

        // find birthdays matching month-day or full date
        const items = birthdays.filter(b => {
          // stored format: {id,name,md: 'MM-DD', full: 'YYYY-MM-DD'?, note}
          const bmd = b.md; // 'MM-DD'
          return bmd === `${pad(viewMonth+1)}-${pad(d)}`;
        });
        items.forEach(b =>{
          const span = document.createElement('span'); span.className='birth'; span.textContent = b.name + (b.note? ' — '+b.note : '');
          span.onclick = () => openEdit(b.id);
          el.appendChild(span);
        });

        calendarEl.appendChild(el);
      }

      renderMonthList();
      renderUpcoming();
    }

    function renderMonthList(){
      monthList.innerHTML='';
      const monthKey = pad(viewMonth+1);
      const list = birthdays.filter(b => b.md.startsWith(monthKey));
      list.sort((a,b)=> a.md.localeCompare(b.md));
      if(!list.length) monthList.innerHTML = '<div class="small">Нет дней рождения в этом месяце</div>';
      list.forEach(b =>{
        const el = document.createElement('div'); el.className='item';
        el.innerHTML = `<div><strong>${b.name}</strong><div class="small">${b.md} ${b.note? ' • '+b.note: ''}</div></div>`;
        const act = document.createElement('div'); act.className='actions';
        const ebtn = document.createElement('button'); ebtn.textContent='Изм'; ebtn.onclick=()=>openEdit(b.id);
        const rbtn = document.createElement('button'); rbtn.className='ghost'; rbtn.textContent='Удал'; rbtn.onclick=()=>{ if(confirm('Удалить?')){ birthdays = birthdays.filter(x=>x.id!==b.id); saveAll(); render(); }}
        act.appendChild(ebtn); act.appendChild(rbtn);
        el.appendChild(act);
        monthList.appendChild(el);
      });
    }

    function renderUpcoming(){
      upcomingEl.innerHTML='';
      const today = new Date();
      const upcoming = birthdays.map(b=>{
        // find next occurrence year
        const [mm,dd] = b.md.split('-').map(Number);
        let year = today.getFullYear();
        const dateThis = new Date(year, mm-1, dd);
        if(dateThis < today) year++;
        const nextDate = new Date(year, mm-1, dd);
        const diffDays = Math.ceil((nextDate - today)/(24*3600*1000));
        return {b, nextDate, diffDays};
      }).sort((a,b)=> a.diffDays - b.diffDays).slice(0,10);

      if(!upcoming.length) upcomingEl.innerHTML = '<div class="small">Нет данных</div>';
      upcoming.forEach(it=>{
        const el = document.createElement('div'); el.className='item';
        el.innerHTML = `<div><strong>${it.b.name}</strong><div class="small">через ${it.diffDays} дн • ${it.b.md}</div></div>`;
        const act = document.createElement('div');
        const ebtn = document.createElement('button'); ebtn.textContent='Изм'; ebtn.onclick=()=>openEdit(it.b.id);
        act.appendChild(ebtn);
        el.appendChild(act);
        upcomingEl.appendChild(el);
      });
    }

    function openEdit(id){
      editId = id;
      const b = birthdays.find(x=>x.id===id);
      modalTitle.textContent = 'Изменить';
      bName.value = b.name; bDate.value = b.full || b.md; bNote.value = b.note || '';
      modalWrap.style.display='flex';
    }

    function openAdd(){ editId=null; modalTitle.textContent='Добавить'; bName.value=''; bDate.value=''; bNote.value=''; modalWrap.style.display='flex'; }

    function closeModal(){ modalWrap.style.display='none'; }

    function normalizeDateInput(s){
      s = s.trim();
      if(!s) return null;
      // accept YYYY-MM-DD or MM-DD
      if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){
        const parts = s.split('-').map(Number);
        return {full: `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`, md: `${pad(parts[1])}-${pad(parts[2])}`};
      }
      if(/^\d{1,2}-\d{1,2}$/.test(s)){
        const parts = s.split('-').map(Number);
        return {full: null, md: `${pad(parts[0])}-${pad(parts[1])}`};
      }
      return null;
    }

    saveBtn.addEventListener('click', ()=>{
      const name = bName.value.trim();
      const dateStr = bDate.value.trim();
      if(!name || !dateStr){ alert('Заполните имя и дату'); return; }
      const nd = normalizeDateInput(dateStr);
      if(!nd){ alert('Неправильный формат даты'); return; }
      if(editId){
        const idx = birthdays.findIndex(x=>x.id===editId);
        if(idx>=0){ birthdays[idx].name = name; birthdays[idx].md = nd.md; birthdays[idx].full = nd.full; birthdays[idx].note = bNote.value.trim(); }
      } else {
        const id = 'b_'+Date.now();
        birthdays.push({id, name, md: nd.md, full: nd.full, note: bNote.value.trim()});
      }
      saveAll(); closeModal(); render();
    });

    cancelBtn.addEventListener('click', closeModal);
    addBtn.addEventListener('click', openAdd);
    prevBtn.addEventListener('click', ()=>{ viewMonth--; if(viewMonth<0){ viewMonth=11; viewYear--; } render(); });
    nextBtn.addEventListener('click', ()=>{ viewMonth++; if(viewMonth>11){ viewMonth=0; viewYear++; } render(); });

    // Export
    exportBtn.addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(birthdays, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'birthdays.json'; a.click(); URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', ()=> importFile.click());
    importFile.addEventListener('change', ()=>{
      const f = importFile.files[0]; if(!f) return;
      const rdr = new FileReader(); rdr.onload = e=>{
        try{ const data = JSON.parse(e.target.result); if(Array.isArray(data)){ birthdays = data; saveAll(); render(); alert('Импорт завершён'); } else alert('Формат неверен'); }catch(err){ alert('Ошибка импорта'); }
      }; rdr.readAsText(f);
    });

    // initial render
    render();

    // simple helper: add test data if none (optional)
    // if(birthdays.length===0){ birthdays.push({id:'b_1', name:'Анна', md:'09-29', note:'Друг'}); saveAll(); render(); }
  </script>
</body>
</html>
