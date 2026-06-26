// js/app.js

let S = {
  subject: 'k1',
  studyList: [], studyCur: 0, studySel: null, studyShow: false, studyMode: 'study',
  examList: [], examCur: 0, examAns: {}, examSubject: 'k1',
  examTimer: null, examLeft: 2700, lastSub: 'k1'
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('qrImg').src = QR_IMAGE
  if (localStorage.getItem('isUnlocked') === '1') showMain()
  else show('lockPage')
})

// 解锁
function tryUnlock() {
  const code = document.getElementById('codeInput').value.toUpperCase().trim()
  const err = document.getElementById('codeError')
  if (!code) { err.textContent = '请输入解锁码'; return }
  const used = JSON.parse(localStorage.getItem('usedCodes') || '[]')
  if (used.includes(code)) { err.textContent = '该码已被使用过'; return }
  if (UNLOCK_CODES[code]) {
    used.push(code)
    localStorage.setItem('usedCodes', JSON.stringify(used))
    localStorage.setItem('isUnlocked', '1')
    localStorage.setItem('myCode', code)
    err.textContent = ''
    showMain()
  } else {
    err.textContent = '解锁码无效，请检查后重试'
    document.getElementById('codeInput').value = ''
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock() })

// 页面切换
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

function showMain() {
  show('mainPage')
  loadHome(); loadExamRecords(); loadWrong(); loadProfile()
}

function switchTab(tab) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.add('hidden'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById(tab + 'Page').classList.remove('hidden')
  document.getElementById('tab-' + tab).classList.add('active')
  if (tab === 'wrong') loadWrong()
  if (tab === 'profile') loadProfile()
  if (tab === 'exam') loadExamRecords()
}

// 题库
function getQs(subject, category) {
  let list = QUESTIONS_DATA.questions
  if (subject) list = list.filter(q => q.subject === subject)
  if (category) list = list.filter(q => q.category === category)
  return list
}

function getCats(subject) {
  const list = getQs(subject)
  return [...new Set(list.map(q => q.category))].map(c => ({
    name: c, total: list.filter(q => q.category === c).length
  }))
}

function switchSubject(s, el) {
  S.subject = s
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  loadHome()
}

function loadHome() {
  const cats = getCats(S.subject)
  document.getElementById('categoryList').innerHTML = cats.length
    ? cats.map((c, i) => `
      <div class="cat-item">
        <div class="cat-num">${i+1}</div>
        <div class="cat-info"><div class="cat-name">${c.name}</div><div class="cat-count">共 ${c.total} 题</div></div>
        <div class="cat-btns">
          <div class="cat-btn study" onclick="goStudy('${S.subject}','${c.name}')">刷题</div>
          <div class="cat-btn memorize" onclick="goMemorize('${S.subject}','${c.name}')">背题</div>
        </div>
      </div>`).join('')
    : '<div class="empty-box"><div class="ei">📚</div><div>暂无题目，请先导入题库</div></div>'
}

// 刷题
function goStudy(subject, category) {
  const list = getQs(subject, category)
  if (!list.length) { alert('暂无题目'); return }
  const saved = parseInt(localStorage.getItem(`pg_${subject}_${category}`) || '0')
  S.studyList = list; S.studyCur = saved < list.length ? saved : 0
  S.studySel = null; S.studyShow = false; S.studyMode = 'study'
  show('studyPage'); renderQ(); buildGrid()
}

function goMemorize(subject, category) {
  const list = getQs(subject, category)
  if (!list.length) { alert('暂无题目'); return }
  S.studyList = list; S.studyCur = 0
  S.studySel = null; S.studyShow = true; S.studyMode = 'memorize'
  show('studyPage'); renderQ(); buildGrid()
}

