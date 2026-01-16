// ===== Identity × Card-Game Pilot =====


// ---------- CONFIG ----------
const PROLIFIC_COMPLETION_URL = ""; // optional
const UPLOAD_URL = "https://script.google.com/macros/s/AKfycbw7zn875unrEtlxV2o0KzJPwfGOleJ2_IeTKStsAqDFULLmw80SNORB7z8xSaWGqdYA/exec";
const SHOW_DOWNLOAD = false;
const COUNTERBALANCE = true;   // 50/50 US↔KR
const N_TRIALS_PER_BLOCK = 4; // per identity block (card task is secondary; keeps runtime ~10–15 min)

document.title = "The Choice Study"; // tab title

// ---------- helpers ----------
const BTN = (choice) => `<button class="jspsych-btn">${choice}</button>`;

function downloadCSV(filename, csvText){
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
}

// Robust uploader: Attempt A = raw JSON; fallback B = form-encoded
async function postJSON(url, payload){
  if(!url) return false;
  const json = JSON.stringify(payload);
  try {
    await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: json });
    return true;
  } catch(e) { console.warn('Upload attempt A failed, trying B', e); }
  try {
    const body = new URLSearchParams({ payload: json });
    await fetch(url, { method:'POST', body });
    return true;
  } catch(err) { console.error('Upload attempt B failed:', err); return false; }
}

// ---------- jsPsych init ----------
const urlParams = new URLSearchParams(window.location.search);
const RESEARCHER_VIEW = (urlParams.get('researcher') === '1') || (urlParams.get('debug') === '1');

const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  override_safe_mode: true,
  on_data_update: d => { const iso = new Date().toISOString(); d.timestamp = iso; d.trial_timestamp = iso; },
  on_finish: function(){
    const pid   = jsPsych.data.get().first(1).values()[0]?.participant_id || 'anon';
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const csv   = jsPsych.data.get().csv();
    const filename = `identity_card_${pid}_${stamp}.csv`;

    const payload = { records: jsPsych.data.get().values(), csv, filename, meta: { pid, run_id, ts: new Date().toISOString() } };
    postJSON(UPLOAD_URL, payload).finally(()=>{
      const el = document.getElementById('jspsych-target');
      let buttons = PROLIFIC_COMPLETION_URL ? '<button id="prolific">Return to Prolific</button>' : '';
      if (SHOW_DOWNLOAD || RESEARCHER_VIEW) buttons = `<button id="dl">Download CSV</button>` + buttons;
      el.innerHTML = `<h2>Thank you!</h2>${buttons}`;
      if (SHOW_DOWNLOAD || RESEARCHER_VIEW) document.getElementById('dl')?.addEventListener('click', ()=> downloadCSV(filename, csv));
      const pb = document.getElementById('prolific'); if(pb){ pb.onclick = ()=> window.location.href = PROLIFIC_COMPLETION_URL; }
    });
  }
});

// ---------- session meta (local sequential IDs) ----------
(function ensureSequentialPID(){
  const n = (parseInt(localStorage.getItem('icg_pid_counter') || '0', 10) || 0) + 1;
  localStorage.setItem('icg_pid_counter', String(n));
  const participant_id_local = `participant${String(n).padStart(2,'0')}`;
  window.run_id = participant_id_local + '-' + Date.now();
  jsPsych.data.addProperties({ participant_id: participant_id_local, run_id, session_start_iso: new Date().toISOString() });
})();

// ---------- viewport sanity ----------
(function(){
  const w = window.innerWidth, h = window.innerHeight;
  if (Math.min(w,h) < 320){
    document.getElementById('jspsych-target').innerHTML =
      '<h3>Please rotate your phone to landscape or use a larger screen to continue.</h3>';
    throw new Error('Viewport too small');
  }
})();

// ---------- PRIMING assets ----------
const primes = [
  { identity:"Host", lang:"en", images:[
    "stimuli/host1.jpg","stimuli/host2.jpg","stimuli/host3.jpg","stimuli/host4.jpg",
    "stimuli/host5.jpg","stimuli/host6.jpg","stimuli/host7.jpg","stimuli/host8.jpg"
  ]},
  { identity:"Heritage", lang:"ko", images:[
    "stimuli/heritage1.jpg","stimuli/heritage2.jpg","stimuli/heritage3.jpg","stimuli/heritage4.jpg",
    "stimuli/heritage5.jpg","stimuli/heritage6.jpg","stimuli/heritage7.jpg","stimuli/heritage8.jpg"
  ]}
];

