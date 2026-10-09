import "./style.css";
import "./catalog.css";
import "./calculator.css";
import {
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
  incomeHorizon = 10,
  roiMode = "rental";
const capitalizationRates = Object.freeze({
  excavation: 2100,
  handoverWithoutRepair: 5500,
  handoverWithRepair: 7000,
});
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
const projectDisplayName = () =>
  project.name === "Альянс Центрополис" ? "Centropolis" : project.name;
const windowDirection = (unit) => {
  if (unit?.direction && unit.direction !== missing) return unit.direction;
  const number = Number(unit?.number);
  if (!Number.isFinite(number)) return missing;
  return number % 2 === 0 ? "В сторону Кобулети" : "В сторону Турции";
};
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
    ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v)} ${escape(project.currency === "USD" ? "$" : project.currency || missing)}`
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
function addMonths(value, months) {
  if (!value || !Number.isInteger(months) || months < 0) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return null;
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function finalPaymentInfo(program) {
  if (!program || !Number.isInteger(program.months))
    return { month: null, text: `Дата финального платежа: ${missing}` };
  const month = Number.isInteger(program.finalMonth)
    ? program.finalMonth
    : program.months + 1;
  const date = addMonths(finance.purchaseDate, Math.max(0, month - 1));
  return {
    month,
    text: date
      ? `Дата финального платежа: ${dateLabel(date)} · ${month}-й месяц.`
      : `Дата финального платежа: ${missing} · ${month}-й месяц.`,
  };
}
const sectionHeading = (number, title) =>
  `<div class="reference-heading"><h2>${title}</h2></div>`;
const programText = (program) =>
  program
    ? `Первоначальный взнос ${program.downPercent}% · ${program.installmentPercent ?? missing}% / ${program.months} мес. · ${program.finalPercent}% финальный платёж`
    : missing;
const unitContext = (a) =>
  a
    ? `Блок ${display(a.block)} · этаж ${display(a.floor)} · №${display(a.number)} · ${money(finance.price)}`
    : missing;
const arrowIcon = '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 18 18 6M6 6h12v12"/></svg>';
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

const currencyLabel = () => project.currency === "USD" ? "$" : escape(project.currency || missing);
const numericDisplay = (value) => Number.isFinite(value) ? Number(value.toFixed(2)) : "";
const formatNumber = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)
  : missing;

function capitalizationData(unit, minimumPricePerM2) {
  const area = Number.isFinite(finance.area) ? finance.area : unit?.area;
  const purchasePrice = Number.isFinite(finance.price) ? finance.price : unit?.price;
  const repairPerM2 = Number.isFinite(finance.repairPerM2) ? finance.repairPerM2 : 900;
  const repairCost = Number.isFinite(area) ? area * repairPerM2 : null;
  const withoutRepairValue = Number.isFinite(area)
    ? area * capitalizationRates.handoverWithoutRepair
    : null;
  const withRepairValue = Number.isFinite(area)
    ? area * capitalizationRates.handoverWithRepair
    : null;
  const withoutRepairGain = Number.isFinite(withoutRepairValue) && Number.isFinite(purchasePrice)
    ? withoutRepairValue - purchasePrice
    : null;
  const withRepairGain = Number.isFinite(withRepairValue) && Number.isFinite(purchasePrice) && Number.isFinite(repairCost)
    ? withRepairValue - purchasePrice - repairCost
    : null;
  const percentage = (gain) => Number.isFinite(gain) && Number.isFinite(purchasePrice) && purchasePrice > 0
    ? (gain / purchasePrice) * 100
    : null;
  return {
    area,
    purchasePrice,
    repairPerM2,
    repairCost,
    withoutRepairValue,
    withRepairValue,
    withoutRepairGain,
    withRepairGain,
    withoutRepairPercent: percentage(withoutRepairGain),
    withRepairPercent: percentage(withRepairGain),
    minimumPricePerM2,
  };
}
const capitalizationScenario = (title, value, gain, percent, note = "") =>
  `<article class="capitalization-scenario"><div class="capitalization-scenario-title">${title}</div><strong>${resultValue(value)}</strong><span>Прирост: ${resultValue(gain)} · ${Number.isFinite(percent) ? `${formatNumber(percent)} %` : missing}</span>${note ? `<small>${note}</small>` : ""}</article>`;

function updateCapitalizationView() {
  const data = capitalizationData(apartment());
  const rental = incomeHorizon != null ? cumulativeIncome(finance, incomeHorizon) : null;
  const total = Number.isFinite(data.withRepairValue) && Number.isFinite(data.purchasePrice) && Number.isFinite(data.repairCost) && Number.isFinite(rental)
    ? data.withRepairValue + rental - data.purchasePrice - data.repairCost
    : null;
  document.querySelectorAll("[data-cap-horizon]").forEach((element) => {
    element.textContent = incomeHorizon != null ? `${incomeHorizon} лет` : missing;
  });
  document.querySelectorAll("[data-cap-rental]").forEach((element) => {
    element.textContent = resultValue(rental);
  });
  document.querySelectorAll("[data-cap-total]").forEach((element) => {
    element.textContent = resultValue(total);
  });
  const summaryLines = document.querySelectorAll(".summary-rental-grid .finance-line");
  if (summaryLines.length >= 3) {
    summaryLines[1].querySelector("span").textContent = `ДОХОД ОТ АРЕНДЫ · ${incomeHorizon ?? missing} ЛЕТ`;
    summaryLines[1].querySelector("strong").textContent = resultValue(rental);
    summaryLines[2].querySelector("strong").textContent = resultValue(total);
  }
}

function capitalizationPanelMarkup(unit) {
  const data = capitalizationData(unit);
  const rental = incomeHorizon != null ? cumulativeIncome(finance, incomeHorizon) : null;
  const total = Number.isFinite(data.withRepairValue) && Number.isFinite(data.purchasePrice) && Number.isFinite(data.repairCost) && Number.isFinite(rental)
    ? data.withRepairValue + rental - data.purchasePrice - data.repairCost
    : null;
  return `<section class="capitalization-panel"><div class="capitalization-panel-head"><div><h3>${roiMode === "capitalization-rental" ? "Капитализация и доход от аренды" : "Сценарии капитализации"}</h3><p>Прогнозные значения не являются гарантией доходности.</p></div><span class="capitalization-badge">СЦЕНАРИЙ</span></div><div class="capitalization-scenarios">${capitalizationScenario("Без ремонта · 5 500 $/м²", data.withoutRepairValue, data.withoutRepairGain, data.withoutRepairPercent)}${capitalizationScenario("С ремонтом · 7 000 $/м²", data.withRepairValue, data.withRepairGain, data.withRepairPercent, `В расчёте прироста учтён ремонт ${formatNumber(data.repairPerM2)} $/м².`)}</div>${roiMode === "capitalization-rental" ? `<div class="capitalization-rental-result"><div><span>Прогноз стоимости с ремонтом</span><strong>${resultValue(data.withRepairValue)}</strong></div><div><span>Накопленная чистая прибыль от аренды · <b data-cap-horizon>${incomeHorizon} лет</b></span><strong data-cap-rental>${resultValue(rental)}</strong></div><div class="capitalization-total"><span>Совокупный результат за вычетом покупки и ремонта</span><strong data-cap-total>${resultValue(total)}</strong></div></div><p class="capitalization-hint">Период аренды выбирается в поле «Накопленный доход» ниже. Доход начинается с даты сдачи квартиры в аренду.</p>` : ""}</section>`;
}

function financeField(key, title, unit = "", hint = "", controls = "") {
  const isDate = key.includes("Date");
  const value = isDate ? finance[key] || "" : numericDisplay(finance[key]);
  const id = "finance-" + key;
  return `<div class="field-card"><label class="field-label" for="${id}">${title}</label>${controls}<div class="input-wrap"><input id="${id}" data-finance="${key}" type="${isDate ? "date" : "number"}" ${isDate ? "" : 'min="0" step="any"'} ${["vat", "management", "tax"].includes(key) ? 'max="100"' : ""} value="${escape(value)}" placeholder="${missing}" ${key === "indexation" && !finance.indexationEnabled ? "disabled" : ""}>${unit ? `<span class="input-unit">${unit}</span>` : ""}</div>${hint ? `<p class="field-hint">${hint}</p>` : ""}</div>`;
}

function financeForm() {
  const currency = currencyLabel();
  const rentalRates = [...new Map(
    project.apartments.filter((unit) => Number.isFinite(unit.nightly))
      .map((unit) => [unit.typeKey || unit.type, unit.nightly]),
  )].sort(([left], [right]) =>
    ["studio", "one_bedroom", "two_bedroom"].indexOf(left) -
    ["studio", "one_bedroom", "two_bedroom"].indexOf(right),
  ).map(([type, rate]) => `${escape(typeLabel(type))} — ${formatNumber(rate)} ${currency}`).join(" · ");
  const days = daysInYear(Number(finance.operationDate?.slice(0, 4)) || new Date().getFullYear());
  const occupancyHint = Number.isFinite(finance.occupancy) && Number.isFinite(finance.nights)
    ? `${formatNumber(finance.occupancy)} % · ${formatNumber(finance.nights)} оплаченных ночей из ${days}`
    : missing;
  return [
    financeField("price", "Стоимость квартиры", currency, "Подставляется из выбранной квартиры. Можно изменить для расчёта."),
    financeField("area", "Площадь квартиры", "м²"),
    financeField("repairPerM2", "Ремонт и меблировка", currency + "/м²", `Стоимость ремонта: <strong>${money(finance.repair)}</strong>`),
    financeField("nightly", "Аренда за ночь", currency, rentalRates),
    financeField("occupancy", "Средняя загрузка", occupancyMode === "days" ? "дней" : "%", occupancyHint),
    financeField("indexation", "Ежегодная индексация аренды", "%/год",
      finance.indexationEnabled ? "Учитывается в накопленном доходе и окупаемости." : "Стоимость аренды остаётся постоянной."),
    financeField("purchaseDate", "Дата покупки", "", "По умолчанию — сегодня. Дату можно изменить."),
    financeField("operationDate", "Начало сдачи в аренду", "", "С этой даты начинается арендный доход."),
  ].join("");
}

function refinePresentation(unit, result, program, payment, floor) {
  const roiCard = document.querySelector(".roi-form-card");
  roiCard.innerHTML = `<div class="form-grid">${financeForm()}</div>
    <details class="assumptions"><summary>Расходы и параметры расчёта <span>НДС · управление · налог · обслуживание</span></summary>
      <div class="assumptions-grid">${[
        financeField("vat", "НДС", "%", "От валовой выручки"),
        financeField("management", "Управляющая компания", "%", "После вычета НДС"),
        financeField("tax", "Налог на доход", "%", "От дохода собственника"),
        financeField("maintenance", "Обслуживание за год", currencyLabel()),
      ].join("")}</div>
    </details><p class="model-note">Арендная модель по заданному сценарию. Рост стоимости недвижимости рассчитывается отдельно.</p>`;
  const indexationField = document.querySelector('[data-finance="indexation"]').closest(".field-card");
  const indexationSwitch = document.createElement("label");
  indexationSwitch.className = "check";
  indexationSwitch.innerHTML = `<input id="indexation" type="checkbox" ${finance.indexationEnabled ? "checked" : ""}><span>Учитывать индексацию</span>`;
  indexationField.querySelector(".input-wrap").before(indexationSwitch);

  const summary = document.querySelector(".summary");
  const capSummary = capitalizationData(unit);
  const rentalIncome = incomeHorizon != null ? cumulativeIncome(finance, incomeHorizon) : null;
  const combinedResult = Number.isFinite(capitalization.withRepairValue) && Number.isFinite(capitalization.purchasePrice) && Number.isFinite(capitalization.repairCost) && Number.isFinite(rentalIncome)
    ? capitalization.withRepairValue + rentalIncome - capitalization.purchasePrice - capitalization.repairCost
    : null;
  const percentageLabel = (value) => Number.isFinite(value) ? `${formatNumber(value)} %` : missing;
  const gainLabel = (gain, percent) => `${resultValue(gain)} · ${percentageLabel(percent)}`;
  const summaryModel = roiMode === "rental"
    ? `<div class="summary-yield">${expenseLine("Чистая прибыль / год", money(result.net), "positive")}${expenseLine("ROI · год 1", Number.isFinite(result.roi) ? formatNumber(result.roi) + " %" : missing, "accent")}</div>
    <div class="summary-dates">${expenseLine("Сдача комплекса", display(project.completionDate))}${expenseLine("Окупаемость от покупки", result.paybackMissing?.length ? missing : result.payback == null ? "Не достигнута" : yearsLabel(result.payback))}</div>`
    : roiMode === "capitalization"
      ? `<div class="summary-mode-grid">${expenseLine("Прогноз без ремонта", resultValue(capSummary.withoutRepairValue))}${expenseLine("Прирост без ремонта", gainLabel(capSummary.withoutRepairGain, capSummary.withoutRepairPercent), "accent")}${expenseLine("Прогноз с ремонтом", resultValue(capSummary.withRepairValue))}${expenseLine("Прирост с ремонтом", gainLabel(capSummary.withRepairGain, capSummary.withRepairPercent), "positive")}</div><p class="summary-note summary-disclaimer">Прогнозные значения не являются гарантией доходности.</p>`
      : `<div class="summary-mode-grid summary-rental-grid">${expenseLine("Прогноз с ремонтом", resultValue(capSummary.withRepairValue))}${expenseLine(`Доход от аренды · ${incomeHorizon ?? missing} лет`, resultValue(rentalIncome), "positive")}${expenseLine("Совокупный результат", resultValue(combinedResult), "accent")}</div><p class="summary-note summary-disclaimer">Стоимость ремонта вычтена один раз. Период аренды можно изменить в калькуляторе.</p>`;
  const modelLabel = roiMode === "rental" ? "Авторасчёт" : roiMode === "capitalization" ? "Капитализация" : "Капитализация + аренда";
  summary.innerHTML = `<div class="summary-heading"><span class="eyebrow">ИТОГ</span><span class="summary-live"><i></i> ${modelLabel}</span></div>
    <div class="summary-unit"><small>${escape(projectDisplayName())}</small><h3>${unit ? `Блок ${display(unit.block)} · №${display(unit.number)}` : "Выберите квартиру"}</h3>
    <span>${unit ? `Этаж ${display(unit.floor)} · ${escape(typeLabel(unit.typeKey || unit.type))} · ${formatNumber(finance.area)} м²` : missing}</span></div>
    <div class="summary-images"><div>${image(unit?.plan, "Планировка квартиры")}<small>Планировка</small></div><div>${image(floor?.image, "План этажа")}<small>План этажа</small></div></div>
    ${expenseLine("Стоимость квартиры", money(finance.price))}
    ${expenseLine("Ремонт", money(finance.repair))}
    ${expenseLine("Общая инвестиция", money(result.investment))}
    ${summaryModel}
    <button id="pdf" class="button full">Инвестиционный PDF <span aria-hidden="true">${arrowIcon}</span></button><small class="summary-note">Обновляется при изменении параметров</small>`;
  const modelGrowth = document.querySelector(".model-card.blue-edge");
  const capitalization = project.investmentModel || {};
  const growthRate = Number.isFinite(capitalization.annualGrowthPercent)
    ? `≈ ${formatNumber(capitalization.annualGrowthPercent)} %`
    : missing;
  const growthNotes = [
    capitalization.constructionGrowthNote,
    capitalization.managementGrowthNote,
  ].filter(Boolean);
  modelGrowth.innerHTML = `<span class="model-tag">СТОИМОСТЬ ОБЪЕКТА</span><h3>Рост капитализации</h3><div class="growth-key"><strong>${growthRate}</strong><span>ориентир ежегодного роста</span></div>${growthNotes.length ? `<ul>${growthNotes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul><p class="model-disclaimer">Ориентир для сценария, не гарантия доходности.</p>` : `<div class="missing-state"><span>${missing}</span><p>Сценарий роста стоимости не загружен.</p></div>`}`;
  const rentalModel = document.querySelector(".model-card.green-edge");
  rentalModel.innerHTML = `<span class="model-tag">АРЕНДНЫЙ СЦЕНАРИЙ</span><h3>Пассивный доход</h3><div class="model-primary">${money(finance.nightly)}<small>за ночь</small></div><p class="model-caption">${formatNumber(finance.occupancy)} % загрузки · ${formatNumber(finance.nights)} ночей в год</p><a class="text-link" href="#investment">Настроить расчёт <span aria-hidden="true">${arrowIcon}</span></a>`;
  const historyHead = document.querySelector(".history-card-head");
  historyHead.innerHTML = `<h3>История роста стоимости</h3><span class="history-status">История проекта</span>`;
  const calcTabs = document.querySelector(".stage-tabs");
  calcTabs.outerHTML = '<div class="calc-kicker"><span>ПЛАН ОПЛАТЫ</span><span>Выберите подходящую программу</span></div>';
  document.querySelector(".program-box > strong").textContent = unit ? "Программы для блока " + unit.block : "Программы рассрочки";
  const programLabel = document.querySelector(".program-select-label");
  for (const child of [...programLabel.childNodes]) if (child.nodeType === Node.TEXT_NODE) child.remove();
  const notes = document.querySelectorAll(".payment-note");
  notes[0].textContent = program?.conditions || missing;
  const finalNote = document.querySelector(".payment-note.blue");
  finalNote.textContent = finalPaymentInfo(program).text;
  const repairDescription = document.querySelector(".repair-card > p");
  if (repairDescription) repairDescription.innerHTML = `База рассрочки: <strong>${money(payment.total)}</strong> · ${includeRepair ? "с ремонтом" : "без ремонта"}`;
  const horizon = document.getElementById("horizon");
  horizon.value = incomeHorizon ?? "";
  document.getElementById("cumulative").textContent = incomeHorizon != null ? money(cumulativeIncome(finance, incomeHorizon)) : "";
  const resultPrice = document.querySelector(".roi-results > .finance-line");
  resultPrice.querySelector("strong").textContent = money(finance.price);
  if (roiMode !== "rental") {
    document.querySelector(".roi-tabs")?.insertAdjacentHTML("afterend", capitalizationPanelMarkup(unit));
  }
  const unitPlan = document.querySelector("#plans article:first-child");
  if (!unit?.plan) unitPlan.querySelector(".asset-note")?.remove();
}

function placeSharedSummary() {
  const main = document.querySelector("#app main");
  const firstSection = main?.querySelector("#investment-model");
  const sourceSection = main?.querySelector(".source-section");
  const summary = main?.querySelector("#investment .summary");
  const catalog = main?.querySelector("#catalog");
  if (!main || !firstSection || !sourceSection || !summary) return;
  const layout = document.createElement("div");
  layout.className = "page-layout";
  const pageMain = document.createElement("div");
  pageMain.className = "page-main";
  summary.remove();
  catalog?.remove();
  main.insertBefore(layout, firstSection);
  let section = firstSection;
  while (section && section !== sourceSection) {
    const next = section.nextElementSibling;
    pageMain.append(section);
    section = next;
  }
  layout.append(pageMain, summary);
  if (catalog) {
    const history = pageMain.querySelector("#history");
    if (history) history.after(catalog);
    else pageMain.prepend(catalog);
  }
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
  const previousUI = {
    tableTop: document.querySelector(".table-scroll")?.scrollTop || 0,
    tableLeft: document.querySelector(".table-scroll")?.scrollLeft || 0,
    assumptionsOpen: document.querySelector(".assumptions")?.open || false,
    sourceOpen: document.querySelector(".source-section")?.open || false,
    focusedField: document.activeElement?.dataset?.finance,
  };
  const a = apartment();
  const r = roi(finance);
  const p = project.programs.find((program) => program.id === programId);
  const ip = installment(finance.price, p, finance.repair, includeRepair);
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
  const currentMinimumPrice = minimum.length ? Math.min(...minimum) : null;
  const cap = capitalizationData(a, currentMinimumPrice);
  const map =
    Number.isFinite(project.location?.lat) && Number.isFinite(project.location?.lng)
      ? `<iframe title="Расположение комплекса в Google Maps" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${project.location.lat},${project.location.lng}&output=embed"></iframe>`
      : `<div class="asset-placeholder map-placeholder"><span>⌖</span><strong>Расположение комплекса</strong><small>${missing}</small></div>`;
  const apartmentTable = rows
    .map(
      (unit) =>
        `<tr class="${selected === unit.id ? "selected" : unit.status}" data-select-row="${escape(unit.id)}" tabindex="${unit.status === "available" ? "0" : "-1"}" aria-selected="${selected === unit.id ? "true" : "false"}" aria-label="${unit.status === "available" ? `Выбрать квартиру ${escape(unit.number)}, блок ${escape(unit.block)}, этаж ${escape(unit.floor)}` : `Квартира ${escape(unit.number)}, недоступна для выбора`}"><td><input aria-label="Сравнить квартиру ${escape(unit.number)}" type="checkbox" data-compare="${escape(unit.id)}" ${compare.has(unit.id) ? "checked" : ""}></td><td>${display(unit.block)}</td><td>${display(unit.floor)}</td><td><button class="row-select" data-select="${escape(unit.id)}" ${unit.status !== "available" ? "disabled" : ""}>${display(unit.number)}</button></td><td>${display(unit.type)}</td><td>${escape(windowDirection(unit))}</td><td>${display(unit.area)}</td><td>${money(unit.pricePerMeter)}</td><td>${money(unit.price)}</td><td><span class="badge">${selected === unit.id ? "Выбрана" : { available: "Свободна", reserved: "Забронирована", sold: "Продана" }[unit.status] || missing}</span></td></tr>`,
    )
    .join("");
  const comparison =
    compare.size > 1
      ? `<div class="comparison"><h3>Сравнение квартир</h3><div class="comparison-grid">${project.apartments
          .filter((unit) => compare.has(unit.id))
          .map(
            (unit) =>
              `<div class="card"><h3>Квартира ${display(unit.number)}</h3><p>${display(unit.type)} · ${display(unit.area)} м²</p><strong>${money(unit.price)}</strong><p>Блок ${display(unit.block)} · этаж ${display(unit.floor)}</p><p>Окна: ${escape(windowDirection(unit))}</p></div>`,
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
  const roiTabs = `<div class="roi-tabs"><button class="roi-tab${roiMode === "rental" ? " active" : ""}" data-roi-mode="rental">Доход от аренды</button><button class="roi-tab${roiMode === "capitalization" ? " active" : ""}" data-roi-mode="capitalization">Капитализация</button><button class="roi-tab${roiMode === "capitalization-rental" ? " active" : ""}" data-roi-mode="capitalization-rental">Капитализация + доход от аренды</button></div>`;
  const formFields = financeForm();
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
  document.querySelector("#app").innerHTML = `
