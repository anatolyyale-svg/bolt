export const missing = "[ТРЕБУЮТСЯ ДАННЫЕ]";
export const emptyProject = {
  name: null,
  description: null,
  currency: null,
  render: null,
  images: [],
  seaDistance: null,
  completionDate: null,
  presentation: null,
  camera: null,
  location: null,
  history: [],
  apartments: [],
  floors: [],
  programs: [],
  finance: {},
  source: null,
};
const driveImage = (file) =>
  file?.direct_public_url ||
  (file?.google_drive_file_id
    ? `https://drive.google.com/uc?export=view&id=${file.google_drive_file_id}`
    : null);
const driveFile = (file) =>
  file?.direct_public_url ||
  (file?.google_drive_file_id
    ? `https://drive.google.com/uc?export=download&id=${file.google_drive_file_id}`
    : null);

// Converts the Centropolis source document into the generic project contract.
// Project-specific assumptions stay in the JSON source so the UI remains reusable.
export function normalizeProject(input) {
  if (!input?.project || !Array.isArray(input.apartments)) return input;
  const rental = input.rental_model || {},
    renovation = input.renovation || {},
    media = input.media || {};
  const rates = rental.nightly_rates || {};
  const layoutByType = new Map(
    (input.plans?.apartment_layouts || []).map((layout) => [
      layout.apartment_type,
      layout,
    ]),
  );
  const apartments = input.apartments.map((a) => {
    const nightly = rates[a.type] ?? null;
    const repair =
      Number.isFinite(renovation.model_cost_per_m2) &&
      Number.isFinite(a.area_m2)
        ? renovation.model_cost_per_m2 * a.area_m2
        : null;
    const maintenance =
      Number.isFinite(rental.maintenance_per_m2_per_month) &&
      Number.isFinite(a.area_m2)
        ? rental.maintenance_per_m2_per_month * a.area_m2 * 12
        : null;
    const layout = layoutByType.get(a.type);
    return {
      id: a.id,
      number: a.number,
      block: a.block,
      floor: a.floor,
      type: a.type_label || a.type,
      typeKey: a.type,
      direction: a.window_direction || a.view || null,
      area: a.area_m2,
      pricePerMeter: a.price_per_m2,
      price: a.price_total,
      status:
        a.status ??
        (input.inventory?.availability_confirmed_by_user ? "available" : null),
      plan: null,
      plan3d: null,
      nightly,
      nights: rental.paid_nights_per_year ?? null,
      occupancy: rental.occupancy_percent ?? null,
      indexation: rental.nightly_rate_annual_indexation_percent ?? null,
      repairPerM2: renovation.model_cost_per_m2 ?? null,
      repair,
      maintenance,
      maintenancePerM2: rental.maintenance_per_m2_per_month ?? null,
      source: a.source,
      illustrativeLayout: layout?.id || null,
    };
  });
  const floors = [];
  for (const plan of input.plans?.floor_plans || [])
    for (const number of Array.isArray(plan.floors) ? plan.floors : [])
      floors.push({
        block: plan.block,
        number,
        image: driveImage(plan.clean_png || plan.file),
        source: plan.file?.google_drive_file_id || null,
      });
  return {
    ...emptyProject,
    name: input.project.name_ru || input.project.name || null,
    description: input.project.description || null,
    currency: input.project.currency || null,
    render: driveImage(media.architectural_render || media),
    images: (media.images || [])
      .map((item) => driveImage(item))
      .filter(Boolean),
    seaDistance: input.construction?.distance_to_sea_m ?? null,
    completionDate:
      input.construction?.completion_label ||
      input.construction?.completion_date ||
      null,
    presentation: input.links?.presentation?.url || null,
    camera: null,
    location: {
      address:
        [input.location?.street, input.location?.building_number]
          .filter(Boolean)
          .join(", ") || null,
      lat: input.location?.latitude ?? null,
      lng: input.location?.longitude ?? null,
      infrastructure: [],
    },
    history: [],
    apartments,
    floors,
    programs: (input.installment_programs || []).map((program) => ({
      id: program.id,
      block: program.block ?? null,
      name: `Блок ${program.block}: ${program.down_payment_percent}% / ${program.installment_share_percent}% / ${program.final_payment_percent}%`,
      downPercent: program.down_payment_percent,
      months: program.monthly_payment_count,
      finalPercent: program.final_payment_percent,
      finalMonth: program.final_payment_month ?? null,
      repairAllowed: renovation.calculator_can_include_renovation === true,
      conditions:
        "Подтверждено пользователем; договорные документы будут добавлены позже.",
    })),
    finance: {
      repair: null,
      repairPerM2: renovation.model_cost_per_m2 ?? null,
      nightly: null,
      nights: rental.paid_nights_per_year ?? null,
      occupancy: rental.occupancy_percent ?? null,
      indexation: rental.nightly_rate_annual_indexation_percent ?? null,
      indexationEnabled: false,
      vat: rental.vat_percent ?? null,
      management: rental.management_company_share_percent ?? null,
      tax: rental.owner_income_tax_percent ?? null,
      maintenance: null,
      maintenancePerM2: rental.maintenance_per_m2_per_month ?? null,
      purchaseDate: null,
      operationDate:
        input.construction?.rental_operations_start_date ||
        rental.operation_start_date ||
        null,
    },
    source: null,
    sourceFormat: input.schema_version || null,
    sourceNotes: [
      ...(input.data_quality?.missing_or_unconfirmed || []),
      ...(rental.nightly_rate_basis ? [rental.nightly_rate_basis] : []),
    ],
  };
}
export function validateProject(input) {
  const data = normalizeProject(input);
  if (!data || typeof data !== "object" || !Array.isArray(data.apartments))
    throw Error("Источник должен содержать массив apartments");
  const ids = new Set();
  for (const a of data.apartments) {
    if (!a.id || ids.has(String(a.id)))
      throw Error("У квартир должны быть уникальные id");
    ids.add(String(a.id));
    if (
      a.status != null &&
      !["available", "reserved", "sold"].includes(a.status)
    )
      throw Error("Неизвестный статус квартиры");
    for (const k of ["area", "price", "pricePerMeter"])
      if (a[k] != null && (!Number.isFinite(a[k]) || a[k] < 0))
        throw Error(`Некорректное поле ${k}`);
  }
  return { ...emptyProject, ...data, finance: { ...data.finance } };
}
export function applicablePrograms(project, unit) {
  if (!unit) return [];
  return (project.programs || []).filter(
    (program) =>
      program.block == null || String(program.block) === String(unit.block),
  );
}
export function installment(price, program, repair, included) {
  const absent = [];
  if (!Number.isFinite(price)) absent.push("Стоимость квартиры");
  if (!program) absent.push("Программа рассрочки");
  else
    for (const key of ["downPercent", "months", "finalPercent"])
      if (!Number.isFinite(program[key])) absent.push(key);
  if (included && !Number.isFinite(repair)) absent.push("Стоимость ремонта");
  if (absent.length) return { missing: absent };
  if (
    price < 0 ||
    (included && repair < 0) ||
    !Number.isInteger(program.months) ||
    program.months <= 0 ||
    program.downPercent < 0 ||
    program.finalPercent < 0 ||
    program.downPercent + program.finalPercent > 100
  )
    return { missing: ["Корректные условия программы"] };
  const total = price + (included ? repair : 0),
    down = (total * program.downPercent) / 100,
    final = (total * program.finalPercent) / 100;
  return {
    total,
    down,
    final,
    monthly: (total - down - final) / program.months,
  };
}
export function daysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
}
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
export function roi(v) {
  const required = [
    "price",
    "repair",
    "nightly",
    "nights",
    "vat",
    "management",
    "tax",
    "maintenance",
  ];
  const missingFields = new Set();
  const errors = [];
  const valid = {};
  const reject = (field, message) => {
    valid[field] = false;
    missingFields.add(field);
    errors.push({ field, message });
  };
  for (const key of required) {
    valid[key] = Number.isFinite(v[key]) && v[key] >= 0;
    if (!valid[key]) {
      missingFields.add(key);
      if (Number.isFinite(v[key]) && v[key] < 0)
        reject(key, "Значение не может быть отрицательным");
    }
  }
  for (const key of ["vat", "management", "tax"])
    if (valid[key] && v[key] > 100) {
      missingFields.add(key);
      reject(key, "Процент должен быть от 0 до 100");
    }
  const dateValid = {};
  for (const key of ["purchaseDate", "operationDate"]) {
    dateValid[key] = isCalendarDate(v[key]);
    if (!dateValid[key] && v[key])
      reject(key, "Укажите существующую календарную дату");
  }
  if (
    dateValid.purchaseDate &&
    dateValid.operationDate &&
    v.operationDate < v.purchaseDate
  ) {
    dateValid.operationDate = false;
    reject("operationDate", "Начало эксплуатации не может быть раньше покупки");
  }
  const maximumNights = dateValid.operationDate
    ? daysInYear(Number(v.operationDate.slice(0, 4)))
    : 366;
  if (valid.nights && v.nights > maximumNights) {
    missingFields.add("nights");
    reject("nights", "Оплаченных ночей не может быть больше дней в году");
  }
  const indexationValid =
    !v.indexationEnabled ||
    (Number.isFinite(v.indexation) && v.indexation >= 0);
  if (!indexationValid && Number.isFinite(v.indexation))
    reject("indexation", "Индексация не может быть отрицательной");

  // Annual figures are independent of the purchase and operation dates.
  const result = {};
  if (valid.price && valid.repair) result.investment = v.price + v.repair;
  if (valid.nightly && valid.nights) result.gross = v.nightly * v.nights;
  if (Number.isFinite(result.gross) && valid.vat) {
    result.vat = (result.gross * v.vat) / 100;
    result.afterVat = result.gross - result.vat;
  }
  if (Number.isFinite(result.afterVat) && valid.management) {
    result.management = (result.afterVat * v.management) / 100;
    result.owner = result.afterVat - result.management;
  }
  if (Number.isFinite(result.owner) && valid.tax) {
    result.tax = (result.owner * v.tax) / 100;
    if (valid.maintenance)
      result.net = result.owner - result.tax - v.maintenance;
  }
  if (result.investment > 0 && Number.isFinite(result.net))
    result.roi = (result.net / result.investment) * 100;
  if (result.investment === 0)
    reject(
      "investment",
      "Общая инвестиция должна быть больше нуля для расчёта ROI",
    );

  const paybackMissing = [];
  if (!dateValid.purchaseDate) paybackMissing.push("purchaseDate");
  if (!dateValid.operationDate) paybackMissing.push("operationDate");
  if (!indexationValid) paybackMissing.push("indexation");
  if (!Number.isFinite(result.investment)) paybackMissing.push("investment");
  if (!Number.isFinite(result.net)) paybackMissing.push("net");
  if (missingFields.size) result.missing = [...missingFields];
  result.paybackMissing = [...new Set(paybackMissing)];
  if (errors.length) result.errors = errors;
  if (dateValid.purchaseDate && dateValid.operationDate)
    result.wait =
      (Date.parse(v.operationDate) - Date.parse(v.purchaseDate)) /
      86400000 /
      365.2425;
  if (result.paybackMissing.length || !Number.isFinite(result.gross))
    return result;

  let accumulated = 0;
  let payback = null;
  const annual = [];
  for (let y = 0; y < 100; y++) {
    const gross =
      result.gross *
      Math.pow(1 + (v.indexationEnabled ? v.indexation : 0) / 100, y);
    const profit =
      gross * (1 - v.vat / 100) * (1 - v.management / 100) * (1 - v.tax / 100) -
      v.maintenance;
    annual.push(profit);
    if (profit > 0 && accumulated + profit >= result.investment) {
      payback = y + (result.investment - accumulated) / profit;
      break;
    }
    accumulated += profit;
  }
  return {
    ...result,
    payback: payback == null ? null : payback + result.wait,
    annual,
  };
}

export function cumulativeIncome(finance, years) {
  if (!Number.isInteger(years) || years < 1 || years > 100) return null;
  const result = roi(finance);
  if (
    !Number.isFinite(result.net) ||
    (finance.indexationEnabled &&
      (!Number.isFinite(finance.indexation) || finance.indexation < 0))
  )
    return null;
  let total = 0;
  for (let year = 0; year < years; year++) {
    total +=
      result.gross *
        Math.pow(
          1 + (finance.indexationEnabled ? finance.indexation : 0) / 100,
          year,
        ) *
        (1 - finance.vat / 100) *
        (1 - finance.management / 100) *
        (1 - finance.tax / 100) -
      finance.maintenance;
  }
  return Number.isFinite(total) ? total : null;
}