// ---------- PRIME SCREENS ----------
function primeSlideshow(p){
  const pages = p.images.map(src => `<div style="text-align:center"><img class="prime" src="${src}" style="max-width:85%;max-height:55vh;border-radius:10px"></div>`);
  return {
    type: jsPsychInstructions,
    pages, show_clickable_nav: true, allow_backward: false,
    button_label_next: (p.lang==='ko') ? '다음' : 'Next',
    data: {task:'prime_slideshow', identity:p.identity}
  };
}
function primePrompts(p){
  const isKor = (p.lang === 'ko');
  const preamble = isKor ? "<h3>짧은 질문</h3>" : "<h3>Short prompts</h3>";
  const questions = isKor ? [
    {name:'heritage_sentence', prompt:`<strong>한국</strong>에서의 삶/가족/공동체와 관련된 기억을 한 문장으로 적어주세요.`, required:true},
    {name:'heritage_word',     prompt:`<strong>한국인 정체성</strong>을 떠올릴 때 가장 먼저 떠오르는 단어 1개:`, required:true}
  ] : [
    {name:'host_sentence', prompt:`Write one sentence about a moment you felt most connected to life <strong>in the US</strong>.`, required:true},
    {name:'host_word',     prompt:`Write <strong>one word</strong> that captures what being <strong>American</strong> means to you.`, required:true}
  ];
  return {
    type: jsPsychSurveyText, preamble, questions,
    data:{task:'prime_prompts', identity:p.identity},
    on_finish: (d)=>{ const r = d.response || {}; Object.keys(r).forEach(k => { d[k] = (r[k] || '').trim(); }); }
  };
}
function primeCheck(p){
  const isKo = (p.lang === 'ko');

  // 0–100 salience (typed)
  const salience = {
    type: jsPsychSurveyText,
    preamble: isKo ? `<h3>현재 느낌</h3><p>아래 질문에 <strong>0–100</strong> 숫자로 답해 주세요.</p>`
                   : `<h3>Right now</h3><p>Please answer using a number from <strong>0–100</strong>.</p>`,
    questions: isKo ? [
      {name:'sal_host',     prompt:'지금 <strong>미국 문화/정체성</strong>이 얼마나 떠오르나요? (0–100)', required:true},
      {name:'sal_heritage', prompt:'지금 <strong>한국 문화/정체성</strong>이 얼마나 떠오르나요? (0–100)', required:true}
    ] : [
      {name:'sal_host',     prompt:'How mentally “present” does <strong>American</strong> culture/identity feel right now? (0–100)', required:true},
      {name:'sal_heritage', prompt:'How mentally “present” does <strong>Korean</strong> culture/identity feel right now? (0–100)', required:true}
    ],
    data: {task:'prime_salience', identity:p.identity},
    on_finish: (d)=>{
      const r = d.response || {};
      const parse0100 = (x)=>{
        const v = parseInt(String(x||'').trim(), 10);
        return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
      };
      d.sal_host = parse0100(r.sal_host);
      d.sal_heritage = parse0100(r.sal_heritage);
      d.sal_diff_host_minus_heritage = (d.sal_host===null || d.sal_heritage===null) ? null : (d.sal_host - d.sal_heritage);
    }
  };

  // 6-item state self-construal + attention check
  const labels = ['1','2','3','4','5','6','7'];
  const sc = {
    type: jsPsychSurveyLikert,
    preamble: isKo ? `<p><strong>지금 이 순간</strong> 당신에게 더 가까운 정도를 선택해 주세요.</p>`
                   : `<p>Please indicate how much each statement fits <strong>right now</strong>.</p>`,
    questions: isKo ? [
      {name:'ind1', prompt:'지금 나는 다른 사람들과는 <strong>구별되는 나 자신</strong>으로 느껴진다.', labels, required:true},
      {name:'ind2', prompt:'지금 나는 내 선택을 <strong>스스로</strong> 결정하고 싶다.', labels, required:true},
      {name:'ind3', prompt:'지금 나는 내가 원하는 것을 <strong>우선</strong>하고 싶다.', labels, required:true},
      {name:'int1', prompt:'지금 나는 중요한 사람들과의 <strong>조화</strong>를 유지하는 것이 중요하다.', labels, required:true},
      {name:'int2', prompt:'지금 나는 내가 속한 집단/가족의 기대를 <strong>의식</strong>한다.', labels, required:true},
      {name:'int3', prompt:'지금 나는 다른 사람들의 필요를 <strong>함께 고려</strong>한다.', labels, required:true},
      {name:'ac',   prompt:'주의 확인: 여기서는 <strong>4</strong>를 선택해주세요.', labels, required:true}
    ] : [
      {name:'ind1', prompt:'Right now I feel like a <strong>distinct individual</strong>.', labels, required:true},
      {name:'ind2', prompt:'Right now I want to make decisions <strong>on my own</strong>.', labels, required:true},
      {name:'ind3', prompt:'Right now I want to prioritise <strong>my own preferences</strong>.', labels, required:true},
      {name:'int1', prompt:'Right now maintaining <strong>harmony</strong> with important others feels important.', labels, required:true},
      {name:'int2', prompt:'Right now I am aware of <strong>group/family expectations</strong>.', labels, required:true},
      {name:'int3', prompt:'Right now I naturally consider <strong>others’ needs</strong> alongside mine.', labels, required:true},
      {name:'ac',   prompt:'Attention check: please select option <strong>4</strong>.', labels, required:true}
    ],
    data: {task:'prime_selfconstrual', identity:p.identity},
    on_finish: (d)=>{
      const r = d.response || {};
      const to1to7 = (x)=> (typeof x === 'number') ? (x + 1) : null; // jsPsych returns 0–6
      const ind = [to1to7(r.ind1), to1to7(r.ind2), to1to7(r.ind3)];
      const inte = [to1to7(r.int1), to1to7(r.int2), to1to7(r.int3)];
      const mean = (arr)=> arr.every(v=>typeof v==='number') ? (arr.reduce((a,b)=>a+b,0)/arr.length) : null;

      d.ind_mean = mean(ind);
      d.int_mean = mean(inte);
      d.sc_state_int_minus_ind = (d.int_mean===null || d.ind_mean===null) ? null : (d.int_mean - d.ind_mean);

      // attention check: option "4" corresponds to index 3 (0-based)
      d.attention_ok = (r.ac === 3) ? 1 : 0;
      d.flag_attention_fail = (d.attention_ok === 1) ? 0 : 1;
    }
  };

  return { timeline: [salience, sc] };
}

