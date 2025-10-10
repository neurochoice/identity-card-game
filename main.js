// ===== Identity × Card-Game Pilot =====


// ---------- CONFIG ----------
const PROLIFIC_COMPLETION_URL = ""; // optional
const UPLOAD_URL = "https://script.google.com/macros/s/AKfycbw7zn875unrEtlxV2o0KzJPwfGOleJ2_IeTKStsAqDFULLmw80SNORB7z8xSaWGqdYA/exec";
const SHOW_DOWNLOAD = false;
const COUNTERBALANCE = true;   // 50/50 US↔KR

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
  on_data_update: d => d.timestamp = new Date().toISOString(),
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
  if(p.lang === 'ko'){
    return {
      type: jsPsychSurveyLikert, preamble: "",
      questions: [
        {name:'heritage_connected', prompt:`지금 나는 <strong>한국인 정체성</strong>과 연결되어 있다고 느낀다.`, labels:['1','2','3','4','5','6','7'], required:true},
        {name:'ac_kor',             prompt:`주의 확인: 여기서는 <strong>4</strong>를 선택해주세요.`,        labels:['1','2','3','4','5','6','7'], required:true}
      ],
      data: {task:'prime_check', identity:p.identity},
      on_finish: (d)=>{ const r=d.response||{}; if(typeof r.heritage_connected==='number') d.heritage_connected=r.heritage_connected+1; d.attention_ok=(r.ac_kor===3)?1:0; }
    };
  } else {
    return {
      type: jsPsychSurveyLikert, preamble: "",
      questions: [
        {name:'host_connected', prompt:`Right now I feel connected to my <strong>American identity</strong>.`, labels:['1','2','3','4','5','6','7'], required:true},
        {name:'ac_en',          prompt:`Attention check: please select option <strong>4</strong>.`,            labels:['1','2','3','4','5','6','7'], required:true}
      ],
      data: {task:'prime_check', identity:p.identity},
      on_finish: (d)=>{ const r=d.response||{}; if(typeof r.host_connected==='number') d.host_connected=r.host_connected+1; d.attention_ok=(r.ac_en===3)?1:0; }
    };
  }
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

// ---------- Start pages (participant-neutral copy) ----------
function blockStartPage(identity, lang, position){
  const isFirst = (position === 1);
  const isKo = (lang === 'ko');
  const title = isKo ? '시작하기' : 'Start';
  const part = isKo ? (isFirst ? '1부 (총 2부 중)' : '2부 (총 2부 중)') : (isFirst ? 'Part 1 of 2' : 'Part 2 of 2');

  const lines = isKo
    ? (isFirst
        ? ['이 부분은 이미지와 짧은 질문으로 시작하고,','이어지는 <strong>카드 게임</strong>에서 빠르게 선택하시면 됩니다.','완료 후 다음 부분으로 이동합니다.']
        : ['이 부분은 새로운 이미지와 질문으로 이어지며, 카드 게임을 한 번 더 진행합니다.','지금 느끼는 대로 자연스럽게 응답해 주세요.',''])
    : (isFirst
        ? ['This part begins with images and brief questions,','then a quick <strong>card game</strong> where you make fast choices.','After this part you will move to the next one.']
        : ['This part continues with a new set of short images and questions, followed by another quick card game.','Please respond naturally, based on how you feel right now.','']);

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
      <p>The next section is in <strong>Korean</strong>. If you feel uncomfortable continuing in Korean, you can skip this part and move forward.</p>
      <hr style="margin:10px 0">
      <p><strong>한국어 구간 안내</strong></p>
      <p>다음 화면은 한국어로 진행됩니다. <strong>한국어로 진행하는 것이 불편하다면</strong> 이 부분을 건너뛰고 다음으로 이동할 수 있습니다.</p>`,
    choices: ['Continue / 계속','Skip / 건너뛰기'],
    button_html: BTN,
    data: {task:'section_transition', identity:'Heritage', block_position: position},
    on_finish: (d)=> { if(d.response === 1){ allowKorean = false; d.skipped_korean = 1; } else { d.skipped_korean = 0; } }
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
      <p>This study looks at how people make choices after viewing short sets of images and words. Participation is voluntary and anonymous.</p>
      <p>You will answer a few short questions and play a simple card game. There are no right or wrong answers. You may stop at any time without penalty.</p>`,
    choices:['Continue'], button_html: BTN, data:{task:'consent', lang:'en'} };
}
function consentKO(){
  return { type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>동의</h2>
      <p>이 연구는 짧은 이미지와 단어를 본 뒤 사람들이 어떻게 선택하는지 살펴봅니다. 참여는 자발적이며 익명입니다.</p>
      <p>몇 가지 간단한 질문에 답하고 카드 게임을 하게 됩니다. 정답은 없으며, 언제든지 중단할 수 있습니다.</p>`,
    choices:['계속'], button_html: BTN, data:{task:'consent', lang:'ko'} };
}

// ---------- block builders ----------
function pushHostBlock(tl, position){
  const p = primes[0]; const block_index = (position===1)?0:1;
  tl.push( blockStartPage('Host','en', position) );
  [ primeSlideshow(p), primePrompts(p), primeCheck(p) ].forEach(item => {
    if(!item.data) item.data = {}; item.data.block_index = block_index; item.data.block_position = position; tl.push(item);
  });
  tl.push( {...faithful_instructions_en, data:{...faithful_instructions_en.data, block_index, block_position: position}} );
  buildOrthogonalTrials16().forEach(t => {
    const params = Object.assign({}, t, {block_index, block_position: position});
    tl.push( cardChoiceScreen('Host','en', params), ownOutcomeReveal('Host','en', params), bothOutcomeReveal('Host','en', params), saveAgainChoice('Host','en', params) );
  });
}
function pushHeritageBlock(tl, position){
  const p = primes[1]; const block_index = (position===1)?0:1;
  tl.push( koHandoffTrial(position) );
  const subtimeline = [];
  subtimeline.push( blockStartPage('Heritage','ko', position) );
  [ primeSlideshow(p), primePrompts(p), primeCheck(p) ].forEach(item => {
    if(!item.data) item.data = {}; item.data.block_index = block_index; item.data.block_position = position; subtimeline.push(item);
  });
  subtimeline.push( {...faithful_instructions_ko, data:{...faithful_instructions_ko.data, block_index, block_position: position}} );
  buildOrthogonalTrials16().forEach(t => {
    const params = Object.assign({}, t, {block_index, block_position: position});
    subtimeline.push( cardChoiceScreen('Heritage','ko', params), ownOutcomeReveal('Heritage','ko', params), bothOutcomeReveal('Heritage','ko', params), saveAgainChoice('Heritage','ko', params) );
  });
  tl.push({ timeline: subtimeline, conditional_function: () => allowKorean });
}

// ---------- timeline ----------
let timeline = [];
const startsWithHost = COUNTERBALANCE ? (Math.random() < 0.5) : true;
timeline.push( startsWithHost ? consentEN() : consentKO() );
if (startsWithHost){
  pushHostBlock(timeline, 1);
  timeline.push(...neutralReset(1));
  pushHeritageBlock(timeline, 2);
} else {
  pushHeritageBlock(timeline, 1);
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