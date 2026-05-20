// Скрипт для MVP квиза "Угадай, кто это"
// Комментарии на русском для понятности

// --- Конфигурация Firebase ---
// Подставлен ваш конфиг. Для Realtime Database добавлен fallback databaseURL.
// Для Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBjx5XQxjB2sVfQ6k24hzOmkTC5bVTi7PU",
  authDomain: "who-is-it-quiz.firebaseapp.com",
  databaseURL: "https://who-is-it-quiz-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "who-is-it-quiz",
  storageBucket: "who-is-it-quiz.firebasestorage.app",
  messagingSenderId: "547755111271",
  appId: "1:547755111271:web:12ce1f28f65b13cb6775c2",
  measurementId: "G-FV5KJVEVNH"
};

// Если в конфиге нет databaseURL — пробуем подставить стандартный fallback
if(!firebaseConfig.databaseURL){
  firebaseConfig.databaseURL = `https://${firebaseConfig.projectId}.firebaseio.com`;
}

let firebaseEnabled = true;
const STORAGE_KEY = 'quiz_completed_v1';
const RESULTS_KEY = 'quiz_results_v1';
const ADMIN_PASSWORD = 'quizadmin2026';
const ADMIN_SESSION_KEY = 'quiz_admin_authenticated_v1';

let database = null;
let adminSortField = 'score';
let adminSortDirection = 'desc';

function updateAdminSort(field){
  if(adminSortField === field){
    adminSortDirection = adminSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    adminSortField = field;
    adminSortDirection = field === 'name' ? 'asc' : 'desc';
  }
  refreshAdminResults();
}