// ---------- Balanced 16 trials ----------
function buildOrthogonalTrials16(){
  const AI = [-8,-4,0,4,8], RI = [-4,0,4];
  const trials = [];
  for (const ai of AI){ for (const ri of RI){ trials.push({AI: ai, RI: ri, selfAmt: ai, partnerAmt: ai - ri}); } }
  trials.push({AI: 0, RI: 2, selfAmt: 0, partnerAmt: -2});
  for (let i = trials.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [trials[i], trials[j]] = [trials[j], trials[i]]; }
  return trials;
}

// Sample N trials from the balanced set (keeps runtime manageable)
function buildTrialsN(n){
  const base = buildOrthogonalTrials16();
  const k = Math.max(1, Math.min(base.length, n||base.length));
  return base.slice(0, k);
}

// ---------- Start pages

// ---------- Start pages (participant-neutral copy) ----------
function blockStartPage(identity, lang, position){
  const isFirst = (position === 1);
  const isKo = (lang === 'ko');
  const title = isKo ? '시작하기' : 'Start';
  const part = isKo ? (isFirst ? '1부 (총 2부 중)' : '2부 (총 2부 중)') : (isFirst ? 'Part 1 of 2' : 'Part 2 of 2');

  const lines = isKo
    ? (isFirst
        ? ['이 부분은 이미지/짧은 질문으로 시작합니다.','이후 <strong>신뢰 게임</strong>을 하고, 마지막에 짧은 <strong>카드 과제</strong>가 이어집니다.','총 소요 시간은 약 10–15분입니다.']
        : ['이 부분도 동일한 흐름입니다: 이미지/질문 → <strong>신뢰 게임</strong> → 짧은 <strong>카드 과제</strong>.','지금 느끼는 대로 자연스럽게 응답해 주세요.',''])
    : (isFirst
        ? ['This part begins with images and brief questions.','Then you will complete a short <strong>trust game</strong>, followed by a short <strong>card task</strong>.','Total time is about 10–15 minutes.']
        : ['This part follows the same flow: images/questions → <strong>trust game</strong> → short <strong>card task</strong>.','Please respond naturally, based on how you feel right now.','']);

  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h3>${title} — ${part}</h3><p>${lines[0]} ${lines[1]}</p>${lines[2] ? `<p>${lines[2]}</p>` : ''}`,
    choices: [isKo ? '시작' : 'Begin'],
    button_html: BTN,
    data: {task:'block_start', identity, lang, block_position: position}
  };
}

// ---------- Neutral reset (10s) ----------
function neutralReset(positionCompleted){
  return [
    { type: jsPsychHtmlButtonResponse, stimulus:`<h3>Short pause</h3><p>We’ll take a brief <strong>10-second</strong> reset before the next part.</p>`,
      choices:['Start timer'], button_html: BTN, data:{task:'reset_intro', after_part: positionCompleted} },
    { type: jsPsychHtmlKeyboardResponse, stimulus:`<h3>Reset</h3><p>Look at the screen and relax your breathing. The next part begins automatically.</p>`,
      choices:"NO_KEYS", trial_duration:10000, data:{task:'reset_timer', after_part: positionCompleted} }
  ];
}

// ---------- KR comfort/skip ----------
let allowKorean = true;
function koHandoffTrial(position){
  const part = position===1 ? 'Part 1 of 2' : 'Part 2 of 2';
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h3>${part} — Korean section notice</h3>
      <p>The next section is in <strong>Korean</strong>. Please continue.</p>
      <hr style="margin:10px 0">
      <p><strong>한국어 구간 안내</strong></p>
      <p>다음 화면은 한국어로 진행됩니다. 계속 진행해 주세요.</p>`,
    choices: ['Continue / 계속'],
    button_html: BTN,
    data: {task:'section_transition', identity:'Heritage', block_position: position},
    on_finish: (d)=> { allowKorean = true; d.skipped_korean = 0; }
  };
}

// ---------- Card visuals (CSS-only, plugin-safe) ----------
function ensureCardCSS(){
  if (document.getElementById('card-css')) return;
  const css = `
    .jspsych-btn-group-flex{display:flex;gap:16px;justify-content:center;align-items:center;flex-wrap:wrap;margin:18px 0 8px}
    .jspsych-btn.card-btn{
      width:140px;height:180px;border-radius:16px;border:1px solid #d0d0d0;
      box-shadow:0 2px 10px rgba(0,0,0,.06);background:#fff;display:flex;flex-direction:column;
      align-items:center;justify-content:center;font-size:16px
    }
    .jspsych-btn.card-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
    .jspsych-btn.card-btn::before{content:"🂠";display:block;font-size:42px;line-height:1;margin-bottom:10px;opacity:.85}
    @media (max-width:480px){
      .jspsych-btn.card-btn{width:110px;height:150px;font-size:14px}
      .jspsych-btn.card-btn::before{font-size:36px}
    }
  `;
  const tag = document.createElement('style');
  tag.id = 'card-css';
  tag.textContent = css;
  document.head.appendChild(tag);
}

