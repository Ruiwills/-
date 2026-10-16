const STORAGE_KEYS = { employees: 'payroll_employees', statements: 'payroll_statements' };

let employees = load(STORAGE_KEYS.employees, []);
let statements = load(STORAGE_KEYS.statements, []);

/* ---------- Утилиты ---------- */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save() {
  localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
  localStorage.setItem(STORAGE_KEYS.statements, JSON.stringify(statements));
}
function fmt(n) {
  return (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Вкладки ---------- */
document.querySelectorAll('.tabs__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs__btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ============ 1. СОТРУДНИКИ ============ */
const empForm = document.getElementById('employee-form');

empForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('emp-id').value;
  const data = {
    name: document.getElementById('emp-name').value.trim(),
    position: document.getElementById('emp-position').value.trim(),
    type: document.getElementById('emp-type').value,
    rate: parseFloat(document.getElementById('emp-rate').value) || 0,
    tax: parseFloat(document.getElementById('emp-tax').value) || 0,
  };
  if (!data.name || !data.position || data.rate <= 0) {
    toast('Заполните ФИО, должность и ставку', true);
    return;
  }
  if (id) {
    const emp = employees.find(x => x.id === id);
    Object.assign(emp, data);
    toast('Данные сотрудника обновлены');
  } else {
    employees.push({ id: uid(), ...data });
    toast('Сотрудник добавлен');
  }
  resetEmpForm();
  renderEmployees();
  renderPayrollTable();
  save();
});

function resetEmpForm() {
  empForm.reset();
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-tax').value = 13;
  document.getElementById('emp-submit').textContent = 'Добавить сотрудника';
  document.getElementById('emp-cancel').hidden = true;
}
document.getElementById('emp-cancel').addEventListener('click', resetEmpForm);

function editEmployee(id) {
  const emp = employees.find(x => x.id === id);
  if (!emp) return;
  document.getElementById('emp-id').value = emp.id;
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-position').value = emp.position;
  document.getElementById('emp-type').value = emp.type;
  document.getElementById('emp-rate').value = emp.rate;
  document.getElementById('emp-tax').value = emp.tax;
  document.getElementById('emp-submit').textContent = 'Сохранить изменения';
  document.getElementById('emp-cancel').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEmployee(id) {
  const emp = employees.find(x => x.id === id);
  if (!confirm(`Удалить сотрудника «${emp.name}»?`)) return;
  employees = employees.filter(x => x.id !== id);
  renderEmployees();
  renderPayrollTable();
  save();
  toast('Сотрудник удалён');
}

function renderEmployees() {
  const tbody = document.getElementById('employees-tbody');
  document.getElementById('emp-count').textContent = employees.length;
  document.getElementById('employees-empty').style.display = employees.length ? 'none' : 'block';
  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td>${esc(emp.name)}</td>
      <td>${esc(emp.position)}</td>
      <td>${emp.type === 'salary' ? 'Оклад / мес' : 'Часовая'}</td>
      <td class="money">${fmt(emp.rate)}</td>
      <td>${fmt(emp.tax)} %</td>
      <td class="td-actions">
        <button class="btn btn--ghost btn--small" onclick="editEmployee('${emp.id}')">Изменить</button>
        <button class="btn btn--danger btn--small" onclick="deleteEmployee('${emp.id}')">Удалить</button>
      </td>
    </tr>`).join('');
}

/* ============ 2. НАЧИСЛЕНИЯ ============ */
// inputs[empId] = { worked, bonus, advance, other }
let inputs = {};
let lastCalc = null;

function renderPayrollTable() {
  const tbody = document.getElementById('payroll-tbody');
  const empty = document.getElementById('payroll-empty');
  empty.style.display = employees.length ? 'none' : 'block';
  document.getElementById('calc-btn').disabled = !employees.length;

  tbody.innerHTML = employees.map(emp => {
    const v = inputs[emp.id] || {};
    const isHourly = emp.type === 'hourly';
    const placeholder = isHourly ? 'часы' : 'дни';
    return `
    <tr data-id="${emp.id}">
      <td><strong>${esc(emp.name)}</strong><br><small style="color:var(--muted)">${esc(emp.position)} · ${isHourly ? fmt(emp.rate) + ' ₽/час' : 'оклад ' + fmt(emp.rate) + ' ₽'}</small></td>
      <td><input type="number" class="js-worked wide" min="0" step="0.5" placeholder="${placeholder}" value="${v.worked ?? ''}"></td>
      <td><input type="number" class="js-bonus" min="0" step="0.01" placeholder="0" value="${v.bonus ?? ''}"></td>
      <td><input type="number" class="js-advance" min="0" step="0.01" placeholder="0" value="${v.advance ?? ''}"></td>
      <td><input type="number" class="js-other" min="0" step="0.01" placeholder="0" value="${v.other ?? ''}"></td>
      <td class="money js-accrued">—</td>
      <td class="money js-tax neg">—</td>
      <td class="money js-net pos">—</td>
      <td class="td-actions"><button class="btn btn--ghost btn--small js-slip" disabled>Листок</button></td>
    </tr>`;
  }).join('');
  document.getElementById('payroll-tfoot').innerHTML = '';
  document.getElementById('save-btn').disabled = true;
  lastCalc = null;
}

// сбор введённых данных
function collectInputs() {
  document.querySelectorAll('#payroll-tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    const num = sel => parseFloat(tr.querySelector(sel).value) || 0;
    inputs[id] = { worked: num('.js-worked'), bonus: num('.js-bonus'), advance: num('.js-advance'), other: num('.js-other') };
  });
}

// расчёт одного сотрудника
function calcEmployee(emp, workedDays, bonus, advance, other, periodDays) {
  let base;
  if (emp.type === 'hourly') {
    base = emp.rate * workedDays;                 // workedDays здесь = отработанные часы
  } else {
    base = emp.rate * Math.min(workedDays, periodDays) / periodDays;
  }
  const accrued = base + bonus;                   // начислено = база + премия
  const tax = accrued * emp.tax / 100;            // НДФЛ
  const deductions = tax + advance + other;       // все удержания
  const net = accrued - deductions;               // к выдаче
  return { base, bonus, accrued, tax, advance, other, deductions, net };
}

document.getElementById('calc-btn').addEventListener('click', () => {
  if (!employees.length) return;
  collectInputs();
  const periodDays = parseInt(document.getElementById('period-days').value) || 22;
  let tAcc = 0, tTax = 0, tNet = 0, tDed = 0;
  lastCalc = { month: document.getElementById('period-month').value || new Date().toISOString().slice(0, 7), days: periodDays, rows: [] };

  document.querySelectorAll('#payroll-tbody tr').forEach(tr => {
    const emp = employees.find(x => x.id === tr.dataset.id);
    const v = inputs[emp.id];
    const r = calcEmployee(emp, v.worked, v.bonus, v.advance, v.other, periodDays);
    tr.querySelector('.js-accrued').textContent = fmt(r.accrued);
    tr.querySelector('.js-tax').textContent = '− ' + fmt(r.tax);
    tr.querySelector('.js-net').textContent = fmt(r.net);
    tr.querySelector('.js-slip').disabled = false;
    tAcc += r.accrued; tTax += r.tax; tNet += r.net; tDed += r.deductions;
    lastCalc.rows.push({ emp: { ...emp }, worked: v.worked, ...r });
  });

  document.getElementById('payroll-tfoot').innerHTML = `
    <tr>
      <td colspan="5">ИТОГО</td>
      <td class="money">${fmt(tAcc)}</td>
      <td class="money neg">− ${fmt(tTax)}</td>
      <td class="money pos">${fmt(tNet)}</td>
      <td></td>
    </tr>
    <tr><td colspan="9" style="color:var(--muted);font-size:12px">Всего удержано (налог + аванс + прочие): ${fmt(tDed)} ₽</td></tr>`;
  document.getElementById('save-btn').disabled = false;
  toast('Расчёт выполнен');
});

// расчётный листок
document.getElementById('payroll-tbody').addEventListener('click', e => {
  if (!e.target.classList.contains('js-slip') || !lastCalc) return;
  const id = e.target.closest('tr').dataset.id;
  const row = lastCalc.rows.find(r => r.emp.id === id);
  const isHourly = row.emp.type === 'hourly';
  document.getElementById('payslip-meta').textContent =
    `${row.emp.name} · ${row.emp.position} · ${monthName(lastCalc.month)}`;
  document.getElementById('payslip-body').innerHTML = `
    <div class="payslip__row"><span>${isHourly ? 'Отработано часов × ставка' : `Оклад за ${lastCalc.days} раб. дней (отработано: ${row.worked})`}</span><span class="money">${fmt(row.base)} ₽</span></div>
    <div class="payslip__row"><span>Премия и бонусы</span><span class="money pos">+ ${fmt(row.bonus)} ₽</span></div>
    <div class="payslip__row"><span><strong>Всего начислено</strong></span><span class="money"><strong>${fmt(row.accrued)} ₽</strong></span></div>
    <div class="payslip__row"><span>НДФЛ (${fmt(row.emp.tax)} %)</span><span class="money neg">− ${fmt(row.tax)} ₽</span></div>
    <div class="payslip__row"><span>Аванс</span><span class="money neg">− ${fmt(row.advance)} ₽</span></div>
    <div class="payslip__row"><span>Прочие удержания</span><span class="money neg">− ${fmt(row.other)} ₽</span></div>
    <div class="payslip__row total"><span>К выдаче</span><span>${fmt(row.net)} ₽</span></div>`;
  document.getElementById('payslip-panel').hidden = false;
  document.getElementById('payslip-panel').scrollIntoView({ behavior: 'smooth' });
});

/* ============ 3. ВЕДОМОСТИ ============ */
document.getElementById('save-btn').addEventListener('click', () => {
  if (!lastCalc) return;
  statements.unshift({ id: uid(), created: new Date().toISOString(), ...lastCalc });
  save();
  renderStatements();
  toast('Ведомость сохранена');
});

function deleteStatement(id) {
  if (!confirm('Удалить ведомость?')) return;
  statements = statements.filter(s => s.id !== id);
  save();
  renderStatements();
  toast('Ведомость удалена');
}

function renderStatements() {
  const list = document.getElementById('statements-list');
  document.getElementById('statements-empty').style.display = statements.length ? 'none' : 'block';
  list.innerHTML = statements.map(st => {
    const total = st.rows.reduce((a, r) => a + r.net, 0);
    return `
    <div class="statement">
      <div class="statement__head" onclick="this.parentElement.classList.toggle('open')">
        <h3>Ведомость — ${monthName(st.month)} <span style="color:var(--muted);font-weight:400">(${st.rows.length} чел., сохранено ${new Date(st.created).toLocaleDateString('ru-RU')})</span></h3>
        <div>
          <span class="sum">${fmt(total)} ₽</span>
          <button class="btn btn--danger btn--small" style="margin-left:12px" onclick="event.stopPropagation();deleteStatement('${st.id}')">Удалить</button>
        </div>
      </div>
      <div class="statement__body table-wrap">
        <table>
          <thead><tr><th>Сотрудник</th><th>Начислено, ₽</th><th>Налог, ₽</th><th>Удержания, ₽</th><th>К выдаче, ₽</th></tr></thead>
          <tbody>
            ${st.rows.map(r => `
              <tr>
                <td>${esc(r.emp.name)}</td>
                <td class="money">${fmt(r.accrued)}</td>
                <td class="money neg">− ${fmt(r.tax)}</td>
                <td class="money neg">− ${fmt(r.advance + r.other)}</td>
                <td class="money pos">${fmt(r.net)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td>ИТОГО</td>
            <td class="money">${fmt(st.rows.reduce((a, r) => a + r.accrued, 0))}</td>
            <td class="money">− ${fmt(st.rows.reduce((a, r) => a + r.tax, 0))}</td>
            <td class="money">− ${fmt(st.rows.reduce((a, r) => a + r.advance + r.other, 0))}</td>
            <td class="money pos">${fmt(total)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Инициализация ---------- */
document.getElementById('period-month').value = new Date().toISOString().slice(0, 7);
renderEmployees();
renderPayrollTable();
renderStatements();