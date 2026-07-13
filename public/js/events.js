// 干擾事件動畫：移植自原版 main.html 的
// handle_chalk_event() / handle_ufo_event() / teacher_move() / teacher_move_back()
// 時間軸與圖片切換完全沿用原版數值。
const $id = (id) => document.getElementById(id);

// 粉筆攻擊：玩家選擇閃躲方向後，粉筆隨機從左/右飛來。
// 躲錯邊 → 老師被打中 → state.chalkAttack = true（憤怒攻擊 4 回合）。
export function handleChalkEvent(dodge, state) {
  const chalkDirection = ['left', 'right'];
  const rand = Math.floor(Math.random() * 2);
  state.dodgeCond = true;

  const teacher = $id('img_teacher');
  const disruptor1 = $id('img_disruptor1');

  if (dodge === 'left') {
    teacher.src = 'img/S__234823688.png';
    setTimeout(() => { teacher.src = 'img/S__234823693.png'; }, 300);
    setTimeout(() => { teacher.src = 'img/S__234823696.png'; }, 400);
  } else {
    setTimeout(() => { teacher.src = 'img/S__234831875.png'; }, 300);
    setTimeout(() => { teacher.src = 'img/S__234831880.png'; }, 500);
  }

  if (chalkDirection[rand] === 'left') {
    disruptor1.src = 'img/S__234766351.png';
    setTimeout(() => { disruptor1.src = 'img/S__234766352.png'; }, 100);
    setTimeout(() => {
      const chalk2 = $id('chalk2');
      chalk2.style.display = 'block';
      chalk2.style.right = '35vw';
      chalk2.style.bottom = '45vh';
      setTimeout(() => {
        if (dodge === 'right') {
          $id('attack_miss').style.display = 'block';
        }
      }, 600);
      setTimeout(() => {
        chalk2.style.display = 'none';
        if (dodge === 'left') {
          state.chalkAttack = true;
        } else {
          setTimeout(() => { $id('attack_miss').style.display = 'none'; }, 1000);
        }
      }, 700);
    }, 160);
    setTimeout(() => { disruptor1.src = 'img/S__234766353.png'; }, 320);
    if (dodge === 'left') {
      setTimeout(() => {
        $id('img_attacked').style.display = 'block';
        $id('angry').style.display = 'block';
      }, 600);
      setTimeout(() => { $id('img_attacked').style.display = 'none'; }, 1050);
    }
  } else {
    disruptor1.src = 'img/S__234766351.png';
    setTimeout(() => { disruptor1.src = 'img/S__234766352.png'; }, 100);
    setTimeout(() => {
      const chalk1 = $id('chalk1');
      chalk1.style.display = 'block';
      chalk1.style.right = '35vw';
      chalk1.style.bottom = '40vh';
      setTimeout(() => {
        if (dodge === 'left') {
          $id('attack_miss').style.display = 'block';
        }
      }, 600);
      setTimeout(() => {
        chalk1.style.display = 'none';
        if (dodge === 'left') {
          setTimeout(() => { $id('attack_miss').style.display = 'none'; }, 1000);
        } else {
          state.chalkAttack = true;
        }
      }, 700);
    }, 160);
    setTimeout(() => { disruptor1.src = 'img/S__234766353.png'; }, 320);
    if (dodge === 'right') {
      setTimeout(() => {
        $id('img_attacked2').style.display = 'block';
        $id('angry2').style.display = 'block';
      }, 600);
      setTimeout(() => { $id('img_attacked2').style.display = 'none'; }, 1050);
    }
  }
  setTimeout(() => { state.dodgeCond = false; }, 1050);
}

// 看飛碟：老師走到窗邊看約 5.6 秒（期間可安心睡覺）
export function handleUfoEvent(state) {
  const teacher = $id('img_teacher');
  $id('img_ufo_text').style.display = 'block';
  teacher.src = 'img/IMG_0163.png';
  $id('img_disruptor1').src = 'img/IMG_0248.png';
  setTimeout(() => { $id('img_disruptor1').src = 'img/S__234766353.png'; }, 1000);
  teacherMove(11);
  setTimeout(() => {
    teacher.src = 'img/IMG_0164.png';
    teacherMoveBack(55);
  }, 2800);
  setTimeout(() => { state.ufoEvent = false; }, 5600);
  setTimeout(() => { $id('img_ufo_text').style.display = 'none'; }, 1200);
}

function teacherMove(teachX) {
  if (teachX < 55) {
    setTimeout(() => {
      teachX += 1;
      $id('img_teacher').style.left = `${teachX}vw`;
      teacherMove(teachX);
    }, 50);
  }
}

function teacherMoveBack(teachX) {
  if (teachX > 10) {
    setTimeout(() => {
      teachX -= 1;
      $id('img_teacher').style.left = `${teachX}vw`;
      teacherMoveBack(teachX);
    }, 50);
  }
}
