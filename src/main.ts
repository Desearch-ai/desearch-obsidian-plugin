import {App, Modal, Plugin, PluginSettingTab, Setting, requestUrl} from 'obsidian';
import {search, SearchError, type Transport} from './client';

const transport: Transport = async request => {
    const response = await requestUrl({...request,throw:false});
    return {status:response.status,headers:response.headers,text:response.text};
};
export default class DesearchPlugin extends Plugin {
    apiKey = '';
    private active = new Set<SearchModal>();
    onload() {
        this.addSettingTab(new DesearchSettings(this.app,this));
        this.addCommand({id:'search-web',name:'Search web',callback:() => {
            const modal = new SearchModal(this.app,() => this.apiKey,() => this.active.delete(modal));
            this.active.add(modal);
            modal.open();
        }});
    }
    onunload() { this.apiKey=''; for (const modal of this.active) modal.close(); this.active.clear(); }
}
class DesearchSettings extends PluginSettingTab {
    constructor(app: App, private plugin: DesearchPlugin) {super(app,plugin);}
    display() {
        this.containerEl.replaceChildren();
        new Setting(this.containerEl).setName('Desearch API key').setDesc('Stored only in memory until Obsidian reloads. Only your submitted query is sent to mcp.desearch.ai.').addText(text => {
            text.inputEl.type='password'; text.inputEl.autocomplete='off';
            text.setPlaceholder('Enter API key for this session').setValue(this.plugin.apiKey).onChange(value => {this.plugin.apiKey=value;});
        });
        new Setting(this.containerEl).setName('Clear API key').addButton(button => button.setButtonText('Clear').onClick(() => {this.plugin.apiKey=''; this.display();}));
    }
}
class SearchModal extends Modal {
    private closed = false;
    private busy = false;
    constructor(app: App,private key:() => string,private finished:() => void) {super(app);}
    onOpen() {
        this.closed=false;
        const title=document.createElement('h2'); title.textContent='Search with Desearch';
        const form=document.createElement('form');
        const label=document.createElement('label'); label.textContent='Search query';
        const input=document.createElement('input'); input.type='search'; input.maxLength=2000; label.append(input);
        const button=document.createElement('button'); button.type='submit'; button.textContent='Search';
        const status=document.createElement('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
        const results=document.createElement('ul'); results.setAttribute('aria-label','Search results');
        form.append(label,button); this.contentEl.append(title,form,status,results); input.focus();
        form.addEventListener('submit',event => {
            event.preventDefault();
            if (this.busy || this.closed) return;
            this.busy=true; button.disabled=true; status.textContent='Searching…'; results.replaceChildren();
            void search(input.value,this.key(),transport).then(items => {
                if(this.closed) return;
                status.textContent=items.length ? `${items.length} results` : 'No results found. Try another query.';
                for (const item of items) {
                    const li=document.createElement('li'); const link=document.createElement('a');
                    link.textContent=item.title; link.href=item.url; link.target='_blank'; link.rel='noopener noreferrer';
                    li.append(link); results.append(li);
                }
            }).catch((error:unknown) => {
                if(!this.closed) status.textContent=error instanceof SearchError ? error.message : 'Search failed. Try again.';
            }).finally(() => {this.busy=false; if(!this.closed) button.disabled=false;});
        });
    }
    onClose() {this.closed=true; this.contentEl.replaceChildren(); this.finished();}
}