function cardChoiceScreen(identity, lang, params){
  ensureCardCSS();
  const isKo = (lang==='ko');
  const labels = isKo ? ['왼쪽','가운데','오른쪽'] : ['Left','Middle','Right'];
  const stim = isKo
    ? `<h3>카드 선택</h3><p>세 장의 카드 중 하나를 고르세요.</p>`
    : `<h3>Choose a card</h3><p>Pick one of the three hidden cards.</p>`;

  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: stim,
    choices: labels,
    button_layout: 'flex',
    button_html: (choice) => `<button class="jspsych-btn card-btn">${choice}</button>`,
    data: Object.assign({ task:'card_pick', identity, lang }, (params||{})),
  };
}

function ownOutcomeReveal(identity, lang, params){
  const isKo = (lang==='ko');
  const txt = isKo ? `당신의 점수` : `Your points`;
  return { type: jsPsychHtmlKeyboardResponse, stimulus: `<h3>${txt}</h3><p style="font-size:2rem"><strong>${params.selfAmt}</strong></p>`,
    choices:"NO_KEYS", trial_duration:800, data:{task:'own_outcome', identity, lang, ...params} };
}
function bothOutcomeReveal(identity, lang, params){
  const isKo = (lang==='ko');
  const you = isKo ? '당신' : 'You'; const partner = isKo ? '파트너' : 'Partner';
  return { type: jsPsychHtmlKeyboardResponse, stimulus:
      `<div style="display:flex;gap:3rem;justify-content:center;align-items:center">
        <div><h4>${you}</h4><div style="font-size:2rem"><strong>${params.selfAmt}</strong></div></div>
        <div><h4>${partner}</h4><div style="font-size:2rem"><strong>${params.partnerAmt}</strong></div></div>
      </div>`,
    choices:"NO_KEYS", trial_duration:1200, data:{task:'both_outcomes', identity, lang, ...params} };
}
function saveAgainChoice(identity, lang, params){
  const isKo = (lang==='ko');
  const prompt = isKo ? '이번 결과를 저장하시겠습니까, 아니면 나중에 다시 하시겠습니까?' : 'Save this outcome, or play this trial Again later?';
  return { type: jsPsychHtmlButtonResponse, stimulus:`<p>${prompt}</p>`,
    choices: isKo ? ['저장','다시'] : ['Save','Again'], button_html: BTN,
    data:{task:'save_again', identity, lang, ...params}, on_finish:d=> d.choice_save = (d.response===0)?1:0 };
}

// ---------- Card instructions (partner + round flow) ----------
const faithful_instructions_en = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<h3>Card Game</h3>
    <p>You will play a short card game with another participant.</p>
    <p>In each round, choose one of three hidden cards.</p>
    <p>First, you will see <strong>your points</strong>. Then you will see <strong>both</strong> your points <strong>and</strong> your partner’s points.</p>
    <p>After each round, choose whether to <strong>Save</strong> the result or try the round <strong>Again</strong>.</p>`,
  choices: ['Start'], button_html: BTN, data:{task:'card_instructions', lang:'en'}
};
const faithful_instructions_ko = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<h3>카드 게임</h3>
    <p>다른 참가자와 함께 간단한 카드 게임을 하게 됩니다.</p>
    <p>각 라운드마다 세 장의 가려진 카드 중 하나를 선택하세요.</p>
    <p>먼저 <strong>당신의 점수</strong>가 나타나고, 이어서 <strong>당신과 파트너의 점수</strong>가 함께 보입니다.</p>
    <p>라운드가 끝날 때마다 결과를 <strong>저장</strong>할지, 라운드를 <strong>다시</strong> 할지 선택하세요.</p>`,
  choices: ['시작'], button_html: BTN, data:{task:'card_instructions', lang:'ko'}
};

// ---------- Consent ----------
function consentEN(){
  return { type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>Consent</h2>
      <p>This study examines how context influences decision-making after brief exposure to images and words. Participation is voluntary and anonymous.</p>
      <p>You will answer a short eligibility check and a few brief questions, then complete two short sections (one in English and one in Korean) and make a small set of decisions in a short interactive task. There are no right or wrong answers. You may stop at any time without penalty.</p>`,
    choices:['Continue'], button_html: BTN, data:{task:'consent', lang:'en'} };
}
function consentKO(){
  return { type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>동의</h2>
      <p>본 연구는 짧은 이미지/단어 노출 이후, 맥락이 의사결정에 어떤 영향을 미치는지 살펴봅니다. 참여는 자발적이며 익명입니다.</p>
      <p>간단한 적합성(Eligibility) 질문과 몇 가지 짧은 문항에 응답한 뒤, 영어/한국어 두 섹션을 수행하고 짧은 상호작용형 의사결정 과제를 진행합니다. 정답은 없으며, 언제든지 중단할 수 있습니다(불이익 없음).</p>`,
    choices:['계속'], button_html: BTN, data:{task:'consent', lang:'ko'} };
}