function renderQ() {
  const q = S.studyList[S.studyCur], total = S.studyList.length, cur = S.studyCur
  document.getElementById('studyProgress').textContent = `${cur+1}/${total}`
  document.getElementById('studyBar').style.width = `${(cur+1)/total*100}%`
  const tag = document.getElementById('qTag')
  tag.textContent = q.type === 'judge' ? '判断题' : '单选题'
  tag.className = 'q-tag' + (q.type === 'judge' ? '' : ' single')
  document.getElementById('qText').textContent = q.question
  const img = document.getElementById('qImg')
  q.image ? (img.src = q.image, img.style.display = 'block') : (img.style.display = 'none')
  document.getElementById('options').innerHTML = q.options.map(opt => {
    const l = opt[0], t = opt.slice(3)
    let cls = 'opt'
    if (S.studyShow) {
      if (l === q.answer) cls += ' correct'
      else if (l === S.studySel) cls += ' wrong'
    } else if (l === S.studySel) cls += ' selected'
    return `<div class="${cls}" onclick="pickStudy('${l}')"><div class="opt-letter">${l}</div><div class="opt-text">${t}</div></div>`
  }).join('')
  const expEl = document.getElementById('explanation')
  if (S.studyShow && q.explanation) {
    document.getElementById('expText').textContent = q.explanation
    expEl.classList.remove('hidden')
  } else expEl.classList.add('hidden')
  document.getElementById('nextBtn').textContent = cur >= total-1 ? '完成' : '下一题'
  updateGrid()
}

function pickStudy(l) {
  if (S.studyShow) return
  S.studySel = l
  const q = S.studyList[S.studyCur]
  if (l !== q.answer) addWrong(q.id)
  else removeWrong(q.id)
  S.studyShow = true; renderQ()
}

function prevQ() {
  if (S.studyCur <= 0) return
  S.studyCur--; S.studySel = null; S.studyShow = S.studyMode === 'memorize'
  saveProgress(); renderQ()
}

function nextQ() {
  if (S.studyCur >= S.studyList.length - 1) {
    if (confirm('已完成本章！重新开始？')) { S.studyCur = 0; S.studySel = null; S.studyShow = S.studyMode === 'memorize'; renderQ() }
    return
  }
  S.studyCur++; S.studySel = null; S.studyShow = S.studyMode === 'memorize'
  saveProgress(); renderQ()
}

function saveProgress() {
  const q = S.studyList[0]
  if (q) localStorage.setItem(`pg_${q.subject}_${q.category}`, S.studyCur)
}

function backFromStudy() { saveProgress(); showMain() }

// 答题卡
function buildGrid() {
  document.getElementById('gridWrap').innerHTML = S.studyList.map((_, i) =>
    `<div class="grid-cell${i === S.studyCur ? ' current' : ''}" onclick="jumpStudy(${i})">${i+1}</div>`
  ).join('')
}
function updateGrid() {
  document.querySelectorAll('#gridWrap .grid-cell').forEach((c, i) => {
    c.className = 'grid-cell' + (i === S.studyCur ? ' current' : '')
  })
}
function toggleGrid() {
  document.getElementById('gridOverlay').classList.toggle('hidden')
  document.getElementById('gridPanel').classList.toggle('hidden')
}
function jumpStudy(i) {
  S.studyCur = i; S.studySel = null; S.studyShow = S.studyMode === 'memorize'
  toggleGrid(); renderQ()
}

// 考试
function startExam(subject) {
  let pool = QUESTIONS_DATA.questions
  if (subject === 'k1') pool = pool.filter(q => q.subject === 'k1')
  else if (subject === 'k4') pool = pool.filter(q => q.subject === 'k4')
  pool = [...pool].sort(() => Math.random() - 0.5).slice(0, 45)
  if (!pool.length) { alert('题库为空，请先导入题目'); return }
  S.examList = pool; S.examCur = 0; S.examAns = {}
  S.examSubject = subject; S.examLeft = 2700; S.lastSub = subject
  show('examRoom'); renderExamQ(); buildExamGrid(); startTimer()
}

