const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const nodes=new Map(),saved=new Map(),downloads=[],timers=[];
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(type,fn){this[type]=fn},click(){this.clicked=true}});return nodes.get(id)}
let allow=true;
const context=vm.createContext({
 document:{querySelector:node,addEventListener(type,fn){this[type]=fn},createElement(){return {click(){downloads.push(this)},remove(){}}},body:{dataset:{}}},
 window:{addEventListener(){}},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
 setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},confirm:()=>allow,
 TextDecoder,Uint8Array,Blob,URL:{createObjectURL:blob=>{context.latestBlob=blob;return 'blob:download'},revokeObjectURL(){}},
 navigator:{},console
});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
const run=code=>vm.runInContext(code,context);
function file(name,text){const bytes=Buffer.from(text);return {name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}
(async()=>{
 const text='# 테스트 문서\n\n한글 😀\n\n| 항목 | 값 |\n|---|---|\n| 저장 | 확인 |\n';
 context.file=file('한글 문서.markdown',text);
 assert.equal(await run('importMarkdown(file)'),true);
 assert.equal(node('#editor').value,text);
 assert.equal(node('#fileName').value,'한글 문서.md');
 assert.match(node('#preview').innerHTML,/<h1>테스트 문서<\/h1>/);
 assert.match(node('#preview').innerHTML,/<table>/);
 run('saveMarkdown()');assert.equal(downloads.at(-1).download,'한글 문서.md');assert.equal(await context.latestBlob.text(),text);
 timers.forEach(fn=>fn());assert.equal(saved.get('md-lite-doc'),text);
 context.file=file('blocked.html','malicious');assert.equal(await run('importMarkdown(file)'),false);assert.equal(node('#editor').value,text);
 context.file={name:'large.md',size:6*1024*1024};assert.equal(await run('importMarkdown(file)'),false);
 allow=false;context.file=file('other.md','# 다른 글');assert.equal(await run('importMarkdown(file)'),false);assert.equal(node('#editor').value,text);
 allow=true;context.file=file('empty.md','');assert.equal(await run('importMarkdown(file)'),true);assert.equal(node('#editor').value,'');
 context.file=file('roundtrip.md',text);await run('importMarkdown(file)');node('#fileName').value='새 이름';
 let prevented=false;context.document.keydown({ctrlKey:true,key:'s',preventDefault(){prevented=true}});assert.ok(prevented);assert.equal(downloads.at(-1).download,'새 이름.md');
 assert.ok(!run('inline(\'[실행](javascript:alert) ![이미지](data:script)\')').includes('href='));
 context.localStorage.setItem=()=>{throw Error('blocked')};run('render()');timers.at(-1)();assert.match(node('#saveState').textContent,/MD 저장/);
 console.log('PASS: Korean Markdown import → preview → exact source download, cancel, limits, empty file, shortcuts, storage errors');
})().catch(e=>{console.error(e);process.exitCode=1});