function sortAdminParticipants(list){
  return [...list].sort((a,b) => {
    const aValue = a[adminSortField] ?? (adminSortField === 'score' || adminSortField === 'ts' ? 0 : '');
    const bValue = b[adminSortField] ?? (adminSortField === 'score' || adminSortField === 'ts' ? 0 : '');
    if(adminSortField === 'score' || adminSortField === 'ts'){
      return adminSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    const cmp = aValue.toString().localeCompare(bValue.toString(), 'ru', {sensitivity:'base'});
    return adminSortDirection === 'asc' ? cmp : -cmp;
  });
}

// Попытка инициализировать Firebase (если скрипты подключены в index.html)
try{
  if(window.firebase && firebase.initializeApp){
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseEnabled = true;
  } else {
    firebaseEnabled = false;
  }
}catch(e){
  console.warn('Firebase init error', e);
  firebaseEnabled = false;
}
// --- Контейнер данных: массив вопросов ---
// Каждая запись: {desc, images[], options[], answerIndex}
// Для локальных картинок используйте имена в формате img{номер вопроса}_{номер фото}
// Например: 'img1_1', 'img3_2'. Файл будет искаться в папке img с расширением .jpg, .jpeg, .JPG или .JPEG по умолчанию.
const quizData = [
{ type: 'teacher', desc: `В 3 классе мы с подругой после продлёнки рванули в кабинет ИЗО — рисовать. Увлеклись так, что прозевали, как школа опустела и закрылась. Родители, не дождавшись нас, уже звонили по всем номерам: в школу, одноклассникам, учителям. Охранник уверял, что в здании ни души. От отчаяния они заявили в милицию. А нас в итоге нашли там же — за нашими «шедеврами». Дома ждали горячие объятия... и не менее горячие выговоры. 😄`, images: ['img1_1','img1_2','img1_3'], options: ['Елена Генджер','Татьяна Шаталова','Валентина Третьякова','Полионова Анна'], answer: 0,},
  {type: 'teacher', desc: `В школе отлично училась, ненавидела читать и учить стихи, а в свободное время плела из бисера и вязала кукол из вселенной Сейлормун. Однажды, в 8м классе на уроке географии, подверглась оскорблению со стороны одноклассника на предмет своей пышной фигуры. Прекратила потенциальный буллинг одной размашистой пощёчиной. За скверный характер носила прозвище Цербер.`, images: ['tanya1','img2_2','img2_3'], options: ['Татьяна Шаталова','Полионова Анна','Марина Хазова','Анна Цепляева'], answer: 0,},
  {type: 'teacher', desc: `Я всегда ненавидела физику, прямо с 7 класса. По причине того, что на уроке мы всегда искали "s" в формуле s=vt, а на контрольной требовалось найти "v" или "t". Так я и ползла с триместровыми двойками и годовыми тройками до 11 класса. В 11 классе учительница сказала, что поставит мне "2" в аттестат, но тут пришли на помощь мои друзья (будущие студенты-бауманцы), которые уговорили учительницу взять меня в поездку в Калугу на какую-то конференцию. В итоге мы так классно провели там время, что учительница предложила мне сдавать экзамен по физике.`, images: ['alina2','alina4'], options: ['Алина Короткова','Татьяна Шаталова','Елена Генджер','Надежда Живчикова'], answer: 0,},
  {type: 'teacher', desc: `Пела 9 лет в хоре и играла на домре. Любила математику и терпеть не могла физкультуру.`, images: ['img4_1'], options: ['Полионова Анна','Марина Хазова','Анна Цепляева','Анна Разумова'], answer: 0,},
  {type: 'teacher', desc: 'Любил биологию и ходил на кружок во дворец пионеров, где однажды ему рассказали про репликацию ДНК. На контрольной по этой теме он попросил дополнительный вопрос «пан или пропал», вспомнил лишь знакомое слово и не получил максимальный балл. Потом он учил геохронологические периоды, не получив высшую оценку, но запомнил их на всю жизнь — в аттестате по биологии не максимум, но память осталась.', images: ['viktor1'], options: ['Виктор Бардашев','Антонов Сергей','Алишер Сайфуллаев','Дмитрий Ярманов'], answer: 0,},
  {type: 'teacher', desc: `Я с 10 класса начала готовиться к поступлению в профильный вуз - все время после уроков проводила в академии и рисовала головы и геометрические фигуры. Приходила на уроки с большими папками и почти не тусила с одноклассниками, но дружила с ребятами на рисунке. В какой-то момент нас с подружкой начала узнавать вся кафедра, открывали нам аудитории и придумывали чем бы еще занять нас, раз базу уже освоили. Иногда рандомные преподаватели оставались с нами до ночи, чтобы сидеть и позировать нам для портрета. Было очень круто потом ночью возвращаться на метро домой и чувствовать себя взрослой. Но потом уже ближе у последнего звонку, накатила вселенская грусть и досада от осознания что с одноклассниками больше не будет столько времени и вообще конец школы, и стремление скорее вырасти поутихло. Тоже тогда все показались любимыми и самыми хорошими)`, images: ['img6_1','img6_2','img6_3'], options: ['Марина Хазова','Надежда Живчикова','Полионова Анна','Анна Цепляева'], answer: 0,},
  {type: 'teacher', desc: `На классном часу было об’явлено что совсем скоро нас будут принимать в пионеры. но принимать сначала будут не всех, а по пять человек от класса - тех кто активен и хорошо учится. Мне посчастливилось попасть в первую пятерку, это было большой радостью и гордостью. В фантазиях представлялось что нас будут принимать в величественном музее Ленина или на Красной площади. Через некоторое время нам сообщили что церемония будет проходить … на Преображенском кладбище. Так я узнала что там есть большое воинское захоронение и вечный огонь. А еще получила повод шокировать родных и близких, которым в ответ на вопрос: «А где вас будут посвящать/посвящали в пионеры?» могла отвечать «На кладбище!» и следить за реакцией. Так в сознании ученицы 4 класса поселился антропологический интерес и юмор помог справиться с фрустрацией.`, images: ['img7_1'], options: ['Анна Цепляева','Марина Хазова','Надежда Живчикова','Полионова Анна'], answer: 0,},
  {type: 'teacher', desc: `Предметы, которые я сдавала в 9 и 11 классе кардинально отличались. Несмотря на успехи (в багаже даже была парочка неплохо написанных олимпиад и отлично сданный ОГЭ), в один момент я решила, что хочу пойти совершенно в другую сторону, и променяла точные науки на гуманитарные. Помню, как все были этому удивлены и как меня отговаривали. Но с тех пор не было ни секунды, чтобы я пожалела: только в 10 классе я поняла, что все время до этого пыталась пойти стопами семьи, а не искать свое.`, images: ['dasha1','dasha2','dasha3'], options: ['Дарья Старицкая','Диана Михниченко','Елена Генджер','Дарья Трофимова'], answer: 0,},
  {type: 'teacher', desc: `Я училась в "Б" классе, а Б класс всегда был для наших учителей "недостаточно умен, талантлив" и еще целый список всего, в сравнении с "А" классом. Поэтому все творческие активности в школе проходили только с учениками "А" класса. А мне очень хотелось попробовать себя в новых творческих активностях. Так я пошла на кастинг в команду квн, написала знакомому мальчику Боре и попросила меня взять в команду. В 10 классе ночами писала шутки и пересматривала старые выпуски КВН, чтобы понять логику того как создается юмор. Шутки получались очень непросто и не сразу. Но я так благодарю себя за смелость и настойчивость. После этого решилась еще попроситься вожатой в лагерь в 17 лет, встретила чудесных людей и по сей день верю, что однажды создам свой лагерь. Ура!`, images: ['anyar1','anyar2','anyar3'], options: ['Анна Разумова','Полионова Анна','Анна Цепляева','Надежда Живчикова'], answer: 0,},
  {type: 'teacher', desc: `В 6 классе за компанию с подружкой я пошла в театральную студию. Было очень непросто, первый год ломались мои внутренние установки и чаще было тяжело, чем весело. Но я почему-то уже в 6 классе понимала, что я не сдамся и что мне это надо. В итоге я с театром была до своего 11 класса и вернулась в театр после универа. Этот опыт преодоления и долгого пути - огромная часть меня`, images: ['nadya1','nadya2','nadya3'], options: ['Надежда Живчикова','Елена Генджер','Марина Хазова','Анна Цепляева'], answer: 0,},
  {type: 'student', desc: 'Я ела лапшу палочками для макияжа в школьном лагере, и плакала от ее остроты.', images: ['katyai1'

  ], options: ['Иванова Екатерина','Ева Рогозина','Оля Колугина','Полина Петрова'], answer: 0,},
  {type: 'student', desc: `возможно, это будет достаточно обычная история, но она искренняя и именно она сложила мое первое, сильное впечатление об одноклассниках и в принципе о нашей гимназии! был октябрь, я спешила на свою первую в жизни субботу (в Европейке), а тогда еще мы проводили ее не в школе. в общем то я очень волновалась, так как во-первых я была первый год в этой школе, ничего не знала и никого вживую не видела. а во-вторых я опаздывала, еще не понимала куда идти, и уже думала, зачем пришла….🫰 Но подходя, увидела моих одноклассников и еще некоторых людей, которые стояли кругом. Все мне помахали, что было так удивительно и приятно, и вообще ооочень приветливо восприняли. Мне стало легче, но все же было так непривычно, что абсолютно каждый человек понимающий и доброжелательный, без какого-то осуждения) в тот день я даже с кем-то пообщалась и подружилась (яна, оля, софа)🙏🏻🙏🏻🥹 надеюсь, что эти фотки вам хоть как-то помогут`, images: ['eva1','eva2','eva3'], options: ['Ева Рогозина','Оля Колугина','Маруся Маркина','Иванова Екатерина'], answer: 0,},
  {type: 'student', desc: `я путаю дискриминант и теорему Пифагора…когда нужно решить пример через дискриминант, я почему-то всегда говорю, что он решается по теореме Пифагора`, images: ['olya1','olya2','olya3'], options: ['Оля Колугина','Иванова Екатерина','Ева Рогозина','Маруся Маркина'], answer: 0,},
  {type: 'student', desc: `В один момент, резко по обстоятельствам интересных активностей от школы был придуман дуэт и два костюма. В которых этот дуэт было видно хоть из далека и привлекал внимание. А после дуэт частично появился в ролике на канале школы. На фотографиях будет части образа только одного человека из дуэта.`, images: ['artem1','artem2'], options: ['Артемий Добрусин','Маруся Маркина','Ева Рогозина','Алексей Морозов'], answer: 0,},
  {type: 'student', desc: `Прикреплю несколько, на выбор, так сказать, пхпх). В 4-м классе по инициативе директрисы мы с одноклассниками играли на укулеле в качестве уличных музыкантов и проходящие мимо дети дали нам около 300₽. Во 2-м классе моя мама была преподавателем театрального кружка в моей школе и мы ставили разные спектакли. За неделю до показа в школе мы активно рисовали «рекламные» плакаты, готовили костюмы, учили текст. Было сложно, но одновременно очень душевно и весело. В 3-м классе у меня и моих 2-х одноклассников был преподаватель по имени Макс. У нас не было конкретного предмета, которым мы с ним занимались, мы просто делали всякие классные штуки вместе: пекли хлеб, шили книжки, снимали клипы. Самое классное, что мы с ним делали - это строили домик на дереве. Он был в поле на берегу реки: там мы прыгали через тарзанку, разводили костёр и слушали на колонке Imagine Dragons. Было очень уютно, жалко, что почти не сохранилось фоток. А ещё у Макса был шикарный эрокез!!`, images: ['marusia1','marusia2','marusia3'], options: ['Маруся Маркина','Оля Колугина','Иванова Екатерина','Ева Рогозина'], answer: 0 }
];
// --- Элементы UI ---
// (DOM-элементы, используемые приложением)
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const nameInput = document.getElementById('name-input');
const nameError = document.getElementById('name-error');
const startBtn = document.getElementById('start-btn');

// Внутреннее состояние квиза
const state = { index: 0, score: 0, name: '', completed: false };

function checkLocalCompleted(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(!saved) return false;
  try{
    const data = JSON.parse(saved);
    state.name = data.name || '';
    state.score = data.score || 0;
    state.completed = true;
    showResult();
    return true;
  }catch(e){ console.warn('Error parsing storage', e); }
  return false;
}

const progressBar = document.getElementById('progress-bar');
const qCount = document.getElementById('q-count');
const questionDesc = document.getElementById('question-desc');
const photosWrap = document.getElementById('photos');
const revealBtn = document.getElementById('reveal-btn');
const hiddenContent = document.getElementById('hidden-content');
const optionsWrap = document.getElementById('options');

const resultText = document.getElementById('result-text');
const podiumEl = document.getElementById('podium');
const retryBtn = document.getElementById('retry-btn');

const adminScreen = document.getElementById('admin-screen');
const adminPassword = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminCloseLoginBtn = document.getElementById('admin-close-login');
const adminDashboard = document.getElementById('admin-dashboard');
const adminStopBtn = document.getElementById('admin-stop-btn');
const adminResetBtn = document.getElementById('admin-reset-btn');
const adminClearBtn = document.getElementById('admin-clear-btn');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const participantsList = document.getElementById('participants-list');
const openAdminBtn = document.getElementById('open-admin');

if(nameInput){
  nameInput.addEventListener('input', () => {
    if(nameError){
      nameError.style.display = 'none';
    }
  });
}

function startQuiz(){
  const name = nameInput.value.trim();
  if(!name){
    if(nameError){
      nameError.textContent = 'Пожалуйста, введи имя.';
      nameError.style.display = 'block';
    }
    nameInput.focus();
    return;
  }
  if(nameError){
    nameError.style.display = 'none';
  }
  state.name = name;
  state.index = 0;
  state.score = 0;
  state.completed = false;
  // переключаем экраны
  startScreen.classList.remove('active');
  resultScreen.classList.remove('active');
  quizScreen.classList.add('active');
  renderQuestion();
}

function resolveImagePath(src){
  if(/^https?:\/\//.test(src) || src.startsWith('data:')){
    return src;
  }
  const hasExtension = /\.(jpe?g)$/i.test(src);
  return hasExtension ? `img/${src}` : `img/${src}.jpg`;
}

function renderQuestion(){


  const q = quizData[state.index];
  const questionCard = document.getElementById('question-card');
  questionDesc.textContent = q.desc;

  hiddenContent.classList.remove('visible');
  hiddenContent.style.display = 'none';

  revealBtn.style.display = 'inline-flex';

  revealBtn.onclick = () => {
    hiddenContent.style.display = 'block';
    hiddenContent.classList.add('visible');

    revealBtn.style.display = 'none';
  };


  if(questionCard){
    questionCard.classList.remove('teacher-card','student-card');
    questionCard.classList.add(q.type === 'teacher' ? 'teacher-card' : 'student-card');
  }
  // photos
  photosWrap.innerHTML = '';
  q.images.forEach(src => {
    const img = document.createElement('img');
    let attemptIndex = 0;
    const extensions = ['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG'];
    
    function tryLoadImage() {
      if (attemptIndex >= extensions.length) {
        img.alt = 'failed to load';
        return;
      }
      const ext = extensions[attemptIndex];
      const isAlreadyWithExt = /\.(jpe?g|png)$/i.test(src);
      img.src = isAlreadyWithExt ? `img/${src}` : `img/${src}${ext}`;
      attemptIndex++;
    }
    
    img.onerror = tryLoadImage;
    img.alt = 'photo';
    photosWrap.appendChild(img);
    tryLoadImage();
  });
  // options
  optionsWrap.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn fade-in';
    btn.textContent = opt;
    btn.addEventListener('click', () => onSelect(i, btn));
    optionsWrap.appendChild(btn);
  });
  // card color is set by question-card classes (teacher/student)
  // progress
  updateProgress();
}

