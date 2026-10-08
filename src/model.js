export const missing = '[ТРЕБУЮТСЯ ДАННЫЕ]';
export const emptyProject = {name:null,description:null,currency:null,render:null,images:[],seaDistance:null,completionDate:null,presentation:null,camera:null,location:null,history:[],apartments:[],floors:[],programs:[],finance:{},source:null};
export function validateProject(data){
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
