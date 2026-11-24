import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
function host() {
    const dom=new JSDOM('<main></main>');const {document,Event}=dom.window;
    let setting;let command;let modal;let requests=0;let release;
    class Plugin {app={};addSettingTab(tab){setting=tab;}addCommand(c){command=c;}saveData(){throw Error('Secret persistence attempted');}}
    class Modal {contentEl=document.createElement('section');constructor(){modal=this;}open(){document.body.append(this.contentEl);this.onOpen();}close(){this.onClose?.();this.contentEl.remove();}}
    class PluginSettingTab {containerEl=document.createElement('div');}
    class Setting {
        constructor(container){this.container=container;} setName(){return this;}setDesc(){return this;}
        addText(fn){const inputEl=document.createElement('input');this.container.append(inputEl);const t={inputEl,setPlaceholder(){return t;},setValue(v){inputEl.value=v;return t;},onChange(cb){inputEl.addEventListener('input',()=>cb(inputEl.value));return t;}};fn(t);return this;}
        addButton(fn){const el=document.createElement('button');this.container.append(el);const b={setButtonText(v){el.textContent=v;return b;},onClick(cb){el.addEventListener('click',cb);return b;}};fn(b);return this;}
    }
    const obsidian={Plugin,Modal,PluginSettingTab,Setting,requestUrl:async req=>{
        requests++;const body=JSON.parse(req.body);
        if(body.method==='initialize') return {status:200,headers:{},text:JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-03-26'}})};
        if(body.method==='notifications/initialized') return {status:202,headers:{},text:''};
        await new Promise(resolve=>{release=resolve;});
        return {status:200,headers:{},text:JSON.stringify({jsonrpc:'2.0',id:2,result:{structuredContent:{results:[{title:'<img src=x onerror=alert(1)>',url:'https://example.org/'},{title:'unsafe',url:'javascript:alert(1)'}]}}})};
    }};
    const context={module:{exports:{}},require:()=>obsidian,document,URL,setTimeout,clearTimeout,console};
    vm.runInNewContext(readFileSync('main.js','utf8'),context);const plugin=new context.module.exports.default();plugin.onload();
    return {dom,document,Event,plugin,get setting(){return setting;},open(){command.callback();return modal;},get requests(){return requests;},release:()=>release?.()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('built plugin settings keep key in memory and missing key produces no network',async()=>{
    const h=host();h.setting.display();const key=h.setting.containerEl.querySelector('input');assert.equal(key.type,'password');
    const m=h.open();m.contentEl.querySelector('input').value='query';m.contentEl.querySelector('form').dispatchEvent(new h.Event('submit',{cancelable:true}));
    await tick();assert.equal(h.requests,0);assert.match(m.contentEl.querySelector('[role=status]').textContent,/API key/);
    key.value='fixture-secret';key.dispatchEvent(new h.Event('input'));assert.equal(h.plugin.apiKey,'fixture-secret');
    h.setting.containerEl.querySelector('button').click();assert.equal(h.plugin.apiKey,'');
    h.plugin.onunload();h.dom.window.close();
});
test('built plugin renders escaped titles, drops unsafe URLs, prevents duplicate submit, closes safely',async()=>{
    const h=host();h.plugin.apiKey='fixture-key';const m=h.open();m.contentEl.querySelector('input').value='query';const form=m.contentEl.querySelector('form');
    form.dispatchEvent(new h.Event('submit',{cancelable:true}));form.dispatchEvent(new h.Event('submit',{cancelable:true}));await tick();assert.equal(h.requests,3);
    h.release();await tick();assert.equal(m.contentEl.querySelectorAll('a').length,1);assert.equal(m.contentEl.querySelector('img'),null);assert.match(m.contentEl.querySelector('a').textContent,/<img/);
    assert.equal(m.contentEl.querySelector('a').rel,'noopener noreferrer');h.plugin.onunload();assert.equal(h.plugin.apiKey,'');assert.equal(h.document.querySelector('section'),null);h.dom.window.close();
});

test('closing a pending search discards late results and unload clears the key',async()=>{
    const h=host();h.plugin.apiKey='fixture-key';const m=h.open();m.contentEl.querySelector('input').value='query';
    m.contentEl.querySelector('form').dispatchEvent(new h.Event('submit',{cancelable:true}));await tick();
    m.close();h.release();await tick();assert.equal(m.contentEl.childNodes.length,0);
    h.plugin.onunload();assert.equal(h.plugin.apiKey,'');h.dom.window.close();
});