function updateProgress(){
  const percent = Math.round((state.index / quizData.length) * 100);
  progressBar.style.width = percent + '%';
  qCount.textContent = `${state.index + 1} / ${quizData.length}`;
}

let inputLocked = false;

function onSelect(selectedIndex, btnEl){
  if(inputLocked) return;
  inputLocked = true;
  // подсветка выбранной
  document.querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));
  btnEl.classList.add('selected');

  const q = quizData[state.index];
  const correctIndex = q.answer;

  // отмечаем правильный/неправильный
  const buttons = Array.from(document.querySelectorAll('.option-btn'));
  buttons.forEach((b, idx) => {
    if(idx === correctIndex){
      b.classList.add('correct');
    } else if(idx === selectedIndex){
      b.classList.add('wrong');
    }
    b.disabled = true;
  });

  if(selectedIndex === correctIndex){
    state.score += 1;
  }

  // короткая задержка, затем следующий вопрос
  setTimeout(() => {
    state.index += 1;
    if(state.index >= quizData.length){
      finishQuiz();
    } else {
      inputLocked = false;
      renderQuestion();
    }
  }, 900);
}

function finishQuiz(){
  state.completed = true;
  // сохраняем локально, чтобы нельзя было пройти заново после перезагрузки
  localStorage.setItem(STORAGE_KEY, JSON.stringify({name: state.name, score: state.score}));
  saveLocalResult({name: state.name, score: state.score, ts: Date.now()});

  // сохраняем в Firebase если возможно
  if(firebaseEnabled){
    try{
      const ref = database.ref('scores');
      ref.push({name: state.name, score: state.score, ts: Date.now()});
    }catch(e){console.warn('Ошибка записи в Firebase', e)}
  }

  showResult();
}