<header><a class="brand" href="#">ESTATE<span>INVESTMENT PLATFORM</span></a><nav><a href="#overview">О проекте</a><a href="#catalog">Квартиры</a><a href="#plans">Планировки</a><a href="#investment">Инвестиции</a></nav><button id="pdf-top" class="outline">Сформировать PDF ${arrowIcon}</button></header>
<main>
<section id="overview" class="hero"><div class="hero-copy"><h1>${projectDisplayName() ? escape(projectDisplayName()) : "Centropolis"}</h1><div class="actions"><a class="button" href="#catalog">Выбрать квартиру ${arrowIcon}</a><a class="text-link" href="#investment">Рассчитать инвестицию →</a></div></div><div class="hero-visual">${image(project.render, "Архитектурный рендер проекта")}</div></section>
<div class="stats">${[["Свободные квартиры", project.apartments.filter((unit) => unit.status === "available").length], ["Расстояние до моря", project.seaDistance ? `${project.seaDistance} м` : null], ["Минимальная цена за м²", minimum.length ? money(Math.min(...minimum)) : null], ["Дата сдачи", project.completionDate]].map(([key, value]) => `<div><small>${key}</small><strong>${display(value)}</strong></div>`).join("")}</div>
${safe(project.camera) ? `<section class="reference-section camera-section"><div class="camera-copy"><span class="live-badge">● LIVE</span><h2>Камера строительной площадки</h2><p>Следите за ходом строительства в реальном времени.</p><a class="button" target="_blank" rel="noopener" href="${escape(safe(project.camera))}">Открыть live-камеру ${arrowIcon}</a></div><div class="camera-preview">${image(project.cameraPreview, "Онлайн-камера")}</div></section>` : ""}
<section class="section" id="catalog"><div class="section-head"><div><div class="eyebrow">ВЫБОР ОБЪЕКТА</div><h2>Свободные квартиры</h2></div><span class="muted">Прайс от ${dateLabel(project.updatedAt)}</span></div><div class="filters"><label class="search">Поиск<input id="search" value="${escape(filters.search)}" placeholder="Номер, блок или тип квартиры"></label><label>Блок<select id="block"><option value="">Все блоки</option>${[...new Set(project.apartments.map((unit) => unit.block))].map((block) => `<option ${String(block) === filters.block ? "selected" : ""}>${escape(block)}</option>`).join("")}</select></label><label>Тип квартиры<select id="type"><option value="">Все типы</option>${[...new Map(project.apartments.map((unit) => [unit.typeKey || unit.type, unit.typeKey || unit.type])).entries()].map(([value, label]) => `<option value="${escape(value)}" ${filters.type === value ? "selected" : ""}>${escape(typeLabel(label))}</option>`).join("")}</select></label><label>Статус<select id="status">${[["available", "Свободна"], ["reserved", "Забронирована"], ["sold", "Продана"], ["", "Все статусы"]].map(([value, label]) => `<option value="${value}" ${filters.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Сортировка<select id="sort">${[["number", "По номеру"], ["price", "По стоимости"], ["area", "По площади"]].map(([value, label]) => `<option value="${value}" ${filters.sort === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><div class="table-wrap"><div class="table-scroll"><table><thead><tr>${["Сравнить", "Блок", "Этаж", "Квартира", "Тип", "Окна", "Площадь", "Цена / м²", "Стоимость", "Статус"].map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${apartmentTable}</tbody></table></div>${!rows.length ? `<div class="empty"><span>⌕</span><h3>${project.apartments.length ? "Нет квартир по выбранным условиям" : "Каталог ожидает данные проекта"}</h3><p>${project.apartments.length ? "Измените фильтры, чтобы увидеть другие квартиры." : `${missing} · Подключите источник или загрузите JSON проекта.`}</p></div>` : ""}</div>${comparison}</section>
<section class="section reference-section" id="investment-model">${sectionHeading("01", "Инвестиционная модель")}<div class="model-grid"><article class="model-card blue-edge"><h3>Рост капитализации</h3><ul><li>Историческая динамика: ${missing}</li><li>Подтверждённый прогноз: ${missing}</li><li>Период сравнения: ${missing}</li></ul></article><article class="model-card green-edge"><h3>Пассивный доход</h3><ul><li>Ставка: ${unitRate(finance.nightly, `${project.currency || "USD"} / ночь`)}</li><li>Загрузка: ${display(finance.occupancy)}% · ${display(finance.nights)} ночей в год</li><li>Управление: ${display(finance.management)}% после НДС</li></ul></article></div></section>
<section class="section reference-section" id="expenses">${sectionHeading("02", "Расходы инвестора")}<div class="expense-grid"><article><small>НДС</small><strong>${Number.isFinite(finance.vat) ? `${finance.vat}% от общей выручки` : missing}</strong></article><article><small>УПРАВЛЯЮЩАЯ КОМПАНИЯ</small><strong>${Number.isFinite(finance.management) ? `${finance.management}% после НДС` : missing}</strong></article><article><small>НАЛОГ НА ДОХОД ОТ АРЕНДЫ</small><strong>${Number.isFinite(finance.tax) ? `${finance.tax}% с доли собственника` : missing}</strong></article><article><small>ОБСЛУЖИВАНИЕ КОМПЛЕКСА</small><strong>${Number.isFinite(finance.maintenancePerM2) ? `${formatNumber(finance.maintenancePerM2)} ${currencyLabel()}/м² в месяц` : missing}</strong></article></div><div class="info-strip">Все расчёты ROI ниже автоматически учитывают эти расходы.</div></section>
<section class="section reference-section" id="location">${sectionHeading("03", "Локация комплекса")}<div class="location-card"><div class="map-frame">${map}${Number.isFinite(project.location?.lat) && Number.isFinite(project.location?.lng) ? `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${project.location.lat},${project.location.lng}" target="_blank" rel="noopener">Открыть карту ${arrowIcon}</a>` : ""}</div><div class="location-meta"><div><small>ГОРОД</small><strong>${display(project.location?.city)}</strong></div><div><small>ДО МОРЯ</small><strong>${Number.isFinite(project.seaDistance) ? `${project.seaDistance} м` : missing}</strong></div><div><small>АДРЕС</small><strong>${display(project.location?.address)}</strong></div></div></div></section>
<section class="section reference-section" id="history">${sectionHeading("04", "История роста стоимости")}<div class="history-card"><div class="history-card-head"><h3>История роста стоимости</h3><span class="history-status">Прогнозный сценарий</span></div><div class="history-metrics"><article><small>НА ЭТАПЕ КОТЛОВАНА</small><strong>${money(capitalizationRates.excavation)} / м²</strong><span>Исходный ориентир</span></article><article><small>СЕГОДНЯ</small><strong>${Number.isFinite(cap.minimumPricePerM2) ? `${money(cap.minimumPricePerM2)} / м²` : missing}</strong><span>Минимальная цена среди свободных квартир</span></article><article><small>ПЕРЕДАЧА КЛЮЧЕЙ · БЕЗ РЕМОНТА</small><strong>${money(capitalizationRates.handoverWithoutRepair)} / м²</strong><span>Прогнозная стоимость</span></article><article><small>ПЕРЕДАЧА КЛЮЧЕЙ · С РЕМОНТОМ</small><strong>${money(capitalizationRates.handoverWithRepair)} / м²</strong><span>Прогнозная стоимость</span></article></div><div class="history-disclaimer">Прогнозные значения ориентировочные и не являются гарантией будущей доходности.</div></div></section>
<section class="section" id="plans">${sectionHeading("05", "Квартира и план этажа")}<div class="two-col"><article class="card"><div class="card-top"><h3>Ваша квартира</h3><span>ПЛАНИРОВКА</span></div>${image(a?.plan, "Планировка квартиры")}${a?.illustrativeLayout ? `<p class="asset-note">Типовая планировка. Соответствие конкретной квартире не подтверждено.</p>` : ""}<div class="detail-grid">${[["Номер", a?.number], ["Блок", a?.block], ["Этаж", a?.floor], ["Тип", a?.type], ["Площадь", a?.area], ["Стоимость", a ? money(a.price) : null]].map(([key, value]) => `<div><small>${key}</small><strong>${display(value)}</strong></div>`).join("")}</div></article><article class="card"><div class="card-top"><h3>Расположение на этаже</h3><span>ИНТЕРАКТИВНЫЙ ПЛАН</span></div><div class="floor-plan">${image(floor?.image, "План этажа")}</div>${floor?.rangeUnconfirmed ? `<p class="asset-note">План найден для диапазона этажей. Точная привязка к этажу требует подтверждения.</p>` : ""}${floorUnits.length ? `<div class="floor-units"><div class="floor-units-heading"><span>Всего квартир на этаже:</span><strong>${floorUnits.length}</strong></div>${floorUnits.map((unit) => `<button class="floor-unit ${selected === unit.id ? "selected" : unit.status}" data-select="${escape(unit.id)}">${display(unit.number)}</button>`).join("")}</div>` : ""}<div class="legend"><span>● Свободна</span><span class="yellow">● Выбрана</span><span class="muted">● Забронирована</span><span class="red">● Продана</span></div></article></div></section>
<section class="section" id="installment">${sectionHeading("06", "Калькулятор рассрочки")}<div class="calc-shell"><div class="stage-tabs"><span class="active">01 · ВЫБОР ПЛАНА</span><span>02 · СТРУКТУРА ПЛАТЕЖЕЙ</span><span>03 · ГРАФИК ПЛАТЕЖЕЙ</span></div><div class="calc-context"><span>УСЛОВИЯ</span><strong>${unitContext(a)}</strong></div><div class="program-box"><strong>Блок ${display(a?.block)} · подтверждённые сценарии рассрочки</strong><label class="program-select-label">Программа рассрочки<select id="program"><option value="">Выберите подтверждённую программу</option>${availablePrograms.map((program) => `<option value="${escape(program.id)}" ${program.id === programId ? "selected" : ""}>${escape(programText(program))}</option>`).join("")}</select></label><p class="calc-note">${finalNote}</p></div>${p?.repairAllowed ? `<div class="repair-card"><label class="check"><input id="include-repair" type="checkbox" ${includeRepair ? "checked" : ""}><span><strong>Включить стоимость ремонта в рассрочку</strong><small>${unitRate(finance.repairPerM2, `${currencyLabel()}/м²`)} × ${formatNumber(finance.area)} м² · ${money(finance.repair)}. Ставка редактируется в ROI.</small></span></label><p>База рассрочки: <strong>${money(repairBase)}</strong> · включая ремонт · Общая стоимость ремонта: <strong>${money(finance.repair)}</strong></p></div>` : ""}<div class="payment-grid"><div class="payment-cell highlight"><span>Первоначальный взнос (${display(p?.downPercent)}%)</span><strong>${money(ip.down)}</strong></div><div class="payment-cell"><span>Рассрочка (${display(p?.installmentPercent)}% / ${display(p?.months)} мес.)</span><strong>${money(monthlyPart)}</strong></div><div class="payment-cell highlight"><span>Ежемесячный платёж</span><strong>${money(ip.monthly)}</strong></div><div class="payment-cell"><span>Финальный платёж (${display(p?.finalPercent)}%)</span><strong>${money(ip.final)}</strong></div></div><p class="payment-note">Финальный платёж вносится единовременно либо переоформляется в ипотеку — на выбор клиента.</p><p class="payment-note blue">${finalNote}</p><div class="payment-timeline"><div><i></i><strong>${display(p?.downPercent)}%</strong><small>СЕГОДНЯ</small></div><hr><div><i></i><strong>${display(p?.installmentPercent)}%</strong><small>${display(p?.months)} МЕС.</small></div><hr><div><i></i><strong>${display(p?.finalPercent)}%</strong><small>ФИНАЛЬНЫЙ ПЛАТЁЖ</small></div></div>${ip.missing ? `<p class="notice">${missing}: ${ip.missing.map(escape).join(", ")}</p>` : ""}</div></section>
<section class="section" id="investment">${sectionHeading("07", "ROI-калькулятор")}<div class="roi-shell">${roiTabs}<div class="roi-layout"><div class="roi-main"><div class="roi-form-card"><div class="form-grid">${formFields}</div><label class="check"><input type="checkbox" id="indexation" ${finance.indexationEnabled ? "checked" : ""}>Учитывать индексацию цены за ночь</label><p class="model-note">Расчёт использует подтверждённые параметры проекта. Рост стоимости недвижимости в ROI не включён без исторических данных.</p></div><div class="roi-results"><h3>Финансовые результаты</h3>${r.missing ? `<p class="notice">${missing}: ${r.missing.map((key) => escape(labels[key] || key)).join(", ")}</p>` : ""}${expenseLine("Стоимость квартиры", resultValue(r.investment ? finance.price : null))}${expenseLine("Стоимость ремонта", money(finance.repair))}${expenseLine("Общая инвестиция", resultValue(r.investment))}${expenseLine("Валовая выручка", resultValue(r.gross))}${resultExpense("НДС", r.vat)}${expenseLine("Доход после НДС", resultValue(r.afterVat))}${resultExpense("Управление", r.management)}${expenseLine("Доход собственника", resultValue(r.owner))}${resultExpense("Налог на доход", r.tax)}${resultExpense("Обслуживание", finance.maintenance)}${expenseLine("Чистая прибыль за год 1", netLabel, "highlight")}${expenseLine("ROI (год 1)", roiLabel, "highlight")}${expenseLine("Ожидание до начала аренды", Number.isFinite(r.wait) ? `${Math.round(r.wait * 12)} мес.` : missing)}${expenseLine("Срок окупаемости (с даты покупки)", paybackLabel)}<label class="horizon-label">Накопленный доход <span>Период аренды, лет</span><input id="horizon" type="number" min="1" max="100" step="1" placeholder="${missing}"></label><p id="cumulative" class="notice"></p></div></div><aside class="card summary sticky-summary"><div class="eyebrow">ИТОГ</div><div class="summary-unit"><strong>${escape(projectDisplayName())}</strong><span>${a ? `Блок ${display(a.block)} · этаж ${display(a.floor)} · №${display(a.number)}` : missing}</span><span>${a ? `${display(a.type)} · ${display(a.area)} м²` : missing}</span><strong>${money(a?.price)}</strong></div><div class="summary-images"><div>${image(a?.plan, "Планировка квартиры")}<small>Планировка квартиры</small></div><div>${image(floor?.image, "Позиция на этаже")}<small>Позиция на этаже</small></div></div>${summaryRows}<button id="pdf" class="button full">Инвестиционный PDF ${arrowIcon}</button><small class="summary-note">Пересчитывается автоматически при изменении любого поля.</small></aside></div></div></section>
<details class="source-section"><summary>Данные проекта <span>Загрузить JSON или обновить источник</span></summary><div class="source-controls"><label class="outline upload">Загрузить JSON<input id="upload" type="file" accept="application/json"></label><input id="source-url" type="url" placeholder="HTTPS URL источника" value="${escape(project.source || "")}"><button id="connect" class="outline">Подключить</button><button id="refresh" class="outline" ${!project.source ? "disabled" : ""}>Обновить</button>${safe(project.presentation) ? `<a class="outline" target="_blank" rel="noopener" href="${escape(safe(project.presentation))}">Презентация ${arrowIcon}</a>` : ""}</div><p id="source-message" role="status"></p></details></main><footer><a class="brand" href="#">ESTATE</a><span>Инвестиционные решения на основе данных</span><span>Данные проекта требуют подтверждения источником</span></footer>`;
  refinePresentation(a, r, p, ip, floor);
  placeSharedSummary();
  bind();
  const tableScroll = document.querySelector(".table-scroll");
  tableScroll.scrollTop = previousUI.tableTop;
  tableScroll.scrollLeft = previousUI.tableLeft;
  document.querySelector(".assumptions").open = previousUI.assumptionsOpen;
  document.querySelector(".source-section").open = previousUI.sourceOpen;
  if (previousUI.focusedField)
    document.querySelector('[data-finance="' + previousUI.focusedField + '"]')?.focus({ preventScroll: true });
}
function bind() {
  document.querySelectorAll("img").forEach((img) => {
    img.onerror = () => {
      const fallback = document.createElement("div");
      fallback.innerHTML = image(null, img.alt);
      img.replaceWith(fallback.firstElementChild);
    };
  });
  document.querySelectorAll("[data-select]").forEach((el) => {
    el.onclick = () => select(el.dataset.select);
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(el.dataset.select);
      }
    };
  });
  document.querySelectorAll("[data-select-row]").forEach((row) => {
    row.onclick = (event) => {
      if (event.target.closest("input, button, a, select")) return;
      select(row.dataset.selectRow);
    };
    row.onkeydown = (event) => {
      if (event.target !== row) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(row.dataset.selectRow);
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
      button.setAttribute("aria-pressed", String(option.value === programId));
      const program = project.programs.find((item) => item.id === option.value);
      button.innerHTML = program
        ? `<span class="program-top"><strong>${display(program.downPercent)}%</strong><span>Первоначальный взнос</span></span><span class="program-term">${display(program.installmentPercent)}% · ${display(program.months)} мес.</span><span class="program-final">${display(program.finalPercent)}% финальный платёж</span>`
        : escape(option.textContent);
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
          const area = Number.isFinite(finance.area)
            ? finance.area
            : null;
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
        if (k === "maintenance" && Number.isFinite(finance.maintenance) && finance.area > 0) {
          finance.maintenancePerM2 = finance.maintenance / finance.area / 12;
        }
        if (["nights", "occupancy", "operationDate"].includes(k)) {
          const days = daysInYear(
            Number(finance.operationDate?.slice(0, 4)) ||
              new Date().getFullYear(),
          );
          if (k === "occupancy" && occupancyMode === "days") {
            finance.nights = finance.occupancy;
            finance.occupancy = Number.isFinite(finance.nights)
              ? (finance.nights * 100) / days
              : null;
          } else if (k === "occupancy" && Number.isFinite(finance.occupancy))
            finance.nights = (finance.occupancy * days) / 100;
          else if (k === "occupancy") finance.nights = null;
          else if (Number.isFinite(finance.nights))
            finance.occupancy = (finance.nights / days) * 100;
        }
        // Let the next control receive focus before replacing the form on blur.
        setTimeout(render, 0);
      }),
  );
  const occupancyInput = document.querySelector('[data-finance="occupancy"]');
  if (occupancyInput) {
    const label = occupancyInput.closest(".field-card");
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
    label?.querySelector(".input-wrap")?.before(toggle);
    occupancyInput.max = occupancyMode === "days"
      ? daysInYear(Number(finance.operationDate?.slice(0, 4)) || new Date().getFullYear())
      : 100;
    if (occupancyMode === "days")
      occupancyInput.value = Number.isFinite(finance.nights)
        ? numericDisplay(finance.nights)
        : "";
  }
  document.getElementById("indexation").onchange = (e) => {
    finance.indexationEnabled = e.target.checked;
    render();
  };
  document.querySelectorAll("[data-roi-mode]").forEach((tab) => {
    tab.onclick = () => {
      roiMode = tab.dataset.roiMode;
      render();
    };
  });
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
  const horizonInput = document.getElementById("horizon");
  if (horizonInput) horizonInput.oninput = (e) => {
    const n = Number(e.target.value);
    incomeHorizon = Number.isInteger(n) && n > 0 && n <= 100 ? n : null;
    const cumulative = document.getElementById("cumulative");
    if (cumulative) cumulative.textContent =
      Number.isInteger(n) && n > 0 && n <= 100
        ? (() => {
            const total = cumulativeIncome(finance, n);
            return Number.isFinite(total) ? money(total) : missing;
          })()
        : missing;
    updateCapitalizationView();
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
  document.querySelector(".source-section").open = true;
}
function load(data) {
  project = validateProject(data);
  selected = null;
  compare.clear();
  incomeHorizon = 10;
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
