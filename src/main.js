import "./style.css";
import "./catalog.css";
import "./calculator.css";
import {
  emptyProject,
  missing,
  validateProject,
  installment,
  roi,
  cumulativeIncome,
  applicablePrograms,
  daysInYear,
} from "./model.js";
import centropolisSource from "../centropolis.json";
function currentDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
let project = validateProject(centropolisSource),
  selected = null,
  compare = new Set(),
  filters = {
    search: "",
    status: "available",
    block: "",
    type: "",
    sort: "number",
  },
  finance = {
    ...project.finance,
    purchaseDate: project.finance.purchaseDate || currentDate(),
  },
  programId = "",
  includeRepair = false,
  occupancyMode = "percent",
  roiMode = "rent";
const labels = {
  price: "Стоимость квартиры",
  area: "Площадь, м²",
  repairPerM2: "Стоимость ремонта, $/м²",
  nightly: "Аренда за ночь",
  nights: "Оплаченные ночи",
  occupancy: "Загрузка, %",
  vat: "НДС, %",
  management: "Управление, %",
  tax: "Налог на доход, %",
  maintenance: "Обслуживание в год",
  indexation: "Индексация аренды, %",
  purchaseDate: "Дата покупки",
  operationDate: "Начало эксплуатации",
};
const typeLabel = (value) =>
  ({ studio: "Студия", one_bedroom: "1+1", two_bedroom: "2+1" })[value] ||
  value ||
  missing;
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const display = (v) => (v == null || v === "" ? missing : escape(v));
const money = (v) =>
  Number.isFinite(v)
    ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v)} ${escape(project.currency || missing)}`
    : missing;
const safe = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url, location.href);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
const image = (url, title) =>
  safe(url)
    ? `<img src="${escape(safe(url))}" alt="${escape(title)}">`
    : `<div class="asset-placeholder"><span class="plan-icon">⌑</span><strong>${title}</strong><small>${missing}</small></div>`;
const apartment = () => project.apartments.find((a) => a.id === selected);
function select(id, redraw = true) {
  const a = project.apartments.find((a) => a.id === id);
  if (!a || a.status !== "available") return;
  selected = id;
  const blockProgram = applicablePrograms(project, a)[0];
  programId = blockProgram?.id || "";
  includeRepair = blockProgram?.repairAllowed === true;
  finance = {
    ...project.finance,
    price: a.price,
    area: a.area,
    repairPerM2: a.repairPerM2 ?? project.finance.repairPerM2,
    repair: a.repair ?? project.finance.repair,
    maintenancePerM2: a.maintenancePerM2 ?? project.finance.maintenancePerM2,
    nightly: a.nightly ?? project.finance.nightly,
    nights: a.nights ?? project.finance.nights,
    occupancy: a.occupancy ?? project.finance.occupancy,
    maintenance: a.maintenance ?? project.finance.maintenance,
    purchaseDate: finance.purchaseDate || currentDate(),
  };
  if (redraw) render();
}
function metrics(result) {
  return [
    ["Общая инвестиция", money(result.investment)],
    ["Валовая выручка", money(result.gross)],
    ["НДС", money(result.vat)],
    ["Доход после НДС", money(result.afterVat)],
    ["Комиссия управления", money(result.management)],
    ["Доход собственника", money(result.owner)],
    ["Налог на доход", money(result.tax)],
    ["Обслуживание", money(finance.maintenance)],
    ["Чистая годовая прибыль", money(result.net)],
    [
      "ROI за год",
      Number.isFinite(result.roi) ? result.roi.toFixed(2) + " %" : missing,
    ],
    [
      "Окупаемость от покупки",
      result.paybackMissing?.length
        ? missing
        : result.payback == null
          ? "Не достигнута в горизонте модели"
          : result.payback.toFixed(2) + " лет",
    ],
  ];
}
function renderLegacy() {
  const a = apartment(),
    r = roi(finance),
    p = project.programs.find((p) => p.id === programId),
    ip = installment(a?.price, p, finance.repair, includeRepair),
    floor = project.floors.find(
      (f) => f.block === a?.block && f.number === a?.floor,
    );
  const availablePrograms = applicablePrograms(project, a);
  const floorUnits = a
    ? project.apartments.filter(
        (unit) => unit.block === a.block && unit.floor === a.floor,
      )
    : [];
  const rows = project.apartments
    .filter(
      (a) =>
        (!filters.status || a.status === filters.status) &&
        (!filters.block || String(a.block) === filters.block) &&
        (!filters.type || (a.typeKey || a.type) === filters.type) &&
        `${a.number} ${a.type} ${a.block}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    )
    .sort((a, b) =>
      filters.sort === "price"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : filters.sort === "area"
          ? (a.area ?? Infinity) - (b.area ?? Infinity)
          : String(a.number).localeCompare(String(b.number), "ru", {
              numeric: true,
            }),
    );
  const minimum = project.apartments
    .filter((a) => a.status === "available" && Number.isFinite(a.pricePerMeter))
    .map((a) => a.pricePerMeter);
  document.querySelector("#app").innerHTML = `
<header><a class="brand" href="#">ESTATE<span>INVESTMENT PLATFORM</span></a><nav><a href="#overview">О проекте</a><a href="#catalog">Квартиры</a><a href="#plans">Планировки</a><a href="#investment">Инвестиции</a></nav><button id="pdf-top" class="outline">Сформировать PDF ↗</button></header>
<main><section id="overview" class="hero"><div class="hero-copy"><div class="eyebrow">НЕДВИЖИМОСТЬ · ИНВЕСТИЦИИ</div><h1>${project.name ? escape(project.name) : "Ваш следующий<br>инвестиционный проект"}</h1><p>${display(project.description)}</p><div class="actions"><a class="button" href="#catalog">Выбрать квартиру ↗</a><a class="text-link" href="#investment">Рассчитать инвестицию →</a></div><div class="hero-note">Единый взгляд на объект, квартиру и финансовую модель</div></div><div class="hero-visual">${image(project.render, "Архитектурный рендер проекта")}<span class="image-caption">МАТЕРИАЛЫ ЗАСТРОЙЩИКА</span></div></section>
<div class="stats">${[
    [
      "Свободные квартиры",
      project.source || project.apartments.length
        ? project.apartments.filter((a) => a.status === "available").length
        : null,
    ],
    ["Расстояние до моря", project.seaDistance],
    [
      "Минимальная цена за м²",
      minimum.length ? money(Math.min(...minimum)) : null,
    ],
    ["Дата сдачи", project.completionDate],
  ]
    .map(
      ([k, v]) =>
        `<div><small>${k}</small><strong>${display(v)}</strong></div>`,
    )
    .join("")}</div>
${safe(project.camera) ? `<section><h2>Строительство онлайн</h2><a target="_blank" rel="noopener" href="${escape(safe(project.camera))}">Открыть трансляцию ↗</a></section>` : ""}
<section class="section" id="catalog"><div class="section-head"><div><div class="eyebrow">01 / ВЫБОР ОБЪЕКТА</div><h2>Свободные квартиры</h2></div><span class="muted">Актуальность: ${display(project.updatedAt)}</span></div>
<div class="filters"><label class="search">Поиск<input id="search" value="${escape(filters.search)}" placeholder="Номер, блок или тип квартиры"></label><label>Блок<select id="block"><option value="">Все блоки</option>${[...new Set(project.apartments.map((a) => a.block))].map((b) => `<option ${String(b) === filters.block ? "selected" : ""}>${escape(b)}</option>`).join("")}</select></label><label>Тип квартиры<select id="type"><option value="">Все типы</option>${[...new Map(project.apartments.map((a) => [a.typeKey || a.type, a.typeKey || a.type])).entries()].map(([value, label]) => `<option value="${escape(value)}" ${filters.type === value ? "selected" : ""}>${escape(typeLabel(label))}</option>`).join("")}</select></label><label>Статус<select id="status">${[
    ["available", "Свободна"],
    ["reserved", "Забронирована"],
    ["sold", "Продана"],
    ["", "Все статусы"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filters.status === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></label><label>Сортировка<select id="sort">${[
    ["number", "По номеру"],
    ["price", "По стоимости"],
    ["area", "По площади"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filters.sort === v ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></label></div>
<div class="table-wrap"><div class="table-scroll"><table><thead><tr>${["Сравнить", "Блок", "Этаж", "Квартира", "Тип", "Окна", "Площадь", "Цена / м²", "Стоимость", "Статус"].map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((a) => `<tr class="${selected === a.id ? "selected" : a.status}"><td><input aria-label="Сравнить квартиру ${escape(a.number)}" type="checkbox" data-compare="${escape(a.id)}" ${compare.has(a.id) ? "checked" : ""}></td><td>${display(a.block)}</td><td>${display(a.floor)}</td><td><button class="row-select" data-select="${escape(a.id)}" ${a.status !== "available" ? "disabled" : ""}>${display(a.number)}</button></td><td>${display(a.type)}</td><td>${display(a.direction)}</td><td>${display(a.area)}</td><td>${money(a.pricePerMeter)}</td><td>${money(a.price)}</td><td><span class="badge">${selected === a.id ? "Выбрана" : { available: "Свободна", reserved: "Забронирована", sold: "Продана" }[a.status]}</span></td></tr>`).join("")}</tbody></table></div>${!rows.length ? `<div class="empty"><span>⌕</span><h3>${project.apartments.length ? "Нет квартир по выбранным условиям" : "Каталог ожидает данные проекта"}</h3><p>${project.apartments.length ? "Измените фильтры, чтобы увидеть другие квартиры." : missing + " · Подключите источник или загрузите JSON проекта."}</p></div>` : ""}</div>
${
  compare.size > 1
    ? `<div class="comparison"><h3>Сравнение квартир</h3><div class="comparison-grid">${project.apartments
        .filter((a) => compare.has(a.id))
        .map(
          (a) =>
            `<div class="card"><h3>Квартира ${display(a.number)}</h3><p>${display(a.type)} · ${display(a.area)} м²</p><strong>${money(a.price)}</strong><p>Блок ${display(a.block)} · этаж ${display(a.floor)}</p><p>Окна: ${display(a.direction)}</p></div>`,
        )
        .join("")}</div></div>`
    : ""
}</section>
<section class="section" id="plans"><div class="section-head"><div><div class="eyebrow">02 / ПРОСТРАНСТВО</div><h2>Квартира и план этажа</h2></div><span class="muted">${a ? "Квартира " + escape(a.number) : "Выберите квартиру в каталоге"}</span></div><div class="two-col"><article class="card"><div class="card-top"><h3>Ваша квартира</h3><span>ПЛАНИРОВКА</span></div>${image(a?.plan, "Планировка квартиры")}<div class="detail-grid">${[
    ["Номер", a?.number],
    ["Блок", a?.block],
    ["Этаж", a?.floor],
    ["Тип", a?.type],
    ["Площадь", a?.area],
    ["Стоимость", a ? money(a.price) : null],
  ]
    .map(
      ([k, v]) =>
        `<div><small>${k}</small><strong>${display(v)}</strong></div>`,
    )
    .join(
      "",
    )}</div>${safe(a?.plan3d) ? `<a target="_blank" rel="noopener" href="${escape(safe(a?.plan3d))}">Открыть 3D-планировку ↗</a>` : ""}</article><article class="card"><div class="card-top"><h3>Расположение на этаже</h3><span>ИНТЕРАКТИВНЫЙ ПЛАН</span></div><div class="floor-plan">${image(floor?.image, "План этажа")}${
    floor?.viewBox
      ? `<svg viewBox="${escape(floor.viewBox)}" aria-label="Интерактивные квартиры этажа">${(
          floor.regions || []
        )
          .map((region) => {
            const unit = project.apartments.find(
              (a) => a.id === region.apartmentId,
            );
            return unit
              ? `<polygon tabindex="0" role="button" aria-label="Квартира ${escape(unit.number)}, ${escape(unit.status)}" points="${escape(region.points)}" class="${selected === unit.id ? "selected" : unit.status}" data-select="${escape(unit.id)}"/>`
              : "";
          })
          .join("")}</svg>`
      : ""
  }</div>${floorUnits.length ? `<div class="floor-units"><small>Квартиры на этаже</small>${floorUnits.map((unit) => `<button class="floor-unit ${selected === unit.id ? "selected" : unit.status}" data-select="${escape(unit.id)}">${display(unit.number)}</button>`).join("")}</div>` : ""}<div class="legend"><span>● Свободна</span><span class="yellow">● Выбрана</span><span class="muted">● Забронирована</span><span class="red">● Продана</span></div></article></div></section>
<section class="section" id="installment"><div class="eyebrow">03 / УСЛОВИЯ ПОКУПКИ</div><h2>Рассрочка застройщика</h2><div class="card"><label>Программа рассрочки<select id="program"><option value="">Выберите подтверждённую программу</option>${availablePrograms.map((p) => `<option value="${escape(p.id)}" ${p.id === programId ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label>${p?.repairAllowed ? `<label class="check"><input id="include-repair" type="checkbox" ${includeRepair ? "checked" : ""}>Включить ремонт в рассрочку</label>` : ""}<p class="muted">${display(p?.conditions)}</p><div class="detail-grid">${[
    ["Стоимость квартиры", money(a?.price)],
    [
      "Ремонт в рассрочке",
      includeRepair ? money(finance.repair) : "Не включён",
    ],
    ["Общая сумма", money(ip.total)],
    ["Первоначальный взнос", money(ip.down)],
    ["Ежемесячный платёж", money(ip.monthly)],
    ["Финальный платёж", money(ip.final)],
  ]
    .map(([k, v]) => `<div><small>${k}</small><strong>${v}</strong></div>`)
    .join(
      "",
    )}</div>${ip.missing ? `<p class="notice">${missing}: ${ip.missing.map(escape).join(", ")}</p>` : ""}</div></section>
<section class="section" id="investment"><div class="eyebrow">04 / ФИНАНСОВАЯ МОДЕЛЬ</div><h2>Рассчитайте свою инвестицию</h2><p class="muted">Параметры вводятся вами или поступают из подтверждённого источника проекта.</p><div class="investment-layout"><div><div class="card"><h3>Входные параметры</h3><div class="form-grid">${Object.entries(
    labels,
  )
    .map(
      ([k, l]) =>
        `<label>${l}<input data-finance="${k}" type="${k.includes("Date") ? "date" : "number"}" ${k.includes("Date") ? "" : 'min="0" step="any"'} value="${escape(finance[k] ?? "")}" placeholder="${missing}" ${k === "indexation" && !finance.indexationEnabled ? "disabled" : ""}></label>`,
    )
    .join(
      "",
    )}</div><label class="check"><input type="checkbox" id="indexation" ${finance.indexationEnabled ? "checked" : ""}>Учитывать индексацию</label><p class="muted">Площадь: ${display(a?.area)} · Дата сдачи: ${display(project.completionDate)}</p><p class="model-note">Модель: НДС от выручки → управление от дохода после НДС → налог от дохода собственника → фиксированные годовые расходы. Используйте её только при соответствии условиям проекта. Индексация применяется с последующего года эксплуатации; расходы остаются постоянными. Загрузка рассчитывается по календарному году начала эксплуатации.</p></div><div class="card results"><h3>Финансовые результаты</h3>${r.missing ? `<p class="notice">${missing}: ${r.missing.map((k) => escape(labels[k] || k)).join(", ")}</p>` : ""}${metrics(
    r,
  )
    .map(
      ([k, v]) =>
        `<div class="result-row"><span>${k}</span><strong>${v}</strong></div>`,
    )
    .join(
      "",
    )}<div class="result-row"><span>Оплаченные ночи в год</span><strong>${display(finance.nights)}</strong></div><div class="result-row"><span>Накопленный доход</span><strong>${r.missing ? missing : "Выберите горизонт ниже"}</strong></div><label>Горизонт эксплуатации, лет<input id="horizon" type="number" min="1" max="100" step="1" placeholder="${missing}"></label><p id="cumulative" class="notice"></p></div></div><aside class="card summary"><div class="eyebrow">ВАШ ИНВЕСТИЦИОННЫЙ ПОРТФЕЛЬ</div><h3>Итог</h3><h4>${display(project.name)}</h4>${image(a?.plan, "Выбранная квартира")}<p>${a ? `№ ${display(a.number)} · блок ${display(a.block)} · этаж ${display(a.floor)}<br>${display(a.type)} · ${display(a.area)} м²` : "Квартира ещё не выбрана"}</p>${image(floor?.image, "План выбранного этажа")}<div class="result-row"><span>Квартира</span><strong>${money(finance.price)}</strong></div><div class="result-row"><span>Ремонт</span><strong>${money(finance.repair)}</strong></div>${metrics(
    r,
  )
    .filter(([k]) =>
      [
        "Общая инвестиция",
        "Чистая годовая прибыль",
        "ROI за год",
        "Окупаемость от покупки",
      ].includes(k),
    )
    .map(
      ([k, v]) =>
        `<div class="result-row"><span>${k}</span><strong>${v}</strong></div>`,
    )
    .join(
      "",
    )}<div class="result-row"><span>Дата сдачи</span><strong>${display(project.completionDate)}</strong></div><button id="pdf" class="button full">Инвестиционный PDF ↗</button><small>По текущим параметрам расчёта</small></aside></div></section>
<section class="section two-col"><article class="card"><div class="eyebrow">ЛОКАЦИЯ</div><h2>Всё рядом</h2>${Number.isFinite(project.location?.lat) && Number.isFinite(project.location?.lng) ? `<iframe title="Расположение комплекса в Google Maps" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${project.location.lat},${project.location.lng}&output=embed"></iframe><p>${display(project.location.address)}</p>` : `<div class="asset-placeholder"><span>⌖</span><strong>Расположение комплекса</strong><small>${missing}</small></div>`}${(project.location?.infrastructure || []).map((i) => `<p>${escape(i.name)} · ${display(i.distance)}</p>`).join("")}</article><article class="card"><div class="eyebrow">ДИНАМИКА СТОИМОСТИ</div><h2>История проекта</h2>${project.history.length ? `<div class="result-row"><span>Стартовая цена</span><strong>${money(project.history[0].price)}</strong></div><div class="result-row"><span>Текущая цена</span><strong>${money(project.history.at(-1).price)}</strong></div>${project.history.map((h) => `<div class="result-row"><span>${escape(h.date)}</span><strong>${money(h.price)}</strong></div>`).join("")}` : `<div class="empty"><span>↗</span><h3>История цен появится здесь</h3><p>${missing} · Только подтверждённые исторические сведения.</p></div>`}</article></section>
<section class="source-section"><div><h3>Один шаблон. Данные вашего проекта.</h3><p>Загрузите JSON застройщика или подключите HTTPS-источник. Компоненты обновятся автоматически.</p></div><div class="source-controls"><label class="outline upload">Загрузить JSON<input id="upload" type="file" accept="application/json"></label><input id="source-url" type="url" placeholder="HTTPS URL источника" value="${escape(project.source || "")}"><button id="connect" class="outline">Подключить</button><button id="refresh" class="outline" ${!project.source ? "disabled" : ""}>Обновить</button>${safe(project.presentation) ? `<a class="outline" target="_blank" rel="noopener" href="${escape(safe(project.presentation))}">Презентация ↗</a>` : ""}</div><p id="source-message" role="status"></p></section></main><footer><a class="brand" href="#">ESTATE</a><span>Инвестиционные решения на основе данных</span><span>Данные проекта требуют подтверждения источником</span></footer>`;
  bind();
}

const dateLabel = (value) => {
  if (!value) return missing;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? display(value)
    : new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
};
const sectionHeading = (number, title) =>
  `<div class="reference-heading"><span>${number}</span><h2>${title}</h2></div>`;
const programText = (program) =>
  program
    ? `Первоначальный взнос ${program.downPercent}% · ${program.installmentPercent ?? missing} / ${program.months} мес. · ${program.finalPercent}% финал/ипотека`
    : missing;
const unitContext = (a) =>
  a
    ? `Блок ${display(a.block)} · этаж ${display(a.floor)} · №${display(a.number)} · ${money(a.price)}`
    : missing;
const unitRate = (value, suffix = "") =>
  Number.isFinite(value) ? `${new Intl.NumberFormat("ru-RU").format(value)} ${suffix}` : missing;
const yearsLabel = (years) => {
  if (!Number.isFinite(years)) return missing;
  const totalMonths = Math.max(0, Math.round(years * 12));
  return `${Math.floor(totalMonths / 12)} лет ${totalMonths % 12} мес.`;
};
const expenseLine = (label, value, tone = "") =>
  `<div class="finance-line ${tone}"><span>${label}</span><strong>${value}</strong></div>`;
const resultValue = (value) => (Number.isFinite(value) ? money(value) : missing);
const resultExpense = (label, value) =>
  expenseLine(label, Number.isFinite(value) ? `− ${money(value)}` : missing, "expense");

function placeSharedSummary() {
  const main = document.querySelector("#app main");
  const firstSection = main?.querySelector("#investment-model");
  const sourceSection = main?.querySelector(".source-section");
  const summary = main?.querySelector("#investment .summary");
  if (!main || !firstSection || !sourceSection || !summary) return;
  const layout = document.createElement("div");
  layout.className = "page-layout";
  const pageMain = document.createElement("div");
  pageMain.className = "page-main";
  summary.remove();
  main.insertBefore(layout, firstSection);
  let section = firstSection;
  while (section && section !== sourceSection) {
    const next = section.nextElementSibling;
    pageMain.append(section);
    section = next;
  }
  layout.append(pageMain, summary);
}

function placeTypeTabs(options) {
  const catalog = document.querySelector("#catalog");
  const filtersPanel = catalog?.querySelector(".filters");
  if (!filtersPanel) return;
  const tabs = document.createElement("div");
  tabs.className = "type-tabs";
  for (const [value, label] of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `type-tab${filters.type === value ? " active" : ""}`;
    button.textContent = label;
    button.onclick = () => {
      filters.type = value;
      render();
    };
    tabs.append(button);
  }
  filtersPanel.before(tabs);
}

function render() {
  const a = apartment();
  const r = roi(finance);
  const p = project.programs.find((program) => program.id === programId);
  const ip = installment(a?.price, p, finance.repair, includeRepair);
  const floor = project.floors.find(
    (item) => item.block === a?.block && item.number === a?.floor,
  );
  const availablePrograms = applicablePrograms(project, a);
  const floorUnits = a
    ? project.apartments.filter(
        (unit) => unit.block === a.block && unit.floor === a.floor,
      )
    : [];
  const rows = project.apartments
    .filter(
      (unit) =>
        (!filters.status || unit.status === filters.status) &&
        (!filters.block || String(unit.block) === filters.block) &&
        (!filters.type || (unit.typeKey || unit.type) === filters.type) &&
        `${unit.number} ${unit.type} ${unit.block}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    )
    .sort((left, right) =>
      filters.sort === "price"
        ? (left.price ?? Infinity) - (right.price ?? Infinity)
        : filters.sort === "area"
          ? (left.area ?? Infinity) - (right.area ?? Infinity)
          : String(left.number).localeCompare(String(right.number), "ru", {
              numeric: true,
            }),
    );
  const minimum = project.apartments
    .filter((unit) => unit.status === "available" && Number.isFinite(unit.pricePerMeter))
    .map((unit) => unit.pricePerMeter);
  const typeMap = new Map(
    project.apartments.map((unit) => [unit.typeKey || unit.type, unit.typeKey || unit.type]),
  );
  const typeOrder = ["studio", "one_bedroom", "two_bedroom"];
  const typeOptions = [
    ["", "Все"],
    ...[
      ...typeOrder.filter((value) => typeMap.has(value)),
      ...[...typeMap.keys()].filter((value) => !typeOrder.includes(value)),
    ].map((value) => [value, typeLabel(typeMap.get(value))]),
  ];
  const history = project.history || [];
  const historySnapshot = history.at(-1);
  const map =
    Number.isFinite(project.location?.lat) && Number.isFinite(project.location?.lng)
      ? `<iframe title="Расположение комплекса в Google Maps" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${project.location.lat},${project.location.lng}&output=embed"></iframe>`
      : `<div class="asset-placeholder map-placeholder"><span>⌖</span><strong>Расположение комплекса</strong><small>${missing}</small></div>`;
  const apartmentTable = rows
    .map(
      (unit) =>
        `<tr class="${selected === unit.id ? "selected" : unit.status}"><td><input aria-label="Сравнить квартиру ${escape(unit.number)}" type="checkbox" data-compare="${escape(unit.id)}" ${compare.has(unit.id) ? "checked" : ""}></td><td>${display(unit.block)}</td><td>${display(unit.floor)}</td><td><button class="row-select" data-select="${escape(unit.id)}" ${unit.status !== "available" ? "disabled" : ""}>${display(unit.number)}</button></td><td>${display(unit.type)}</td><td>${display(unit.direction)}</td><td>${display(unit.area)}</td><td>${money(unit.pricePerMeter)}</td><td>${money(unit.price)}</td><td><span class="badge">${selected === unit.id ? "Выбрана" : { available: "Свободна", reserved: "Забронирована", sold: "Продана" }[unit.status] || missing}</span></td></tr>`,
    )
    .join("");
  const comparison =
    compare.size > 1
      ? `<div class="comparison"><h3>Сравнение квартир</h3><div class="comparison-grid">${project.apartments
          .filter((unit) => compare.has(unit.id))
          .map(
            (unit) =>
              `<div class="card"><h3>Квартира ${display(unit.number)}</h3><p>${display(unit.type)} · ${display(unit.area)} м²</p><strong>${money(unit.price)}</strong><p>Блок ${display(unit.block)} · этаж ${display(unit.floor)}</p><p>Окна: ${display(unit.direction)}</p></div>`,
          )
          .join("")}</div></div>`
      : "";
  const repairBase = ip.total;
  const monthlyPart =
    Number.isFinite(ip.total) && Number.isFinite(ip.down) && Number.isFinite(ip.final)
      ? ip.total - ip.down - ip.final
      : null;
  const finalNote = p
    ? `Финальный платёж составляет ${p.finalPercent}% от базы рассрочки. Срок ежемесячной части: ${p.months} мес.`
    : missing;
  const roiTabs = `<div class="roi-tabs"><button class="roi-tab ${roiMode === "rent" ? "active" : ""}" data-roi-mode="rent">Доход от аренды</button><button class="roi-tab" disabled>Капитализация</button><button class="roi-tab" disabled>Капитализация + доход от аренды</button><span class="roi-auto">auto</span></div>`;
  const formFields = Object.entries(labels)
    .map(
      ([key, label]) =>
        `<label>${label}<input data-finance="${key}" type="${key.includes("Date") ? "date" : "number"}" ${key.includes("Date") ? "" : 'min="0" step="any"'} value="${escape(finance[key] ?? "")}" placeholder="${missing}" ${key === "indexation" && !finance.indexationEnabled ? "disabled" : ""}></label>`,
    )
    .join("");
  const netLabel = Number.isFinite(r.net) ? money(r.net) : missing;
  const roiLabel = Number.isFinite(r.roi) ? `${r.roi.toFixed(2)} %` : missing;
  const paybackLabel = r.paybackMissing?.length
    ? missing
    : r.payback == null
      ? "Не достигнута в горизонте модели"
      : yearsLabel(r.payback);
  const summaryRows = [
    expenseLine("Цена квартиры", money(finance.price)),
    expenseLine("Общая инвестиция", resultValue(r.investment)),
    expenseLine("Чистая прибыль / год", netLabel, "positive"),
    expenseLine("ROI (год 1)", roiLabel, "accent"),
    expenseLine("Сдача", display(project.completionDate)),
    expenseLine("Окупаемость", paybackLabel),
  ].join("");
  const summaryMarkup = `<aside class="card summary sticky-summary"><div class="eyebrow">ИТОГ</div><div class="summary-unit"><strong>${display(project.name)}</strong><span>${a ? `Блок ${display(a.block)} · этаж ${display(a.floor)} · №${display(a.number)}` : missing}</span><span>${a ? `${display(a.type)} · ${display(a.area)} м²` : missing}</span><strong>${money(a?.price)}</strong></div><div class="summary-images"><div>${image(a?.plan, "Планировка квартиры")}<small>Планировка квартиры</small></div><div>${image(floor?.image, "Позиция на этаже")}<small>Позиция на этаже</small></div></div>${summaryRows}<button id="pdf" class="button full">Инвестиционный PDF ↗</button><small class="summary-note">Пересчитывается автоматически при изменении любого поля.</small></aside>`;
  document.querySelector("#app").innerHTML = `
<header><a class="brand" href="#">ESTATE<span>INVESTMENT PLATFORM</span></a><nav><a href="#overview">О проекте</a><a href="#catalog">Квартиры</a><a href="#plans">Планировки</a><a href="#investment">Инвестиции</a></nav><button id="pdf-top" class="outline">Сформировать PDF ↗</button></header>
<main>
<section id="overview" class="hero"><div class="hero-copy"><div class="eyebrow">НЕДВИЖИМОСТЬ · ИНВЕСТИЦИИ</div><h1>${project.name ? escape(project.name) : "Ваш следующий<br>инвестиционный проект"}</h1><p>${display(project.description)}</p><div class="actions"><a class="button" href="#catalog">Выбрать квартиру ↗</a><a class="text-link" href="#investment">Рассчитать инвестицию →</a></div><div class="hero-note">Единый взгляд на объект, квартиру и финансовую модель</div></div><div class="hero-visual">${image(project.render, "Архитектурный рендер проекта")}<span class="image-caption">МАТЕРИАЛЫ ЗАСТРОЙЩИКА</span></div></section>
<div class="stats">${[["Свободные квартиры", project.apartments.filter((unit) => unit.status === "available").length], ["Расстояние до моря", project.seaDistance ? `${project.seaDistance} м` : null], ["Минимальная цена за м²", minimum.length ? money(Math.min(...minimum)) : null], ["Дата сдачи", project.completionDate]].map(([key, value]) => `<div><small>${key}</small><strong>${display(value)}</strong></div>`).join("")}</div>
${safe(project.camera) ? `<section class="reference-section camera-section"><div class="camera-copy"><span class="live-badge">● LIVE</span><h2>Камера строительной площадки</h2><p>Следите за ходом строительства в реальном времени.</p><a class="button" target="_blank" rel="noopener" href="${escape(safe(project.camera))}">Открыть live-камеру ↗</a></div><div class="camera-preview">${image(project.cameraPreview, "Онлайн-камера")}</div></section>` : ""}
<section class="section" id="catalog"><div class="section-head"><div><div class="eyebrow">01 / ВЫБОР ОБЪЕКТА</div><h2>Свободные квартиры</h2></div><span class="muted">Актуальность: ${display(project.updatedAt)}</span></div><div class="filters"><label class="search">Поиск<input id="search" value="${escape(filters.search)}" placeholder="Номер, блок или тип квартиры"></label><label>Блок<select id="block"><option value="">Все блоки</option>${[...new Set(project.apartments.map((unit) => unit.block))].map((block) => `<option ${String(block) === filters.block ? "selected" : ""}>${escape(block)}</option>`).join("")}</select></label><label>Тип квартиры<select id="type"><option value="">Все типы</option>${[...new Map(project.apartments.map((unit) => [unit.typeKey || unit.type, unit.typeKey || unit.type])).entries()].map(([value, label]) => `<option value="${escape(value)}" ${filters.type === value ? "selected" : ""}>${escape(typeLabel(label))}</option>`).join("")}</select></label><label>Статус<select id="status">${[["available", "Свободна"], ["reserved", "Забронирована"], ["sold", "Продана"], ["", "Все статусы"]].map(([value, label]) => `<option value="${value}" ${filters.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Сортировка<select id="sort">${[["number", "По номеру"], ["price", "По стоимости"], ["area", "По площади"]].map(([value, label]) => `<option value="${value}" ${filters.sort === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><div class="table-wrap"><div class="table-scroll"><table><thead><tr>${["Сравнить", "Блок", "Этаж", "Квартира", "Тип", "Окна", "Площадь", "Цена / м²", "Стоимость", "Статус"].map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${apartmentTable}</tbody></table></div>${!rows.length ? `<div class="empty"><span>⌕</span><h3>${project.apartments.length ? "Нет квартир по выбранным условиям" : "Каталог ожидает данные проекта"}</h3><p>${project.apartments.length ? "Измените фильтры, чтобы увидеть другие квартиры." : `${missing} · Подключите источник или загрузите JSON проекта.`}</p></div>` : ""}</div>${comparison}</section>
<section class="section reference-section" id="investment-model">${sectionHeading("01", "Инвестиционная модель")}<div class="model-grid"><article class="model-card blue-edge"><h3>Рост капитализации</h3><ul><li>Историческая динамика: ${missing}</li><li>Подтверждённый прогноз: ${missing}</li><li>Период сравнения: ${missing}</li></ul></article><article class="model-card green-edge"><h3>Пассивный доход</h3><ul><li>Ставка: ${unitRate(finance.nightly, `${project.currency || "USD"} / ночь`)}</li><li>Загрузка: ${display(finance.occupancy)}% · ${display(finance.nights)} ночей в год</li><li>Управление: ${display(finance.management)}% после НДС</li></ul></article></div></section>
<section class="section reference-section" id="expenses">${sectionHeading("02", "Расходы инвестора")}<div class="expense-grid"><article><small>НДС</small><strong>${Number.isFinite(finance.vat) ? `${finance.vat}% от общей выручки` : missing}</strong></article><article><small>УПРАВЛЯЮЩАЯ КОМПАНИЯ</small><strong>${Number.isFinite(finance.management) ? `${finance.management}% после НДС` : missing}</strong></article><article><small>НАЛОГ НА ДОХОД ОТ АРЕНДЫ</small><strong>${Number.isFinite(finance.tax) ? `${finance.tax}% с доли собственника` : missing}</strong></article><article><small>ОБСЛУЖИВАНИЕ КОМПЛЕКСА</small><strong>${Number.isFinite(finance.maintenancePerM2) ? `${finance.maintenancePerM2} ${project.currency || "USD"} за м² в месяц` : missing}</strong></article></div><div class="info-strip">Все расчёты ROI ниже автоматически учитывают эти расходы.</div></section>
<section class="section reference-section" id="location">${sectionHeading("03", "Локация комплекса")}<div class="location-card">${map}<div class="location-meta"><div><small>ГОРОД</small><strong>${display(project.location?.city)}</strong></div><div><small>ДО МОРЯ</small><strong>${project.seaDistance ? `${project.seaDistance} м · первая линия` : missing}</strong></div><div><small>АДРЕС</small><strong>${display(project.location?.address)}</strong></div></div></div></section>
<section class="section reference-section" id="history">${sectionHeading("04", "История роста стоимости")}<div class="history-card"><div class="history-card-head"><h3>История роста стоимости</h3><strong>${missing}</strong></div>${historySnapshot ? `<div class="history-snapshot"><div><small>${dateLabel(historySnapshot.date)}</small><span>Минимальная цена снимка</span><strong>${money(historySnapshot.price)} / м²</strong></div><div class="history-warning">${missing}<br><small>Нужен второй подтверждённый ценовой снимок для расчёта роста.</small></div></div>` : `<div class="empty"><span>↗</span><h3>${missing}</h3><p>Исторические показатели появятся после загрузки подтверждённых снимков.</p></div>`}</div></section>
<section class="section" id="plans">${sectionHeading("05", "Квартира и план этажа")}<div class="two-col"><article class="card"><div class="card-top"><h3>Ваша квартира</h3><span>ПЛАНИРОВКА</span></div>${image(a?.plan, "Планировка квартиры")}${a?.illustrativeLayout ? `<p class="asset-note">Типовая планировка. Соответствие конкретной квартире не подтверждено.</p>` : ""}<div class="detail-grid">${[["Номер", a?.number], ["Блок", a?.block], ["Этаж", a?.floor], ["Тип", a?.type], ["Площадь", a?.area], ["Стоимость", a ? money(a.price) : null]].map(([key, value]) => `<div><small>${key}</small><strong>${display(value)}</strong></div>`).join("")}</div></article><article class="card"><div class="card-top"><h3>Расположение на этаже</h3><span>ИНТЕРАКТИВНЫЙ ПЛАН</span></div><div class="floor-plan">${image(floor?.image, "План этажа")}</div>${floor?.rangeUnconfirmed ? `<p class="asset-note">План найден для диапазона этажей. Точная привязка к этажу требует подтверждения.</p>` : ""}${floorUnits.length ? `<div class="floor-units"><small>Квартиры на этаже</small>${floorUnits.map((unit) => `<button class="floor-unit ${selected === unit.id ? "selected" : unit.status}" data-select="${escape(unit.id)}">${display(unit.number)}</button>`).join("")}</div>` : ""}<div class="legend"><span>● Свободна</span><span class="yellow">● Выбрана</span><span class="muted">● Забронирована</span><span class="red">● Продана</span></div></article></div></section>
<section class="section" id="installment">${sectionHeading("06", "Калькулятор рассрочки")}<div class="calc-shell"><div class="stage-tabs"><span class="active">01 · ВЫБОР ПЛАНА</span><span>02 · СТРУКТУРА ПЛАТЕЖЕЙ</span><span>03 · ГРАФИК ПЛАТЕЖЕЙ</span></div><div class="calc-context"><span>УСЛОВИЯ</span><strong>Юнит: ${unitContext(a)}</strong></div><div class="program-box"><strong>Блок ${display(a?.block)} · подтверждённые сценарии рассрочки</strong><label class="program-select-label">Программа рассрочки<select id="program"><option value="">Выберите подтверждённую программу</option>${availablePrograms.map((program) => `<option value="${escape(program.id)}" ${program.id === programId ? "selected" : ""}>${escape(programText(program))}</option>`).join("")}</select></label><p class="calc-note">${finalNote}</p></div>${p?.repairAllowed ? `<div class="repair-card"><label class="check"><input id="include-repair" type="checkbox" ${includeRepair ? "checked" : ""}><span><strong>Включить стоимость ремонта в рассрочку</strong><small>Стоимость ремонта берётся из ROI-калькулятора (${unitRate(finance.repairPerM2, `${project.currency || "USD"} /м²`)} × площадь). Значение можно изменить в разделе ROI.</small></span></label><p>База рассрочки: <strong>${money(repairBase)}</strong> · включая ремонт · Общая стоимость ремонта: <strong>${money(finance.repair)}</strong></p></div>` : ""}<div class="payment-grid"><div class="payment-cell highlight"><span>Первоначальный взнос (${display(p?.downPercent)}%)</span><strong>${money(ip.down)}</strong></div><div class="payment-cell"><span>Рассрочка (${display(p?.installmentPercent)}% / ${display(p?.months)} мес.)</span><strong>${money(monthlyPart)}</strong></div><div class="payment-cell highlight"><span>Ежемесячный платёж</span><strong>${money(ip.monthly)}</strong></div><div class="payment-cell"><span>Финальный платёж / ипотека (${display(p?.finalPercent)}%)</span><strong>${money(ip.final)}</strong></div></div><p class="payment-note">Финальный платёж вносится единовременно либо переоформляется в ипотеку — на выбор клиента.</p><p class="payment-note blue">${finalNote}</p><div class="payment-timeline"><div><i></i><strong>${display(p?.downPercent)}%</strong><small>СЕГОДНЯ</small></div><hr><div><i></i><strong>${display(p?.installmentPercent)}%</strong><small>${display(p?.months)} МЕС.</small></div><hr><div><i></i><strong>${display(p?.finalPercent)}%</strong><small>ФИНАЛЬНЫЙ ПЛАТЁЖ</small></div></div>${ip.missing ? `<p class="notice">${missing}: ${ip.missing.map(escape).join(", ")}</p>` : ""}</div></section>
<section class="section" id="investment">${sectionHeading("07", "ROI-калькулятор")}<div class="roi-shell">${roiTabs}<div class="roi-layout"><div class="roi-main"><div class="roi-form-card"><div class="form-grid">${formFields}</div><label class="check"><input type="checkbox" id="indexation" ${finance.indexationEnabled ? "checked" : ""}>Учитывать индексацию цены за ночь</label><p class="model-note">Расчёт использует подтверждённые параметры проекта. Рост стоимости недвижимости в ROI не включён без исторических данных.</p></div><div class="roi-results"><h3>Финансовые результаты</h3>${r.missing ? `<p class="notice">${missing}: ${r.missing.map((key) => escape(labels[key] || key)).join(", ")}</p>` : ""}${expenseLine("Стоимость квартиры", resultValue(r.investment ? finance.price : null))}${expenseLine("Стоимость ремонта", money(finance.repair))}${expenseLine("Общая инвестиция", resultValue(r.investment))}${expenseLine("Валовая выручка", resultValue(r.gross))}${resultExpense("НДС", r.vat)}${expenseLine("Доход после НДС", resultValue(r.afterVat))}${resultExpense("Управление", r.management)}${expenseLine("Доход собственника", resultValue(r.owner))}${resultExpense("Налог на доход", r.tax)}${resultExpense("Обслуживание", finance.maintenance)}${expenseLine("Чистая прибыль за год 1", netLabel, "highlight")}${expenseLine("ROI (год 1)", roiLabel, "highlight")}${expenseLine("Ожидание до сдачи", Number.isFinite(r.wait) ? `${Math.round(r.wait * 12)} мес.` : missing)}${expenseLine("Срок окупаемости (с даты покупки)", paybackLabel)}<label class="horizon-label">Накопленный доход · горизонт, лет<input id="horizon" type="number" min="1" max="100" step="1" placeholder="${missing}"></label><p id="cumulative" class="notice"></p></div></div><aside class="card summary sticky-summary"><div class="eyebrow">ИТОГ</div><div class="summary-unit"><strong>${display(project.name)}</strong><span>${a ? `Блок ${display(a.block)} · этаж ${display(a.floor)} · №${display(a.number)}` : missing}</span><span>${a ? `${display(a.type)} · ${display(a.area)} м²` : missing}</span><strong>${money(a?.price)}</strong></div><div class="summary-images"><div>${image(a?.plan, "Планировка квартиры")}<small>Планировка квартиры</small></div><div>${image(floor?.image, "Позиция на этаже")}<small>Позиция на этаже</small></div></div>${summaryRows}<button id="pdf" class="button full">Инвестиционный PDF ↗</button><small class="summary-note">Пересчитывается автоматически при изменении любого поля.</small></aside></div></div></section>
<section class="source-section"><div><h3>Один шаблон. Данные вашего проекта.</h3><p>Загрузите JSON застройщика или подключите HTTPS-источник. Компоненты обновятся автоматически.</p></div><div class="source-controls"><label class="outline upload">Загрузить JSON<input id="upload" type="file" accept="application/json"></label><input id="source-url" type="url" placeholder="HTTPS URL источника" value="${escape(project.source || "")}"><button id="connect" class="outline">Подключить</button><button id="refresh" class="outline" ${!project.source ? "disabled" : ""}>Обновить</button>${safe(project.presentation) ? `<a class="outline" target="_blank" rel="noopener" href="${escape(safe(project.presentation))}">Презентация ↗</a>` : ""}</div><p id="source-message" role="status"></p></section></main><footer><a class="brand" href="#">ESTATE</a><span>Инвестиционные решения на основе данных</span><span>Данные проекта требуют подтверждения источником</span></footer>`;
  placeTypeTabs(typeOptions);
  placeSharedSummary();
  bind();
}
function bind() {
  document.querySelectorAll("[data-select]").forEach((el) => {
    el.onclick = () => select(el.dataset.select);
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(el.dataset.select);
      }
    };
  });
  document.querySelectorAll("[data-compare]").forEach(
    (el) =>
      (el.onchange = () => {
        if (el.checked) {
          compare.add(el.dataset.compare);
          if (!selected) {
            select(el.dataset.compare);
            return;
          }
        } else compare.delete(el.dataset.compare);
        render();
      }),
  );
  for (const k of ["search", "block", "type", "status", "sort"])
    document.getElementById(k).onchange = (e) => {
      filters[k] = e.target.value;
      render();
    };
  const programSelect = document.getElementById("program");
  if (programSelect) {
    const label = programSelect.closest("label");
    label?.classList.add("program-select-label");
    const pills = document.createElement("div");
    pills.className = "program-pills";
    for (const option of [...programSelect.options].filter(
      (item) => item.value,
    )) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `program-pill${option.value === programId ? " active" : ""}`;
      button.textContent = option.textContent;
      button.onclick = () => {
        programSelect.value = option.value;
        programSelect.dispatchEvent(new Event("change", { bubbles: true }));
      };
      pills.append(button);
    }
    programSelect.before(pills);
  }
  document.querySelectorAll("[data-finance]").forEach(
    (el) =>
      (el.onchange = (e) => {
        const k = el.dataset.finance;
        finance[k] =
          el.type === "date"
            ? el.value
            : el.value === ""
              ? null
              : Number(el.value);
        if (["repairPerM2", "area"].includes(k)) {
          const selectedApartment = apartment();
          const area = Number.isFinite(finance.area)
            ? finance.area
            : selectedApartment?.area;
          finance.repair =
            Number.isFinite(finance.repairPerM2) &&
            Number.isFinite(area)
              ? finance.repairPerM2 * area
              : null;
          if (Number.isFinite(finance.maintenancePerM2))
            finance.maintenance = Number.isFinite(area)
              ? finance.maintenancePerM2 * area * 12
              : null;
        }
        if (["nights", "occupancy", "operationDate"].includes(k)) {
          const days = daysInYear(
            Number(finance.operationDate?.slice(0, 4)) ||
              new Date().getFullYear(),
          );
          if (k === "occupancy" && occupancyMode === "days") {
            finance.nights = Number(finance.occupancy);
            finance.occupancy = (finance.nights * 100) / days;
          } else if (k === "occupancy" && Number.isFinite(finance.occupancy))
            finance.nights = (finance.occupancy * days) / 100;
          else if (Number.isFinite(finance.nights))
            finance.occupancy = (finance.nights / days) * 100;
        }
        render();
      }),
  );
  const occupancyInput = document.querySelector('[data-finance="occupancy"]');
  if (occupancyInput) {
    const label = occupancyInput.closest("label");
    const toggle = document.createElement("div");
    toggle.className = "occupancy-toggle";
    for (const [mode, text] of [
      ["percent", "В процентах"],
      ["days", "В днях"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `occupancy-mode${occupancyMode === mode ? " active" : ""}`;
      button.textContent = text;
      button.onclick = () => {
        occupancyMode = mode;
        render();
      };
      toggle.append(button);
    }
    label?.insertBefore(toggle, occupancyInput);
    if (occupancyMode === "days")
      occupancyInput.value = Number.isFinite(finance.nights)
        ? finance.nights
        : "";
  }
  document.getElementById("indexation").onchange = (e) => {
    finance.indexationEnabled = e.target.checked;
    render();
  };
  document.getElementById("program").onchange = (e) => {
    programId = e.target.value;
    includeRepair =
      project.programs.find((program) => program.id === programId)
        ?.repairAllowed === true;
    render();
  };
  const repair = document.getElementById("include-repair");
  if (repair)
    repair.onchange = (e) => {
      includeRepair = e.target.checked;
      render();
    };
  document.getElementById("horizon").oninput = (e) => {
    const n = Number(e.target.value),
      r = roi(finance);
    document.getElementById("cumulative").textContent =
      Number.isInteger(n) && n > 0 && n <= 100
        ? (() => {
            const total = cumulativeIncome(finance, n);
            return Number.isFinite(total) ? money(total) : missing;
          })()
        : missing;
  };
  for (const id of ["pdf", "pdf-top"])
    document.getElementById(id).onclick = () => window.print();
  document.getElementById("upload").onchange = async (e) => {
    try {
      load(JSON.parse(await e.target.files[0].text()));
    } catch (err) {
      message(err.message);
    }
  };
  document.getElementById("connect").onclick = () =>
    fetchSource(document.getElementById("source-url").value);
  document.getElementById("refresh").onclick = () =>
    fetchSource(project.source);
}
function message(text) {
  document.getElementById("source-message").textContent = text;
}
function load(data) {
  project = validateProject(data);
  selected = null;
  compare.clear();
  finance = {
    ...project.finance,
    purchaseDate: project.finance.purchaseDate || currentDate(),
  };
  programId = "";
  includeRepair = false;
  const firstAvailable = project.apartments.find(
    (a) => a.status === "available",
  );
  if (firstAvailable) select(firstAvailable.id, false);
  render();
  message("Данные проекта загружены. Проверьте источник и актуальность.");
}
async function fetchSource(url) {
  try {
    if (new URL(url).protocol !== "https:")
      throw Error("Источник должен использовать HTTPS");
    message("Загрузка данных…");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw Error("Ошибка источника: " + response.status);
    const data = validateProject(await response.json());
    const previous = selected;
    project = { ...data, source: url };
    if (
      project.apartments.some(
        (a) => a.id === previous && a.status === "available",
      )
    )
      select(previous);
    else {
      selected = null;
      finance = {
        ...project.finance,
        purchaseDate: project.finance.purchaseDate || currentDate(),
      };
      const firstAvailable = project.apartments.find(
        (a) => a.status === "available",
      );
      if (firstAvailable) select(firstAvailable.id, false);
      render();
    }
    message("Источник обновлён.");
  } catch (err) {
    message(err.message);
  }
}
try {
  const firstAvailable = project.apartments.find(
    (a) => a.status === "available",
  );
  if (firstAvailable) select(firstAvailable.id, false);
  render();
} catch (error) {
  console.error(error);
  document.querySelector("#app").innerHTML =
    `<main class="section"><div class="card"><h1>Не удалось загрузить страницу</h1><p>Ошибка интерфейса: ${escape(error?.message || "неизвестная ошибка")}</p><p class="muted">Обновите проект после синхронизации с GitHub.</p></div></main>`;
}