// ---------- Eligibility screener (hard gate) ----------
function eligibilityScreener(lang='en'){
  const isKo = (lang === 'ko');
  const labels = isKo ? ['예', '아니오'] : ['Yes', 'No'];
  return {
    type: jsPsychSurveyLikert,
    preamble: isKo ? `<h3>참여 적합성 확인</h3>` : `<h3>Eligibility check</h3>`,
    questions: [
      {
        name:'ka',
        prompt: isKo
          ? '본인을 <strong>한국계 미국인</strong>(한국 혈통 + 미국 문화권에서의 성장/경험)으로 정체화하시나요?'
          : 'Do you identify as <strong>Korean–American</strong> (or Korean heritage + American cultural upbringing/experience)?',
        labels, required:true
      },
      {
        name:'kor',
        prompt: isKo
          ? '<strong>한국어</strong>를 최소한 일상 대화 수준으로 이해할 수 있나요?'
          : 'Can you understand <strong>Korean</strong> at least conversationally?',
        labels, required:true
      },
      {
        name:'us',
        prompt: isKo
          ? '미국에서 거주/학업/강한 문화적 몰입 경험이 <strong>1년 이상</strong> 있나요?'
          : 'Have you spent <strong>1+ year</strong> living in, studying in, or being strongly immersed in the United States?',
        labels, required:true
      },
      {
        name:'home',
        prompt: isKo
          ? '성장 과정에서 가정 내에 한국 문화(가족/언어/전통)가 의미 있게 존재했나요?'
          : 'Growing up, was Korean culture (family/language/traditions) meaningfully present in your home life?',
        labels, required:true
      }
    ],
    data: { task:'eligibility_screener', lang },
    on_finish: (d)=>{
      const r = d.response || {};
      const yes = (x)=> (typeof x === 'number' && x === 0); // Yes = index 0
      d.eligible_ka = yes(r.ka) ? 1 : 0;
      d.eligible_korean = yes(r.kor) ? 1 : 0;
      d.eligible_us_exposure = yes(r.us) ? 1 : 0;
      d.eligible_korean_home = yes(r.home) ? 1 : 0;

      // Hard gate
      d.eligible = (d.eligible_ka && d.eligible_korean && d.eligible_us_exposure && d.eligible_korean_home) ? 1 : 0;
    }
  };
}
function eligibilityGate(lang='en'){
  const isKo = (lang === 'ko');
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: ()=>{
      const last = jsPsych.data.get().filter({task:'eligibility_screener'}).last(1).values()[0] || {};
      if(last.eligible === 1){
        return isKo ? `<p>감사합니다 — 계속 진행하실 수 있습니다.</p>` : `<p>Thank you — you can continue.</p>`;
      }
      return isKo
        ? `<h3>종료</h3>
           <p>본 파일럿은 한국계 미국인 이중문화 참가자를 대상으로 합니다. 참여해 주셔서 감사합니다.</p>`
        : `<h3>End</h3>
           <p>This pilot is limited to Korean–American bicultural participants. Thanks for your time.</p>`;
    },
    choices: [isKo ? '계속' : 'Continue'],
    button_html: BTN,
    data: { task:'eligibility_gate', lang },
    on_finish: ()=>{
      const last = jsPsych.data.get().filter({task:'eligibility_screener'}).last(1).values()[0] || {};
      if(last.eligible !== 1){
        jsPsych.endExperiment('Ended');
      }
    }
  };
}

// ---------- Risk control (single-item, 0–10) ----------
function riskItem(lang='en'){
  const isKo = (lang === 'ko');
  const labels = Array.from({length: 11}, (_,i)=> String(i));
  return {
    type: jsPsychSurveyLikert,
    preamble: isKo ? `<h3>간단한 질문</h3>` : `<h3>One quick question</h3>`,
    questions: [{
      name:'risk_0_10',
      prompt: isKo ? '전반적으로, 위험을 감수하는 데 어느 정도로 적극적이신가요?' : 'In general, how willing are you to take risks?',
      labels,
      required:true
    }],
    data: { task:'risk_item', lang },
    on_finish: (d)=>{
      const idx = d.response?.risk_0_10;
      d.risk_0_10 = (typeof idx === 'number') ? idx : null; // labels are 0–10 already
    }
  };
}

