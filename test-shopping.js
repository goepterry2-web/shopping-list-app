const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;
const log = [];

function ok(label, val) {
  const sym = val ? '✅' : '❌';
  console.log(`${sym} ${label}`);
  log.push({ sym, label });
  if (val) passed++; else failed++;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage({ viewport: { width: 520, height: 800 } });

  async function waitForCount(n) {
    await page.waitForFunction(
      count => document.querySelectorAll('.item').length === count,
      n,
      { timeout: 6000 }
    );
  }

  // 시작 전 Supabase의 shopping_items 테이블 비우기 (id는 항상 1 이상이므로 neq(0) = 전체)
  await page.goto(FILE);
  await page.waitForFunction(() => typeof db !== 'undefined');
  await page.evaluate(async () => {
    await db.from('shopping_items').delete().neq('id', 0);
  });
  await page.reload();
  await waitForCount(0);

  console.log('\n📋 쇼핑 리스트 앱 자동 테스트 (Supabase 연동)\n');

  // ── 1. 아이템 추가 ──────────────────────────────────────────
  console.log('[ 1. 아이템 추가 ]');

  await page.fill('#item-input', '우유');
  await page.press('#item-input', 'Enter');
  await waitForCount(1);
  let items = await page.$$('.item');
  ok('Enter 키로 아이템 추가', items.length === 1);

  await page.fill('#item-input', '계란');
  await page.click('#add-btn');
  await waitForCount(2);
  items = await page.$$('.item');
  ok('버튼 클릭으로 아이템 추가', items.length === 2);

  await page.fill('#item-input', '빵');
  await page.press('#item-input', 'Enter');
  await waitForCount(3);
  items = await page.$$('.item');
  ok('3번째 아이템 추가', items.length === 3);

  // 빈 입력 시 추가 안 됨
  await page.fill('#item-input', '   ');
  await page.press('#item-input', 'Enter');
  await page.waitForTimeout(800);
  items = await page.$$('.item');
  ok('빈 입력 시 아이템 추가 안 됨', items.length === 3);

  // 통계 확인
  const statTotal = await page.textContent('#stat-total');
  ok('전체 카운트 = 3', statTotal === '3');

  // ── 2. 체크(완료) 기능 ─────────────────────────────────────
  console.log('\n[ 2. 체크 기능 ]');

  const firstCheck = page.locator('.item-check').first();
  const firstItem = page.locator('.item').first();

  await firstCheck.click();
  await page.waitForFunction(
    () => document.querySelector('.item')?.classList.contains('done') === true,
    { timeout: 6000 }
  );
  const isDone = await firstItem.evaluate(el => el.classList.contains('done'));
  ok('체크 클릭 → done 클래스 추가', isDone);

  const hasStrike = await firstItem.locator('.item-text').evaluate(
    el => getComputedStyle(el).textDecoration.includes('line-through')
  );
  ok('완료 아이템 취소선 표시', hasStrike);

  const statDone = await page.textContent('#stat-done');
  ok('완료 카운트 = 1', statDone === '1');

  const statLeft = await page.textContent('#stat-left');
  ok('남은 것 카운트 = 2', statLeft === '2');

  // 토글: 체크 해제
  await firstCheck.click();
  await page.waitForFunction(
    () => document.querySelector('.item')?.classList.contains('done') === false,
    { timeout: 6000 }
  );
  const isUndone = await firstItem.evaluate(el => !el.classList.contains('done'));
  ok('재클릭 시 체크 해제(토글)', isUndone);

  // ── 3. 필터 기능 ───────────────────────────────────────────
  console.log('\n[ 3. 필터 기능 ]');

  // 첫 번째 아이템 체크
  await firstCheck.click();
  await page.waitForFunction(
    () => document.querySelector('.item')?.classList.contains('done') === true,
    { timeout: 6000 }
  );

  await page.click('[data-filter="done"]');
  items = await page.$$('.item');
  ok('완료 필터 → 완료 항목만 표시', items.length === 1);

  await page.click('[data-filter="active"]');
  items = await page.$$('.item');
  ok('미완료 필터 → 미완료 항목만 표시', items.length === 2);

  await page.click('[data-filter="all"]');
  items = await page.$$('.item');
  ok('전체 필터 → 모든 항목 표시', items.length === 3);

  // ── 4. 아이템 삭제 ─────────────────────────────────────────
  console.log('\n[ 4. 아이템 삭제 ]');

  const deleteBtns = page.locator('.btn-delete');
  await deleteBtns.first().click();
  await waitForCount(2);
  items = await page.$$('.item');
  ok('× 버튼으로 아이템 삭제', items.length === 2);

  const statAfterDel = await page.textContent('#stat-total');
  ok('삭제 후 전체 카운트 = 2', statAfterDel === '2');

  // ── 5. 완료 항목 일괄 삭제 ─────────────────────────────────
  console.log('\n[ 5. 완료 항목 일괄 삭제 ]');

  // 남은 2개 모두 체크
  const checks = page.locator('.item-check');
  await checks.nth(0).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.item.done').length === 1,
    { timeout: 6000 }
  );
  await checks.nth(1).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.item.done').length === 2,
    { timeout: 6000 }
  );

  const clearDisabled = await page.$eval('#clear-btn', el => el.disabled);
  ok('"완료 항목 삭제" 버튼 활성화', !clearDisabled);

  await page.click('#clear-btn');
  await waitForCount(0);
  items = await page.$$('.item');
  ok('완료 항목 일괄 삭제 후 리스트 비어있음', items.length === 0);

  const emptyVisible = await page.$('.empty');
  ok('빈 상태 메시지 표시', emptyVisible !== null);

  // ── 6. Supabase 영속성 ─────────────────────────────────────
  console.log('\n[ 6. Supabase 영속성 ]');

  await page.fill('#item-input', '사과');
  await page.press('#item-input', 'Enter');
  await waitForCount(1);
  await page.fill('#item-input', '오렌지');
  await page.press('#item-input', 'Enter');
  await waitForCount(2);

  await page.reload();
  await page.waitForSelector('.item');
  items = await page.$$('.item');
  ok('새로고침 후 아이템 유지 (Supabase)', items.length === 2);

  // ── 최종 스크린샷 ─────────────────────────────────────────
  await page.fill('#item-input', '바나나');
  await page.press('#item-input', 'Enter');
  await waitForCount(3);
  await page.locator('.item-check').first().click();
  await page.waitForFunction(
    () => document.querySelector('.item')?.classList.contains('done') === true,
    { timeout: 6000 }
  );
  await page.screenshot({ path: 'test-result.png', fullPage: false });

  // 테스트로 남긴 데이터 정리
  await page.evaluate(async () => {
    await db.from('shopping_items').delete().neq('id', 0);
  });

  // ── 결과 요약 ─────────────────────────────────────────────
  console.log('\n' + '─'.repeat(40));
  console.log(`결과: ${passed} 통과 / ${failed} 실패 / 전체 ${passed + failed}`);
  if (failed === 0) console.log('🎉 모든 테스트 통과!');
  else console.log('⚠️  일부 테스트 실패');
  console.log('스크린샷 저장: test-result.png');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
