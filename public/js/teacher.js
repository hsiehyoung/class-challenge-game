// 老師狀態機：移植自原版 main.html 的 changeTeacher()
// 每 1.5 秒被呼叫一次，隨機切換老師動作圖；
// turnPrepare = 預備轉身、isTurn = 正在看學生（此時睡覺會被抓）、
// chalkAttack = 被粉筆打中後的憤怒攻擊（連續 4 回合緊盯學生）。
const $id = (id) => document.getElementById(id);

export function changeTeacher(state) {
  let rand = Math.floor(Math.random() * 5);
  if (state.turnPrepare) {
    rand = Math.floor(Math.random() * (4 - 3 + 1) + 3);
  }
  if (state.isTurn) {
    rand = Math.floor(Math.random() * (7 - 5 + 1) + 5);
  }
  if (state.chalkAttack && state.chalkAttackCount < 4) {
    rand = Math.floor(Math.random() * (9 - 8 + 1) + 8);
    state.isTurn = true;
    state.chalkAttackCount += 1;
    if (state.chalkAttackCount === 4) {
      state.chalkAttack = false;
      state.chalkAttackCount = 0;
    }
  }

  const teacher = $id('img_teacher');
  switch (rand) {
    case 0:
      teacher.src = 'img/IMG_0157.png';
      state.turnPrepare = false;
      state.isTurn = false;
      break;
    case 1:
      teacher.src = 'img/IMG_0158.png';
      state.turnPrepare = false;
      state.isTurn = false;
      break;
    case 2:
      teacher.src = 'img/IMG_0163.png';
      state.turnPrepare = true;
      state.isTurn = false;
      break;
    case 3:
      teacher.src = 'img/IMG_0160.png';
      state.turnPrepare = false;
      state.isTurn = false;
      break;
    case 4:
      if (state.turnPrepare) {
        teacher.src = 'img/IMG_0154.png';
        state.isTurn = true;
      } else {
        teacher.src = 'img/IMG_0160.png';
        state.isTurn = false;
      }
      break;
    case 5:
      teacher.src = 'img/IMG_0160.png';
      state.turnPrepare = false;
      state.isTurn = false;
      break;
    case 6:
      teacher.src = 'img/IMG_0154.png';
      state.isTurn = true;
      break;
    case 7:
      teacher.src = 'img/IMG_0149.png';
      state.isTurn = true;
      break;
    case 8:
    case 9:
      $id('angry').style.display = 'none';
      $id('angry2').style.display = 'none';
      teacher.src = 'img/123.gif';
      state.isTurn = true;
      break;
  }
}