function saveLocalResult(entry){
  try{
    const raw = localStorage.getItem(RESULTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if(Array.isArray(list)){
      list.push(entry);
      localStorage.setItem(RESULTS_KEY, JSON.stringify(list));
    } else {
      localStorage.setItem(RESULTS_KEY, JSON.stringify([entry]));
    }
  }catch(e){
    console.warn('Ошибка сохранения локального результата', e);
  }
}

function showResult(){
  quizScreen.classList.remove('active');
  startScreen.classList.remove('active');
  resultScreen.classList.add('active');

  resultText.textContent = `${state.name}, ты набрал(а) ${state.score} из ${quizData.length} баллов.`;
}

function renderPodium(list){
  podiumEl.innerHTML = '';
  // Подготовим массив из трёх элементов (1,2,3)
  const top = [list[1] || list[0] || {name:'—',score:0}, list[0] || {name:'—',score:0}, list[2] || {name:'—',score:0}];
  // Т.к. limitToLast даёт нам от меньшего к большему, переставляем под 1,2,3

  // высота баров пропорциональна очкам
  const maxScore = Math.max(...list.map(x=>x.score||0), 1);

  const places = ['second','first','third'];
  places.forEach((cls, i) => {
    const p = document.createElement('div');
    p.className = 'place ' + cls;
    const person = top[i] || {name:'—',score:0};
    const heightPercent = Math.round((person.score / maxScore) * 100) + '%';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = heightPercent;
    bar.innerHTML = `<div class="score">${person.score}</div>`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = person.name;
    p.appendChild(bar);
    p.appendChild(label);
    podiumEl.appendChild(p);
  });
}

// Сброс и попытка снова — очищаем локальное хранилище
retryBtn.addEventListener('click', ()=>{
  localStorage.removeItem(STORAGE_KEY);
  // опционально можно удалить только текущее имя результат
  location.reload();
});

// --- Admin: stop quiz и публикация результатов ---
const winnersWrap = document.getElementById('winners-wrap');
const winnersList = document.getElementById('winners-list');

function openAdminScreen(){
  if(adminScreen){
    adminScreen.classList.add('active');
    if(isAdminAuthenticated()){
      showAdminDashboard();
    } else {
      showAdminLogin();
    }
  }
}

function closeAdminScreen(){
  if(adminScreen){
    adminScreen.classList.remove('active');
  }
}

function isAdminAuthenticated(){
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

function authenticateAdmin(){
  const password = adminPassword?.value || '';
  if(password === ADMIN_PASSWORD){
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    showAdminDashboard();
  } else {
    alert('Неверный пароль администратора');
    adminPassword.value = '';
  }
}

function logoutAdmin(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  closeAdminScreen();
}

function showAdminLogin(){
  const adminLoginContainer = document.getElementById('admin-login');
  if(adminLoginContainer) adminLoginContainer.style.display = 'block';
  if(adminDashboard) adminDashboard.style.display = 'none';
  if(adminLoginBtn) adminLoginBtn.style.display = 'inline-flex';
  if(adminCloseLoginBtn) adminCloseLoginBtn.style.display = 'inline-flex';
}

function showAdminDashboard(){
  const adminLoginContainer = document.getElementById('admin-login');

  if(adminLoginContainer) adminLoginContainer.style.display = 'none';
  if(adminDashboard) adminDashboard.style.display = 'block';
  if(adminLoginBtn) adminLoginBtn.style.display = 'none';
  if(adminCloseLoginBtn) adminCloseLoginBtn.style.display = 'none';
  if(adminPassword) adminPassword.value = '';

  refreshAdminResults();

  if(firebaseEnabled && database){
    database.ref('scores').off('value');

    database.ref('scores').on('value', snap => {
      const arr = [];
      snap.forEach(child => arr.push(child.val()));
      renderParticipants(sortAdminParticipants(arr));
    });
  }
}


function renderParticipants(list){
  if(!participantsList) return;
  participantsList.innerHTML = '';
  if(!list || list.length === 0){
    participantsList.textContent = 'Пока нет данных о результатах.';
    return;
  }
  const table = document.createElement('table');
  table.className = 'participants-table';
  const headers = [
    {key:'name', title:'Имя'},
    {key:'score', title:'Очки'},
    {key:'ts', title:'Дата'}
  ];
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>#</th>' + headers.map(h => {
    const arrow = adminSortField === h.key ? (adminSortDirection === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-sort="${h.key}">${h.title}${arrow}</th>`;
  }).join('');
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  list.forEach((item, index) => {
    const tr = document.createElement('tr');
    const date = item.ts ? new Date(item.ts).toLocaleString('ru-RU') : '-';
    tr.innerHTML = `<td>${index + 1}</td><td>${item.name || 'Гость'}</td><td>${item.score || 0}</td><td>${date}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  participantsList.appendChild(table);
  thead.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => updateAdminSort(th.dataset.sort));
  });
}