function renderExamQ() {
  const q = S.examList[S.examCur], cur = S.examCur, total = S.examList.length
  document.getElementById('examQNum').textContent = `第 ${cur+1} 题`
  const tag = document.getElementById('examTag')
  tag.textContent = q.type === 'judge' ? '判断题' : '单选题'
  tag.className = 'q-tag' + (q.type === 'judge' ? '' : ' single')
  document.getElementById('examQText').textContent = q.question
  document.getElementById('examBar').style.width = `${(cur+1)/total*100}%`
  document.getElementById('examFoot').textContent = `${cur+1}/${total}`
  const img = document.getElementById('examQImg')
  q.image ? (img.src = q.image, img.style.display = 'block') : (img.style.display = 'none')
  const sel = S.examAns[cur]
  document.getElementById('examOptions').innerHTML = q.options.map(opt => {
    const l = opt[0], t = opt.slice(3)
    return `<div class="opt${sel === l ? ' selected' : ''}" onclick="pickExam('${l}')">
      <div class="opt-letter${sel === l ? ' selected' : ''}">${l}</div>
      <div class="opt-text">${t}</div></div>`
  }).join('')
  document.getElementById('examInfo').textContent = `已答 ${Object.keys(S.examAns).length}/${total}`
  updateExamGrid()
}

function pickExam(l) { S.examAns[S.examCur] = l; renderExamQ() }
function examPrev() { if (S.examCur > 0) { S.examCur--; renderExamQ() } }
function examNext() { if (S.examCur < S.examList.length-1) { S.examCur++; renderExamQ() } }

function startTimer() {
  if (S.examTimer) clearInterval(S.examTimer)
  S.examTimer = setInterval(() => {
    S.examLeft--
    const m = String(Math.floor(S.examLeft/60)).padStart(2,'0')
    const s = String(S.examLeft%60).padStart(2,'0')
    const el = document.getElementById('examTimer')
    el.textContent = `${m}:${s}`
    el.className = S.examLeft < 300 ? 'exam-timer warn' : 'exam-timer'
    if (S.examLeft <= 0) { clearInterval(S.examTimer); doSubmit() }
  }, 1000)
}

function confirmSubmit() {
  const un = S.examList.length - Object.keys(S.examAns).length
  if (un > 0 && !confirm(`还有 ${un} 题未答，确认交卷？`)) return
  doSubmit()
}

function doSubmit() {
  clearInterval(S.examTimer)
  let correct = 0, wrong = 0, skip = 0
  S.examList.forEach((q, i) => {
    const a = S.examAns[i]
    if (!a) { skip++; return }
    if (a === q.answer) correct++
    else { wrong++; addWrong(q.id) }
  })
  const score = Math.round(correct / S.examList.length * 100)
  const passed = score >= 90
  const records = JSON.parse(localStorage.getItem('examRecords') || '[]')
  records.unshift({ score, correct, wrong, skip, total: S.examList.length, passed, time: new Date().toLocaleString() })
  if (records.length > 20) records.pop()
  localStorage.setItem('examRecords', JSON.stringify(records))
  showResult(score, correct, wrong, skip, passed)
}

function buildExamGrid() {
  document.getElementById('examGridWrap').innerHTML = S.examList.map((_, i) =>
    `<div class="grid-cell" id="eg${i}" onclick="jumpExam(${i})">${i+1}</div>`
  ).join('')
}
function updateExamGrid() {
  S.examList.forEach((_, i) => {
    const el = document.getElementById(`eg${i}`)
    if (!el) return
    el.className = 'grid-cell' + (i === S.examCur ? ' current' : S.examAns[i] ? ' answered' : '')
  })
}
function toggleExamGrid() {
  document.getElementById('examGridOverlay').classList.toggle('hidden')
  document.getElementById('examGridPanel').classList.toggle('hidden')
  updateExamGrid()
}
function jumpExam(i) { S.examCur = i; toggleExamGrid(); renderExamQ() }

