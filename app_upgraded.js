// app_upgraded.js - StudyLab upgraded with auth, admin, per-user results, deploy-ready features
(function(){
  const sections = window.EMBED_SECTIONS || [];
  // state
  let unlocked = false;
  let currentIndex = 0;
  let answers = {};
  let currentUser = null; // {id,email,name}
  const adminPassword = localStorage.getItem('study_admin_pwd') || 'admin8888';

  // storage helpers
  function saveAll(){
    localStorage.setItem('study_sections', JSON.stringify(sections));
  }
  function getUsers(){ return JSON.parse(localStorage.getItem('study_users')||'[]'); }
  function saveUsers(u){ localStorage.setItem('study_users', JSON.stringify(u)); }
  function getResults(){ return JSON.parse(localStorage.getItem('study_results')||'[]'); }
  function saveResults(r){ localStorage.setItem('study_results', JSON.stringify(r)); }

  // DOM refs
  const toc = document.getElementById('toc');
  const topicTitle = document.getElementById('topicTitle');
  const contentArea = document.getElementById('contentArea');
  const exercisesArea = document.getElementById('exercisesArea');
  const pwdInput = document.getElementById('pwd');
  const unlockBtn = document.getElementById('unlockBtn');
  const adminBtn = document.getElementById('adminBtn');
  const adminModal = document.getElementById('adminModal');
  const adminClose = document.getElementById('adminClose');
  const loginModal = document.getElementById('loginModal');
  const loginBtn = document.getElementById('loginBtn');
  const loginClose = document.getElementById('loginClose');
  const doLoginBtn = document.getElementById('doLoginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const userBadge = document.getElementById('userBadge');
  const countTopic = document.getElementById('countTopic');

  function renderTOC(){
    toc.innerHTML = '';
    sections.forEach((s,i)=>{
      const li = document.createElement('li');
      li.className = 'p-3 rounded-lg cursor-pointer ' + (i===currentIndex? 'bg-indigo-100 ring-2 ring-indigo-200':'');
      li.innerHTML = `<div class="font-semibold">${i+1}. ${s.title}</div><div class="text-xs text-slate-600 mt-1">${(s.theory||'').slice(0,120)}...</div>`;
      li.addEventListener('click', ()=>{ currentIndex = i; render(); });
      toc.appendChild(li);
    });
    countTopic.innerText = sections.length;
  }

  function render(){
    renderTOC();
    const s = sections[currentIndex] || {title:'', theory:'', exercises:[]};
    topicTitle.innerText = (currentIndex+1)+'. '+s.title;
    contentArea.innerHTML = '<div>'+ (s.theory||'').replace(/\n/g,'<br/>') + '</div>';
    renderExercises();
    userBadge.innerText = currentUser ? `Đăng nhập: ${currentUser.name || currentUser.email}` : 'Bạn đang ở chế độ Khách';
  }

  function renderExercises(){
    exercisesArea.innerHTML = '<h4 class="font-semibold text-lg">Bài tập</h4>';
    const s = sections[currentIndex];
    if(!s || !s.exercises || s.exercises.length===0){
      exercisesArea.innerHTML += '<div class="text-sm text-slate-600">Chưa có bài tập.</div>';
      return;
    }
    const ol = document.createElement('ol'); ol.className='mt-3 space-y-4';
    s.exercises.forEach((q, idx)=>{
      const li = document.createElement('li'); li.className='p-4 rounded-lg shadow-sm bg-white';
      li.innerHTML = `<div class="font-medium">${idx+1}. ${q.question}</div><div class="mt-2 grid grid-cols-2 gap-2" data-qid="${q.id}"></div>`;
      const grid = li.querySelector('[data-qid]');
      q.choices.forEach((c,ci)=>{
        const btn = document.createElement('button');
        btn.className = 'text-left p-2 rounded border';
        btn.innerHTML = `<div class="font-semibold">${String.fromCharCode(65+ci)}.</div><div class="text-sm">${c}</div><div class="mt-1 text-xs result"></div>`;
        btn.addEventListener('click', ()=>{ answers[q.id]=ci; renderExercises(); });
        if(answers[q.id]===ci) btn.classList.add('ring-2','ring-indigo-300');
        grid.appendChild(btn);
      });
      ol.appendChild(li);
    });
    exercisesArea.appendChild(ol);
  }

  unlockBtn.addEventListener('click', ()=>{
    if(pwdInput.value === '8888'){ unlocked = true; alert('Mở khóa thành công — bạn có thể làm bài.'); } else { alert('Mật khẩu sai.'); }
  });

  // Login / Register
  loginBtn.addEventListener('click', ()=>{ loginModal.classList.remove('hidden'); loginModal.classList.add('flex'); });
  loginClose.addEventListener('click', ()=>{ loginModal.classList.add('hidden'); loginModal.classList.remove('flex'); });
  registerBtn.addEventListener('click', ()=>{
    const email = emailInput.value.trim(); const pwd = passwordInput.value;
    if(!email || !pwd) return alert('Nhập email và mật khẩu.');
    const users = getUsers();
    if(users.some(u=> u.email===email)) return alert('Email đã đăng ký.');
    const id = Date.now();
    users.push({id, email, name: email.split('@')[0], pwd: btoa(pwd)});
    saveUsers(users);
    alert('Đăng ký thành công. Bạn có thể đăng nhập.');
  });
  doLoginBtn.addEventListener('click', ()=>{
    const email = emailInput.value.trim(); const pwd = passwordInput.value;
    const users = getUsers();
    const u = users.find(x=> x.email===email && x.pwd===btoa(pwd));
    if(!u) return alert('Email hoặc mật khẩu không đúng.');
    currentUser = {id: u.id, email: u.email, name: u.name};
    loginModal.classList.add('hidden'); loginModal.classList.remove('flex');
    render();
  });

  // Admin modal
  adminBtn.addEventListener('click', ()=>{
    const code = prompt('Nhập mật khẩu quản trị:');
    if(code === localStorage.getItem('study_admin_pwd') || code === 'admin8888'){
      adminModal.classList.remove('hidden'); adminModal.classList.add('flex');
      renderAdminLists();
    } else alert('Mật khẩu quản trị sai.');
  });
  adminClose.addEventListener('click', ()=>{ adminModal.classList.add('hidden'); adminModal.classList.remove('flex'); });

  // Admin functions: users, results, backup, import, export zip
  const userListEl = document.getElementById('userList');
  const resultsTable = document.getElementById('resultsTable');
  function renderAdminLists(){
    const users = getUsers();
    userListEl.innerHTML = users.map(u=> `<div class="p-2 border-b flex justify-between items-center"><div><div class="font-semibold">${u.name}</div><div class="text-xs text-slate-600">${u.email}</div></div><div><button data-id="${u.id}" class="delUser px-2 py-1 bg-red-300 rounded">Xóa</button> <button data-id="${u.id}" class="impUser px-2 py-1 bg-emerald-200 rounded">Đóng vai</button></div></div>`).join('') || '<div class="text-sm text-slate-600">Chưa có học viên.</div>';
    document.querySelectorAll('.delUser').forEach(b=> b.addEventListener('click', ()=>{ const id = +b.dataset.id; if(confirm('Xóa học viên?')){ const users = getUsers().filter(x=> x.id!==id); saveUsers(users); renderAdminLists(); } }));
    document.querySelectorAll('.impUser').forEach(b=> b.addEventListener('click', ()=>{ const id = +b.dataset.id; const users = getUsers(); const u = users.find(x=> x.id===id); if(u){ currentUser = {id:u.id, email:u.email, name:u.name}; render(); alert('Bạn đang đóng vai: '+u.email); adminModal.classList.add('hidden'); adminModal.classList.remove('flex'); } }));
    const results = getResults();
    resultsTable.innerHTML = results.length ? `<table class="w-full text-xs"><thead><tr class="text-left"><th>Học viên</th><th>Thời gian</th><th>Chủ đề</th><th>Score</th></tr></thead><tbody>${results.map(r=> `<tr><td>${(getUsers().find(u=>u.id===r.userId)||{name:'(Khách)'}).name}</td><td>${r.time}</td><td>${r.section}</td><td>${r.score!=null? r.score+'/'+r.total : 'N/A'}</td></tr>`).join('')}</tbody></table>` : '<div class="text-sm text-slate-600">Chưa có kết quả.</div>';
  }

  // Add user manually (admin)
  document.getElementById('addUserBtn').addEventListener('click', ()=>{
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    if(!email || !name) return alert('Nhập tên + email.');
    const users = getUsers();
    if(users.some(u=> u.email===email)) return alert('Email đã tồn tại.');
    const id = Date.now();
    users.push({id, name, email, pwd: btoa('123456')});
    saveUsers(users); renderAdminLists(); alert('Thêm học viên thành công (mật khẩu mặc định 123456).');
  });

  // Submit answers & save per-user result
  document.getElementById('submitBtn').addEventListener('click', ()=>{
    if(!unlocked) return alert('Bạn cần mở khóa bằng mật khẩu 8888 để nộp bài.');
    const s = sections[currentIndex];
    let score = 0;
    s.exercises.forEach(q=>{ const chosen = answers[q.id]; if(chosen===q.correctIndex) score++; });
    document.getElementById('scoreDisplay').innerText = `Điểm của bạn: ${score}/${s.exercises.length}`;
    const res = getResults();
    res.push({userId: currentUser? currentUser.id:null, time: new Date().toISOString(), section: currentIndex, score, total: s.exercises.length});
    saveResults(res); renderAdminLists();
    alert('Nộp bài xong — kết quả đã được lưu.');
  });

  // Save result button saves current answers snapshot
  document.getElementById('saveResultBtn').addEventListener('click', ()=>{
    const res = getResults();
    res.push({userId: currentUser? currentUser.id:null, time: new Date().toISOString(), section: currentIndex, answers});
    saveResults(res); alert('Đã lưu snapshot câu trả lời.'); renderAdminLists();
  });

  // Export results (per user) and all
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const lst = getResults();
    if(!lst.length) return alert('Chưa có kết quả.');
    const blob = new Blob([JSON.stringify(lst, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'study_results.json'; a.click();
  });
  document.getElementById('exportAllBtn').addEventListener('click', ()=>{
    const results = getResults();
    if(!results.length) return alert('Chưa có kết quả.');
    const rows = [['userId','userName','time','section','score','total']];
    results.forEach(r=> { const u = getUsers().find(x=> x.id===r.userId); rows.push([r.userId||'', u?u.name:'(Khách)', r.time, r.section, r.score||'', r.total||'']); });
    const csv = rows.map(r=> r.map(c=> JSON.stringify(c||'')).join(',')).join('\\n');
    const blob = new Blob([csv], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'all_results.csv'; a.click();
  });

  // Backup / import json
  document.getElementById('backupBtn').addEventListener('click', ()=>{
    const data = {sections, users: getUsers(), results: getResults()};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup_study_full.json'; a.click();
  });
  document.getElementById('importJson').addEventListener('change', (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader(); reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if(parsed.sections) { parsed.sections.forEach((s,i)=> sections[i]=s); }
        if(parsed.users) saveUsers(parsed.users);
        if(parsed.results) saveResults(parsed.results);
        saveAll(); alert('Import hoàn tất.'); render(); renderAdminLists();
      }catch(err){ alert('Import lỗi: '+err.message); }
    }; reader.readAsText(f);
  });

  // Export ZIP client-side (minimal) - create a deploy-ready bundle with embedded data
  document.getElementById('adminExportZip').addEventListener('click', async ()=>{
    const zip = new JSZip();
    const index = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyLab Export</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script>window.EMBED_SECTIONS=${JSON.stringify(sections)};window.EMBED_USERS=${JSON.stringify(getUsers())};window.EMBED_RESULTS=${JSON.stringify(getResults())};</script><script>console.log('Embedded data ready');</script></body></html>`;
    zip.file('index.html', index);
    const content = await zip.generateAsync({type:'blob'});
    saveAs(content, 'studylab_export_bundle.zip');
  });

  // initial render
  render();

  // attach JSZip and FileSaver libs lazily for export functionality if needed
  // (in deploy package, we include these scripts in index)
})();