async function refreshAdminResults(){
  if(!participantsList) return;

  if(!firebaseEnabled || !database){
    participantsList.textContent = 'Firebase не подключён.';
    return;
  }

  try{
    const snap = await database.ref('scores').once('value');
    const arr = [];

    snap.forEach(child => {
      arr.push(child.val());
    });

    renderParticipants(sortAdminParticipants(arr));
  } catch(e){
    console.warn('Ошибка загрузки результатов из Firebase', e);
    participantsList.textContent = 'Ошибка загрузки результатов из Firebase.';
  }
}

const resetModal = document.getElementById('reset-modal');
const resetConfirmBtn = document.getElementById('reset-confirm-btn');
const resetCancelBtn = document.getElementById('reset-cancel-btn');

if(openAdminBtn) openAdminBtn.addEventListener('click', openAdminScreen);
if(adminLoginBtn) adminLoginBtn.addEventListener('click', authenticateAdmin);
if(adminCloseLoginBtn) adminCloseLoginBtn.addEventListener('click', closeAdminScreen);
if(adminStopBtn) adminStopBtn.addEventListener('click', stopQuizByAdmin);
if(adminResetBtn) adminResetBtn.addEventListener('click', resetQuizStop);
if(adminClearBtn) adminClearBtn.addEventListener('click', openResetModal);
if(adminRefreshBtn) adminRefreshBtn.addEventListener('click', refreshAdminResults);
if(adminLogoutBtn) adminLogoutBtn.addEventListener('click', logoutAdmin);
if(resetConfirmBtn) resetConfirmBtn.addEventListener('click', clearQuizResults);
if(resetCancelBtn) resetCancelBtn.addEventListener('click', closeResetModal);