// ---------- BII (short, paraphrased items; 1–7) ----------
function biiShort(lang='en'){
  const isKo = (lang === 'ko');
  const labels = ['1','2','3','4','5','6','7'];
  return {
    type: jsPsychSurveyLikert,
    preamble: isKo
      ? `<h3>정체성 경험</h3><p class="small">일상에서 한국/미국 정체성을 어떻게 경험하는지 기준으로 응답해 주세요.</p>`
      : `<h3>Identity experience</h3><p class="small">Please respond based on how you experience your Korean and American sides in everyday life.</p>`,
    questions: [
      {name:'harm1', prompt: isKo ? '나의 한국적/미국적 측면은 자연스럽게 잘 어울린다.' : 'My Korean and American sides fit together smoothly.', labels, required:true},
      {name:'harm2', prompt: isKo ? '한국과 미국의 기대 사이에서 갈등을 느낀다.' : 'I feel torn between Korean and American expectations.', labels, required:true},
      {name:'harm3', prompt: isKo ? '갈등 없이 한국식/미국식 방식으로 전환할 수 있다.' : 'I can switch between Korean and American ways of being without conflict.', labels, required:true},
      {name:'harm4', prompt: isKo ? '일상에서 한국적/미국적 측면이 충돌한다.' : 'My Korean and American sides clash in my daily life.', labels, required:true},

      {name:'blend1', prompt: isKo ? '나는 한국 문화와 미국 문화가 섞인 사람처럼 느낀다.' : 'I feel like a blend/mix of Korean and American culture.', labels, required:true},
      {name:'blend2', prompt: isKo ? '상황에 따라 한국적/미국적 측면을 따로 유지한다.' : 'I keep my Korean and American sides separate depending on the situation.', labels, required:true},
      {name:'blend3', prompt: isKo ? '두 정체성은 하나로 통합된 전체처럼 느껴진다.' : 'My identities feel like one integrated whole.', labels, required:true},
      {name:'blend4', prompt: isKo ? '한국 맥락과 미국 맥락에서 다른 사람처럼 느껴진다.' : 'I feel like a different person in Korean contexts vs American contexts.', labels, required:true}
    ],
    data: { task:'bii_short', lang },
    on_finish: (d)=>{
      const r = d.response || {};
      const to1to7 = (x)=> (typeof x === 'number') ? (x + 1) : null; // jsPsych 0–6
      const v = {
        harm1: to1to7(r.harm1),
        harm2: to1to7(r.harm2),
        harm3: to1to7(r.harm3),
        harm4: to1to7(r.harm4),
        blend1: to1to7(r.blend1),
        blend2: to1to7(r.blend2),
        blend3: to1to7(r.blend3),
        blend4: to1to7(r.blend4),
      };
      Object.assign(d, v);

      const rev7 = (x)=> (typeof x === 'number') ? (8 - x) : null;
      const mean = (arr)=> arr.every(x=>typeof x==='number') ? arr.reduce((a,b)=>a+b,0)/arr.length : null;

      const harm = mean([v.harm1, rev7(v.harm2), v.harm3, rev7(v.harm4)]);
      const blend = mean([v.blend1, rev7(v.blend2), v.blend3, rev7(v.blend4)]);

      d.bii_harmony = harm;
      d.bii_blendedness = blend;
      d.bii_overall = (harm===null || blend===null) ? null : (harm + blend) / 2;
    }
  };
}

// ---------- Trust Game (mini) ----------
let trust_comp_passed = false;
let trust_comp_attempts = 0;

function trustComprehension(lang){
  const isKo = (lang === 'ko');
  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: isKo
      ? `<h3>신뢰 게임 안내</h3>
         <p>이제 짧은 <strong>신뢰 게임</strong>을 합니다.</p>
         <p>당신은 <strong>10 토큰</strong>을 가지고 있고, 상대에게 보낼 토큰 수를 선택합니다.</p>
         <p>보낸 토큰은 <strong>3배</strong>가 되어 상대에게 전달됩니다.</p>`
      : `<h3>Trust game</h3>
         <p>Next is a short <strong>trust game</strong>.</p>
         <p>You have <strong>10 tokens</strong>. You choose how many tokens to send to the other person.</p>
         <p>Whatever you send is <strong>tripled</strong> for the other person.</p>`,
    choices: [isKo ? '계속' : 'Continue'],
    button_html: BTN,
    data: {task:'trust_comp_intro', lang}
  };

  const quiz = {
    type: jsPsychSurveyText,
    preamble: isKo
      ? `<p><strong>이해 확인</strong> (숫자로 입력)</p>`
      : `<p><strong>Comprehension check</strong> (type a number)</p>`,
    questions: [
      {name:'q1', prompt: isKo ? '당신이 4 토큰을 보내면, 상대는 몇 토큰을 받나요?' : 'If you send 4 tokens, how many tokens does the other person receive?', required:true},
      {name:'q2', prompt: isKo ? '당신이 30 토큰을 받았다면, 최대 몇 토큰까지 돌려줄 수 있나요?' : 'If you receive 30 tokens, what is the maximum you can return?', required:true}
    ],
    data: {task:'trust_comp_quiz', lang},
    on_finish: (d)=>{
      const r = d.response || {};
      const a1 = parseInt(String(r.q1||'').trim(), 10);
      const a2 = parseInt(String(r.q2||'').trim(), 10);
      d.q1 = a1; d.q2 = a2;
      d.q1_ok = (a1 === 12) ? 1 : 0;
      d.q2_ok = (a2 === 30) ? 1 : 0;
      d.all_ok = (d.q1_ok && d.q2_ok) ? 1 : 0;
      trust_comp_attempts += 1;
      if(d.all_ok) trust_comp_passed = true;
    }
  };

  const feedback = {
    type: jsPsychHtmlButtonResponse,
    stimulus: ()=>{
      if(trust_comp_passed){
        return isKo ? `<p>좋습니다. 계속 진행합니다.</p>` : `<p>Great — continuing.</p>`;
      }
      const msg = isKo
        ? `<p>두 문항 중 하나 이상이 틀렸습니다. 규칙을 다시 한 번 확인한 뒤 다시 시도해 주세요.</p>
           <p><strong>보낸 토큰 × 3</strong>이 상대에게 전달됩니다. 받은 토큰은 <strong>0–30</strong> 사이에서 돌려줄 수 있습니다.</p>`
        : `<p>At least one answer was incorrect. Please review and try again.</p>
           <p><strong>Sent tokens × 3</strong> is what the other person receives. If you receive 30, you can return <strong>0–30</strong>.</p>`;
      return msg;
    },
    choices: [isKo ? '다시' : 'Try again'],
    button_html: BTN,
    data: {task:'trust_comp_feedback', lang},
    on_start: (t)=>{
      // If already passed, skip quickly
      if(trust_comp_passed) t.choices = [isKo ? '계속' : 'Continue'];
    }
  };

  return {
    timeline: [intro, quiz, feedback],
    loop_function: ()=>{
      if(trust_comp_passed) return false;
      return trust_comp_attempts < 2; // allow 2 attempts total
    }
  };
}



