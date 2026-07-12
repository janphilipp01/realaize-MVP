import { chromium } from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await br.newPage({viewport:{width:1400,height:1000}});
await pg.goto('http://127.0.0.1:5294/settings',{waitUntil:'networkidle',timeout:30000});
await pg.waitForFunction(()=>document.body.innerText.length>500,{timeout:15000}).catch(()=>{});
await new Promise(r=>setTimeout(r,800));
const probe=await pg.evaluate(()=>{
  const els=[...document.querySelectorAll('*')];
  return { primary: els.some(e=>getComputedStyle(e).color==='rgb(28, 28, 30)'),
           muted: els.some(e=>getComputedStyle(e).color==='rgba(60, 60, 67, 0.45)') };
});
await pg.screenshot({path:'/tmp/settings_after.png',fullPage:true});
console.log('after probe='+JSON.stringify(probe));
await br.close();