// Слушаем состояние остановки квиза, чтобы показывать таблицу на старте
if(firebaseEnabled){
  const ctrlRef = database.ref('control/stop');
  ctrlRef.on('value', snap => {
    const v = snap.val();
    if(v && v.stopped){
      fetchAndRenderWinners();
    } else {
      if(winnersWrap) winnersWrap.style.display = 'none';
      const card = startScreen.querySelector('.start-card'); if(card) card.style.display='flex';
    }
  });
  database.ref('control/stop').once('value', snap => {
    const v = snap.val(); if(v && v.stopped) fetchAndRenderWinners();
  });
} else {
  const localStopped = localStorage.getItem('quiz_stopped_v1');
  if(localStopped){
    const parsed = JSON.parse(localStopped);
    if(parsed && parsed.stopped){
      renderWinners(parsed.winners || []);
      if(winnersWrap) winnersWrap.style.display = 'block';
      const card = startScreen.querySelector('.start-card'); if(card) card.style.display='none';
    }
  }
}

async function stopQuizByAdmin(){
  if(!firebaseEnabled){
    const arr = [{name: state.name||'—', score: state.score||0, ts: Date.now()}];
    localStorage.setItem('quiz_stopped_v1', JSON.stringify({stopped:true, winners:arr}));
    renderWinners(arr);
    if(winnersWrap) winnersWrap.style.display = 'block';
    const card = startScreen.querySelector('.start-card'); if(card) card.style.display='none';
    return;
  }
  try{
    const snap = await database.ref('scores').once('value');
    const arr = [];
    snap.forEach(child => arr.push(child.val()));
    arr.sort((a,b)=>b.score - a.score);
    const top = arr.slice(0,10);
    await database.ref('control/winners').set(top);
    await database.ref('control/stop').set({stopped:true, ts: Date.now()});
  }catch(e){
    console.warn('Ошибка при остановке и публикации топа', e);
  }
}

