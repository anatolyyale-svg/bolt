export const missing = '[ТРЕБУЮТСЯ ДАННЫЕ]';
export const emptyProject = {name:null,description:null,currency:null,render:null,images:[],seaDistance:null,completionDate:null,presentation:null,camera:null,location:null,history:[],apartments:[],floors:[],programs:[],finance:{},source:null};
const driveImage = file => file?.direct_public_url || (file?.google_drive_file_id ? `https://drive.google.com/uc?export=view&id=${file.google_drive_file_id}` : null);
const driveFile = file => file?.direct_public_url || (file?.google_drive_file_id ? `https://drive.google.com/uc?export=download&id=${file.google_drive_file_id}` : null);

// Converts the Centropolis source document into the generic project contract.
// Values confirmed by the user (availability, December 2028, and installment programs)
// are applied here; unconfirmed fields remain null and therefore block calculations.
export function normalizeProject(input){
 if(!input?.project || !Array.isArray(input.apartments)) return input;
 const rental=input.rental_model||{}, renovation=input.renovation||{}, media=input.media||{};
 const rates=rental.nightly_rates||{};
 const layoutByType=new Map((input.plans?.apartment_layouts||[]).map(layout=>[layout.apartment_type,layout]));
 const apartments=input.apartments.map(a=>{
   const nightly=rates[a.type]??null;
   const repair=Number.isFinite(renovation.model_cost_per_m2)&&Number.isFinite(a.area_m2)?renovation.model_cost_per_m2*a.area_m2:null;
   const maintenance=Number.isFinite(rental.maintenance_per_m2_per_month)&&Number.isFinite(a.area_m2)?rental.maintenance_per_m2_per_month*a.area_m2*12:null;
   const layout=layoutByType.get(a.type);
   return {id:a.id,number:a.number,block:a.block,floor:a.floor,type:a.type_label||a.type,direction:a.window_direction||a.view||null,area:a.area_m2,pricePerMeter:a.price_per_m2,price:a.price_total,status:a.status??'available',plan:null,plan3d:null,nightly,nights:rental.paid_nights_per_year??null,occupancy:rental.occupancy_percent??null,indexation:rental.nightly_rate_annual_indexation_percent??null,repair,maintenance,source:a.source,illustrativeLayout:layout?.id||null};
 });
 const floors=[];
 for(const plan of input.plans?.floor_plans||[]) for(const number of (Array.isArray(plan.floors)?plan.floors:[])) floors.push({block:plan.block,number,image:driveImage(plan.clean_png||plan.file),source:plan.file?.google_drive_file_id||null});
 return {...emptyProject,name:input.project.name_ru||input.project.name||null,description:input.project.description||null,currency:input.project.currency||null,render:driveImage(media.architectural_render||media),images:(media.images||[]).map(item=>driveImage(item)).filter(Boolean),seaDistance:input.construction?.distance_to_sea_m??null,completionDate:'Декабрь 2028',presentation:input.links?.presentation?.url||null,camera:null,location:{address:[input.location?.street,input.location?.building_number].filter(Boolean).join(', ')||null,lat:input.location?.latitude??null,lng:input.location?.longitude??null,infrastructure:[]},history:[],apartments,floors,programs:(input.installment_programs||[]).map(program=>({id:program.id,name:`Блок ${program.block}: ${program.down_payment_percent}% / ${program.installment_share_percent}% / ${program.final_payment_percent}%`,downPercent:program.down_payment_percent,months:program.monthly_payment_count,finalPercent:program.final_payment_percent,repairAllowed:false,conditions:'Подтверждено пользователем; договорные документы будут добавлены позже.'})),finance:{repair:null,nightly:null,nights:rental.paid_nights_per_year??null,occupancy:rental.occupancy_percent??null,indexation:rental.nightly_rate_annual_indexation_percent??null,indexationEnabled:false,vat:rental.vat_percent??null,management:rental.management_company_share_percent??null,tax:rental.owner_income_tax_percent??null,maintenance:null,other:null,purchaseDate:null,operationDate:null},source:input.project.website||null,sourceFormat:input.schema_version||null,sourceNotes:input.data_quality?.missing_or_unconfirmed||[]};
}
export function validateProject(input){
 const data=normalizeProject(input);
 if(!data || typeof data !== 'object' || !Array.isArray(data.apartments)) throw Error('Источник должен содержать массив apartments');
 const ids=new Set();
 for(const a of data.apartments){if(!a.id || ids.has(String(a.id))) throw Error('У квартир должны быть уникальные id'); ids.add(String(a.id));if(!['available','reserved','sold'].includes(a.status)) throw Error('Неизвестный статус квартиры');for(const k of ['area','price','pricePerMeter'])if(a[k]!=null&&(!Number.isFinite(a[k])||a[k]<0))throw Error(`Некорректное поле ${k}`);}
 return {...emptyProject,...data,finance:{...data.finance}};
}
export function installment(price,program,repair,included){
 const absent=[];if(!Number.isFinite(price))absent.push('Стоимость квартиры');
 if(!program)absent.push('Программа рассрочки');
 else for(const key of ['downPercent','months','finalPercent'])if(!Number.isFinite(program[key]))absent.push(key);
 if(included&&!Number.isFinite(repair))absent.push('Стоимость ремонта');
 if(absent.length)return {missing:absent};
 if(program.months<=0||program.downPercent<0||program.finalPercent<0||program.downPercent+program.finalPercent>100)return {missing:['Корректные условия программы']};
 const total=price+(included?repair:0),down=total*program.downPercent/100,final=total*program.finalPercent/100;
 return {total,down,final,monthly:(total-down-final)/program.months};
}
export function daysInYear(year){return (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;}
export function roi(v){
 const keys=['price','repair','nightly','nights','vat','management','tax','maintenance','other'];
 const absent=keys.filter(k=>!Number.isFinite(v[k]));
 for(const k of ['purchaseDate','operationDate'])if(!/^\d{4}-\d{2}-\d{2}$/.test(v[k]||'')||!Number.isFinite(Date.parse(v[k])))absent.push(k);
 if(v.indexationEnabled&&!Number.isFinite(v.indexation))absent.push('indexation');
 if(absent.length)return {missing:absent};
 const year=Number(v.operationDate.slice(0,4)),days=daysInYear(year);
 if(keys.some(k=>v[k]<0)||v.nights>days||['vat','management','tax'].some(k=>v[k]>100)||v.operationDate<v.purchaseDate||(v.indexationEnabled&&v.indexation<0))return {missing:['Корректные диапазоны и даты']};
 const investment=v.price+v.repair;
 if(investment<=0)return {missing:['Положительная общая инвестиция']};
 const gross=v.nightly*v.nights,vat=gross*v.vat/100,afterVat=gross-vat,management=afterVat*v.management/100,owner=afterVat-management,tax=owner*v.tax/100,net=owner-tax-v.maintenance-v.other;
 let accumulated=0,payback=null;const annual=[];
 // Annual cash flow model, expenses held fixed, rent indexation starts in the second operating year.
 for(let y=0;y<100;y++){const g=gross*Math.pow(1+(v.indexationEnabled?v.indexation:0)/100,y);const profit=g*(1-v.vat/100)*(1-v.management/100)*(1-v.tax/100)-v.maintenance-v.other;annual.push(profit);if(profit>0&&accumulated+profit>=investment){payback=y+(investment-accumulated)/profit;break;}accumulated+=profit;}
 const wait=(Date.parse(v.operationDate)-Date.parse(v.purchaseDate))/86400000/365.2425;
 return {investment,gross,vat,afterVat,management,owner,tax,net,roi:net/investment*100,payback:payback==null?null:payback+wait,annual,wait};
}
