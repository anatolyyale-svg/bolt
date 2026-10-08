import test from 'node:test';
import assert from 'node:assert/strict';
import {roi,installment,daysInYear,validateProject} from './model.js';
// Synthetic inputs used exclusively in tests, never presented as project data.
const inputs={price:100000,repair:10000,nightly:100,nights:200,vat:10,management:20,tax:10,maintenance:1000,other:500,purchaseDate:'2026-01-01',operationDate:'2027-01-01',indexationEnabled:false};
test('missing values do not become zero',()=>{assert.ok(roi({}).missing.includes('price'));assert.ok(installment(null,null,null,false).missing);});
test('cashflow expenses and waiting period',()=>{const r=roi(inputs);assert.equal(r.gross,20000);assert.equal(r.vat,2000);assert.equal(r.management,3600);assert.equal(r.tax,1440);assert.equal(r.net,11460);assert.equal(r.investment,110000);assert.ok(Math.abs(r.payback-(110000/11460+365/365.2425))<1e-9);});
test('indexation affects payback, not initial annual ROI',()=>{const a=roi(inputs),b=roi({...inputs,indexationEnabled:true,indexation:5});assert.equal(a.roi,b.roi);assert.ok(b.payback<a.payback);});
test('nonpositive income does not claim payback',()=>assert.equal(roi({...inputs,nightly:0}).payback,null));
test('invalid dates and ranges block computation',()=>{assert.ok(roi({...inputs,operationDate:'2025-01-01'}).missing);assert.ok(roi({...inputs,nights:400}).missing);assert.ok(roi({...inputs,tax:101}).missing);});
test('installment including repair balances purchase',()=>{const r=installment(100000,{downPercent:20,months:24,finalPercent:10},20000,true);assert.equal(r.total,120000);assert.equal(r.down+r.monthly*24+r.final,r.total);});
test('invalid installment cannot calculate',()=>assert.ok(installment(100,{downPercent:90,finalPercent:20,months:12},null,false).missing));
test('calendar year and source validation',()=>{assert.equal(daysInYear(2028),366);assert.throws(()=>validateProject({apartments:[{id:'a',status:'unknown'}]}));assert.throws(()=>validateProject({apartments:[{id:'a',status:'available'},{id:'a',status:'sold'}]}));});