async function resetQuizStop(){
  if(!firebaseEnabled){
    localStorage.removeItem('quiz_stopped_v1');
    if(winnersWrap) winnersWrap.style.display = 'none';
    const card = startScreen.querySelector('.start-card'); if(card) card.style.display='flex';
    return;
  }
  try{
    await database.ref('control/stop').set({stopped:false, ts: Date.now()});
    await database.ref('control/winners').remove();
    if(winnersWrap) winnersWrap.style.display = 'none';
    const card = startScreen.querySelector('.start-card'); if(card) card.style.display='flex';
  }catch(e){console.warn('Ошибка сброса остановки', e)}
}

function openResetModal(){
  if(resetModal) resetModal.classList.remove('hidden');
}

function closeResetModal(){
  if(resetModal) resetModal.classList.add('hidden');
}

async function clearQuizResults(){
  closeResetModal();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('quiz_stopped_v1');
  if(firebaseEnabled){
    try{
      await database.ref('scores').remove();
      await database.ref('control/winners').remove();
      await database.ref('control/stop').set({stopped:false, ts: Date.now()});
      refreshAdminResults();
      if(winnersWrap) winnersWrap.style.display = 'none';
      const card = startScreen.querySelector('.start-card'); if(card) card.style.display='flex';
      alert('Результаты сброшены. Теперь можно тестировать квиз заново.');
    }catch(e){
      console.warn('Ошибка при сбросе результатов', e);
      alert('Не удалось сбросить результаты. Проверьте консоль.');
    }
  } else {
    if(winnersWrap) winnersWrap.style.display = 'none';
    const card = startScreen.querySelector('.start-card'); if(card) card.style.display='flex';
    refreshAdminResults();
    alert('Локальные результаты сброшены.');
  }
}

