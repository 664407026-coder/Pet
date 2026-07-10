// 1. นำ Config จาก Firebase Console ของคุณมาวางที่นี่
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// เริ่มต้นใช้งาน Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. ตัวแปรอ้างอิง HTML Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

const playerName = document.getElementById('player-name');
const petLevelEl = document.getElementById('pet-level');
const expFill = document.getElementById('exp-fill');
const petSprite = document.querySelector('.pet-sprite');

const addQuestForm = document.getElementById('add-quest-form');
const questInput = document.getElementById('quest-input');
const taskList = document.getElementById('task-list');

let currentUser = null;
let petData = null;

// 3. ระบบ Authentication
loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => console.error(error));
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// ตรวจสอบสถานะล็อกอิน (ทำงานอัตโนมัติเมื่อเปิดเว็บ)
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        playerName.textContent = user.displayName;
        initPetData();
        loadQuests();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// 4. จัดการข้อมูลสัตว์เลี้ยง (Level, EXP)
function initPetData() {
    const userRef = db.collection('users').doc(currentUser.uid);
    
    // อัปเดตข้อมูลแบบ Real-time
    userRef.onSnapshot((doc) => {
        if (doc.exists) {
            petData = doc.data();
            updatePetUI();
        } else {
            // สร้างข้อมูลผู้ใช้ใหม่ถ้าเพิ่งล็อกอินครั้งแรก
            userRef.set({
                level: 1,
                exp: 0,
                hp: 100
            });
        }
    });
}

function updatePetUI() {
    petLevelEl.textContent = petData.level;
    expFill.style.width = `${petData.exp}%`;
    
    // เปลี่ยนร่างตามเลเวล (ใช้ Emoji ง่ายๆ)
    if (petData.level >= 10) petSprite.textContent = '🐉'; // มังกร
    else if (petData.level >= 5) petSprite.textContent = '🦖'; // ไดโนเสาร์
    else petSprite.textContent = '🥚'; // ไข่
}

// 5. ระบบเพิ่มเควสต์ (Create)
addQuestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = questInput.value.trim();
    if (!title) return;

    db.collection('users').doc(currentUser.uid).collection('habits').add({
        title: title,
        lastCompleted: null // ยังไม่เคยทำ
    }).then(() => {
        questInput.value = ''; // ล้างฟอร์ม
    });
});

// 6. ดึงข้อมูลเควสต์ (Read แบบ Real-time)
function loadQuests() {
    db.collection('users').doc(currentUser.uid).collection('habits')
        .onSnapshot((snapshot) => {
            taskList.innerHTML = ''; // ล้างของเก่าก่อนวาดใหม่
            
            snapshot.forEach((doc) => {
                const quest = doc.data();
                const questId = doc.id;
                
                // ตรวจสอบว่าวันนี้ทำไปหรือยัง (รีเซ็ตปุ่ม)
                let isDoneToday = false;
                if (quest.lastCompleted) {
                    const lastDate = quest.lastCompleted.toDate().toDateString();
                    const todayDate = new Date().toDateString();
                    isDoneToday = (lastDate === todayDate);
                }

                renderQuestCard(questId, quest.title, isDoneToday);
            });
        });
}

// 7. สร้าง UI ของแต่ละเควสต์
function renderQuestCard(id, title, isDoneToday) {
    const card = document.createElement('div');
    card.className = 'task-card';
    
    const text = document.createElement('span');
    text.textContent = title;
    
    const btn = document.createElement('button');
    btn.className = `btn-pixel ${isDoneToday ? '' : 'btn-success'}`;
    btn.textContent = isDoneToday ? 'รอพรุ่งนี้' : '+20 EXP';
    btn.disabled = isDoneToday;
    
    // เมื่อกดปุ่ม +EXP
    btn.onclick = () => completeQuest(id);

    card.appendChild(text);
    card.appendChild(btn);
    taskList.appendChild(card);
}

// 8. กลไกเกม: อัปเดต EXP และ Level (Update)
function completeQuest(questId) {
    const userRef = db.collection('users').doc(currentUser.uid);
    const questRef = userRef.collection('habits').doc(questId);
    
    // บันทึกเวลาที่ทำเควสต์สำเร็จ
    questRef.update({
        lastCompleted: firebase.firestore.FieldValue.serverTimestamp()
    });

    // คำนวณ EXP ใหม่ (+20 ต่อ 1 เควสต์)
    let newExp = petData.exp + 20;
    let newLevel = petData.level;

    // ระบบ Level Up (ครบ 100 EXP = เลเวลอัป)
    if (newExp >= 100) {
        newLevel += 1;
        newExp = newExp - 100;
        alert(`🎉 ยินดีด้วย! สัตว์เลี้ยงของคุณอัปเป็นเลเวล ${newLevel} แล้ว!`);
    }

    userRef.update({
        exp: newExp,
        level: newLevel
    });
}