// 结果
function showResult(score, correct, wrong, skip, passed) {
  show('resultPage')
  document.getElementById('resultHero').className = passed ? 'result-hero' : 'result-hero fail'
  document.getElementById('rEmoji').textContent = passed ? '🎉' : '😅'
  document.getElementById('rScore').textContent = score
  document.getElementById('rText').textContent = passed ? '恭喜通过！' : '未通过，继续加油！'
  document.getElementById('rCorrect').textContent = correct
  document.getElementById('rWrong').textContent = wrong
  document.getElementById('rSkip').textContent = skip
  document.getElementById('rTotal').textContent = S.examList.length
  document.getElementById('gWrongBtn').textContent = wrong > 0 ? `查看错题（${wrong}题）` : '查看错题'
}
function retryExam() { startExam(S.lastSub) }
function goWrongResult() { showMain(); switchTab('wrong') }
function goHomeResult() { showMain() }

// 错题
function getWrongIds() { return JSON.parse(localStorage.getItem('wrongIds') || '[]') }
function addWrong(id) {
  const ids = getWrongIds()
  if (!ids.includes(id)) { ids.push(id); localStorage.setItem('wrongIds', JSON.stringify(ids)) }
}
function removeWrong(id) {
  localStorage.setItem('wrongIds', JSON.stringify(getWrongIds().filter(i => i !== id)))
}
function getWrongQs() {
  const ids = getWrongIds()
  return QUESTIONS_DATA.questions.filter(q => ids.includes(q.id))
}

function loadWrong() {
  const wrongs = getWrongQs()
  const el = document.getElementById('wrongContent')
  if (!wrongs.length) {
    el.innerHTML = '<div class="empty-box"><div class="ei">🎉</div><div>暂无错题！</div></div>'
    return
  }
  el.innerHTML = `<div class="wrong-start" onclick="startWrongStudy()">开始复习错题 ${wrongs.length} 题 →</div>` +
    wrongs.map(q => `
      <div class="wrong-item">
        <div class="wrong-q">${q.question}</div>
        ${q.image ? `<img class="wrong-q-img" src="${q.image}">` : ''}
        <div class="wrong-ans">正确答案：<strong>${q.answer}. ${q.answer_text || ''}</strong></div>
        <div class="wrong-remove" onclick="rmWrong(${q.id})">移除</div>
      </div>`).join('')
}

function rmWrong(id) { if (confirm('移除此题？')) { removeWrong(id); loadWrong() } }

function startWrongStudy() {
  const ws = getWrongQs(); if (!ws.length) return
  S.studyList = ws; S.studyCur = 0; S.studySel = null
  S.studyShow = false; S.studyMode = 'study'
  show('studyPage'); renderQ(); buildGrid()
}

// 考试记录
function loadExamRecords() {
  const records = JSON.parse(localStorage.getItem('examRecords') || '[]')
  const el = document.getElementById('examRecords')
  if (!records.length) {
    el.innerHTML = '<div class="empty-box" style="padding:24px 0"><div class="ei">📝</div><div>暂无记录</div></div>'
    return
  }
  el.innerHTML = records.slice(0, 5).map(r => `
    <div class="record-item">
      <div class="record-score ${r.passed?'pass':'fail'}">${r.score}</div>
      <div>
        <div>${r.passed ? '✅ 通过' : '❌ 未通过'}</div>
        <div class="record-detail">对${r.correct} 错${r.wrong} 空${r.skip}</div>
        <div class="record-time">${r.time}</div>
      </div>
    </div>`).join('')
}

// 我的
function loadProfile() {
  const code = localStorage.getItem('myCode') || ''
  const wrongs = getWrongIds()
  document.getElementById('profileCode').textContent = code ? `解锁码：${code}` : ''
  document.getElementById('wrongCount').textContent = wrongs.length ? `${wrongs.length} 题` : ''
}

function clearWrong() {
  if (confirm('清空所有错题？')) { localStorage.setItem('wrongIds', '[]'); loadWrong(); loadProfile(); alert('已清空') }
}
function clearProgress() {
  if (confirm('重置所有学习进度？')) {
    Object.keys(localStorage).filter(k => k.startsWith('pg_')).forEach(k => localStorage.removeItem(k))
    alert('已重置')
  }
}
function logout() {
  if (confirm('退出后需重新输入解锁码，确认退出？')) { localStorage.removeItem('isUnlocked'); location.reload() }
}