function fetchAndRenderWinners(){
  if(!firebaseEnabled){
    const local = localStorage.getItem(STORAGE_KEY);
    if(local){ const one = JSON.parse(local); renderWinners([one]); }
    if(winnersWrap) winnersWrap.style.display = 'block';
    const card = startScreen.querySelector('.start-card'); if(card) card.style.display='none';
    return;
  }
  database.ref('control/winners').once('value', snap => {
    const arr = [];
    snap.forEach(child => arr.push(child.val()));
    renderWinners(arr);
    if(winnersWrap) winnersWrap.style.display = arr.length? 'block':'none';
    const card = startScreen.querySelector('.start-card'); if(card && arr.length) card.style.display='none';
  }, err => { console.warn('Ошибка получения победителей', err); });
}

function renderWinners(list){
  if(!winnersList) return;
  winnersList.innerHTML = '';
  if(!list || list.length === 0){ winnersList.textContent = 'Победители пока не объявлены.'; return; }
  const table = document.createElement('table'); table.className = 'winners-table';
  const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>#</th><th>Имя</th><th>Очки</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  list.forEach((p,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${p.name || '—'}</td><td>${p.score || 0}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  winnersList.appendChild(table);
}

// Инициализация: если уже выполнен — показываем результаты, иначе привязываем старт
if(!checkLocalCompleted()){
  if(startBtn) startBtn.addEventListener('click', startQuiz);
}

// --- Конец ---