function trustGate(lang){
  const isKo = (lang === 'ko');
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: ()=>{
      if(trust_comp_passed){
        return isKo ? `<p>이해 확인을 통과했습니다. 계속 진행합니다.</p>` : `<p>You passed the comprehension check. Continuing.</p>`;
      }
      return isKo
        ? `<h3>종료</h3><p>게임 규칙 이해 확인을 통과하지 못해 연구를 계속 진행할 수 없습니다. 참여해 주셔서 감사합니다.</p>`
        : `<h3>End</h3><p>You did not pass the comprehension check, so the study cannot continue. Thank you for your time.</p>`;
    },
    choices: [isKo ? '계속' : 'Continue'],
    button_html: BTN,
    data: {task:'trust_comp_gate', lang},
    on_finish: ()=>{
      if(!trust_comp_passed){
        jsPsych.endExperiment(isKo ? '종료' : 'Ended');
      }
    }
  };
}


function trustGamePerBlock(identity, lang, params){
  const isKo = (lang === 'ko');

  // --- Send decisions (3 partners) ---
  const makeSend = (partnerLabel) => ({
    type: jsPsychHtmlButtonResponse,
    stimulus: isKo
      ? `<h3>신뢰 게임</h3>
         <p>상대 <strong>${partnerLabel}</strong>에게 보낼 토큰 수를 선택하세요.</p>
         <p>당신은 <strong>10 토큰</strong>을 가지고 있으며 (0–10), 보낸 토큰은 <strong>3배</strong>가 됩니다.</p>`
      : `<h3>Trust game</h3>
         <p>Choose how many tokens to send to <strong>Partner ${partnerLabel}</strong>.</p>
         <p>You have <strong>10 tokens</strong> (0–10). Sent tokens are <strong>tripled</strong>.</p>`,
    choices: Array.from({length: 11}, (_,i)=> String(i)),
    button_html: BTN,
    data: {task:'trust_send', identity, lang, partner: partnerLabel, ...(params||{})},
    on_finish: (d)=>{
      d.trust_send = parseInt(d.response, 10);
      d.trust_multiplier = 3;
      d.trust_receiver_gets = d.trust_send * 3;
    }
  });

  // --- Return decisions (2 stake scenarios; strategy method) ---
  const parseIntSafe = (x)=>{
    const n = parseInt(String(x||'').trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  const return15 = {
    type: jsPsychSurveyText,
    preamble: isKo
      ? `<h3>돌려주기</h3><p>상대가 5 토큰을 보냈다고 가정하면, 당신은 <strong>15 토큰</strong>을 받습니다.</p>`
      : `<h3>Return decision</h3><p>If the other person sent 5 tokens, you would receive <strong>15 tokens</strong>.</p>`,
    questions: [
      {name:'trust_return', prompt: isKo ? '당신은 몇 토큰을 상대에게 돌려주겠습니까? (0–15)' : 'How many tokens would you return? (0–15)', required:true}
    ],
    data: {task:'trust_return', identity, lang, received:15, scenario:'receive15', ...(params||{})},
    on_finish: (d)=>{
      const raw = (d.response?.trust_return ?? '').toString().trim();
      const v = parseIntSafe(raw);
      d.trust_return_raw = raw;
      d.trust_total_received = 15;
      d.trust_return = (v===null) ? null : Math.max(0, Math.min(15, v));
      d.trust_return_rate = (d.trust_return===null) ? null : (d.trust_return / 15);
    }
  };

  const return30 = {
    type: jsPsychSurveyText,
    preamble: isKo
      ? `<h3>돌려주기</h3><p>상대가 10 토큰을 보냈다고 가정하면, 당신은 <strong>30 토큰</strong>을 받습니다.</p>`
      : `<h3>Return decision</h3><p>If the other person sent 10 tokens, you would receive <strong>30 tokens</strong>.</p>`,
    questions: [
      {name:'trust_return', prompt: isKo ? '당신은 몇 토큰을 상대에게 돌려주겠습니까? (0–30)' : 'How many tokens would you return? (0–30)', required:true}
    ],
    data: {task:'trust_return', identity, lang, received:30, scenario:'receive30', ...(params||{})},
    on_finish: (d)=>{
      const raw = (d.response?.trust_return ?? '').toString().trim();
      const v = parseIntSafe(raw);
      d.trust_return_raw = raw;
      d.trust_total_received = 30;
      d.trust_return = (v===null) ? null : Math.max(0, Math.min(30, v));
      d.trust_return_rate = (d.trust_return===null) ? null : (d.trust_return / 30);
    }
  };

  return {
    timeline: [
      makeSend('A'),
      makeSend('B'),
      makeSend('C'),
      return15,
      return30
    ]
  };
}


// ---------- block builders ----------
function pushHostBlock(tl, position){
  const p = primes[0]; 
  const block_index = (position===1)?0:1;

  tl.push( blockStartPage('Host','en', position) );

  [ primeSlideshow(p), primePrompts(p), primeCheck(p) ].forEach(item => {
    if(!item.data) item.data = {};
    item.data.block_index = block_index;
    item.data.block_position = position;
    tl.push(item);
  });

  // Primary DV first: strategic interaction
  tl.push( trustGamePerBlock('Host','en', {block_index, block_position: position}) );

  // Secondary DV: short card task
  tl.push( {...faithful_instructions_en, data:{...faithful_instructions_en.data, block_index, block_position: position}} );
  buildTrialsN(N_TRIALS_PER_BLOCK).forEach(t => {
    const params = Object.assign({}, t, {block_index, block_position: position});
    tl.push(
      cardChoiceScreen('Host','en', params),
      ownOutcomeReveal('Host','en', params),
      bothOutcomeReveal('Host','en', params),
      saveAgainChoice('Host','en', params)
    );
  });
}
function pushHeritageBlock(tl, position, showHandoff=true){
  const p = primes[1];
  const block_index = (position===1)?0:1;

  if(showHandoff) tl.push( koHandoffTrial(position) );

  const subtimeline = [];
  subtimeline.push( blockStartPage('Heritage','ko', position) );

  [ primeSlideshow(p), primePrompts(p), primeCheck(p) ].forEach(item => {
    if(!item.data) item.data = {};
    item.data.block_index = block_index;
    item.data.block_position = position;
    subtimeline.push(item);
  });

  // Primary DV first: strategic interaction
  subtimeline.push( trustGamePerBlock('Heritage','ko', {block_index, block_position: position}) );

  // Secondary DV: short card task
  subtimeline.push( {...faithful_instructions_ko, data:{...faithful_instructions_ko.data, block_index, block_position: position}} );
  buildTrialsN(N_TRIALS_PER_BLOCK).forEach(t => {
    const params = Object.assign({}, t, {block_index, block_position: position});
    subtimeline.push(
      cardChoiceScreen('Heritage','ko', params),
      ownOutcomeReveal('Heritage','ko', params),
      bothOutcomeReveal('Heritage','ko', params),
      saveAgainChoice('Heritage','ko', params)
    );
  });

  tl.push({ timeline: subtimeline, conditional_function: () => allowKorean });
}

// ---------- timeline ----------
let timeline = [];
const startsWithHost = COUNTERBALANCE ? (Math.random() < 0.5) : true;
const condition_order = startsWithHost ? 'HostFirst' : 'HeritageFirst';
const initLang = startsWithHost ? 'en' : 'ko';
jsPsych.data.addProperties({ condition_order, order_condition: condition_order, start_lang: initLang });
timeline.push( startsWithHost ? consentEN() : consentKO() );
timeline.push( eligibilityScreener(initLang) );
timeline.push( eligibilityGate(initLang) );
timeline.push( riskItem(initLang) );
timeline.push( biiShort(initLang) );
// Trust-game comprehension check (once)
const trustLang = startsWithHost ? 'en' : 'ko';
timeline.push( trustComprehension(trustLang) );
timeline.push( trustGate(trustLang) );
if (startsWithHost){
  pushHostBlock(timeline, 1);
  timeline.push(...neutralReset(1));
  pushHeritageBlock(timeline, 2);
} else {
  // Already in Korean at the start; skip the "Korean section" handoff banner on the first block.
  pushHeritageBlock(timeline, 1, false);
  timeline.push(...neutralReset(1));
  pushHostBlock(timeline, 2);
}

// ---------- Demographics ----------
const GENDER_OPTIONS = ["Female","Male","Non-binary / gender diverse","Prefer to self-describe","Prefer not to say"];

timeline.push({
  type: jsPsychSurveyLikert, preamble:"<h3>Brief demographics</h3>",
  questions:[{ name:"gender_index", prompt:"Gender", labels:GENDER_OPTIONS, required:true }],
  data:{ task:"demographics_gender" },
  on_finish:(d)=>{ const idx=d.response?.gender_index; d.gender_index=(typeof idx==="number")?idx:null; d.gender=(typeof idx==="number")?GENDER_OPTIONS[idx]:""; }
});
timeline.push({
  type: jsPsychSurveyText, preamble:"",
  questions:[{ name:"gender_self_described", prompt:"If you chose ‘Prefer to self-describe’, type it here (otherwise leave blank).", required:false }],
  data:{ task:"demographics_gender_text" },
  on_finish:(d)=>{ const txt=(d.response?.gender_self_described||"").trim(); d.gender_self_described=txt; if(txt) d.gender=txt; }
});
timeline.push({
  type: jsPsychSurveyText, preamble:"",
  questions:[
    {name:"age",               prompt:"Age (years)", required:true},
    {name:"current_residence", prompt:"Current country of residence", required:true},
    {name:"years_US",          prompt:"Total years lived in the United States (approx.)", required:false, placeholder:"e.g., 7.5"},
    {name:"years_KR",          prompt:"Total years lived in Korea (approx.)", required:false,  placeholder:"e.g., 12"}
  ],
  data:{ task:'demographics_core' },
  on_finish:function(d){ try{ const r=d.response||{}; d.age=(r.age||'').trim(); d.current_residence=(r.current_residence||'').trim(); d.years_US=r.years_US?parseFloat(String(r.years_US).trim()):''; d.years_KR=r.years_KR?parseFloat(String(r.years_KR).trim()):''; }catch(e){} }
});

// ---------- run ----------
jsPsych.run(timeline);
