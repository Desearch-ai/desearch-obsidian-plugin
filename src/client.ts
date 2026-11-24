export const ENDPOINT = 'https://mcp.desearch.ai/mcp';
const PROTOCOL = '2025-03-26';
export interface HttpRequest { url: string; method: string; headers: Record<string,string>; body?: string; }
export interface HttpResponse { status: number; headers: Record<string,string>; text: string; }
export type Transport = (request: HttpRequest) => Promise<HttpResponse>;
export interface SearchResult { title: string; url: string; }
export class SearchError extends Error {}
const record = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const header = (headers: Record<string,string>, name: string) => Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];

// Only this bounded, user-invoked search flow is supported; no server requests or subscriptions.
export function parseRpc(text: string, id: number): Record<string,unknown> {
    try {
        const messages: unknown[] = text.trimStart().startsWith('{') ? [JSON.parse(text)] : text.split(/\r?\n\r?\n/).flatMap(block => {
            const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
            return data ? [JSON.parse(data)] : [];
        });
        const message = messages.find(m => record(m) && m.id === id);
        if (!record(message) || message.jsonrpc !== '2.0') throw new Error();
        if ('error' in message) throw new SearchError('Desearch could not complete this request. Check your key and try again.');
        if (!record(message.result)) throw new Error();
        return message.result;
    } catch (error) {
        if (error instanceof SearchError) throw error;
        throw new SearchError('Desearch returned an unreadable response. Try again later.');
    }
}
export function parseResults(result: Record<string,unknown>): SearchResult[] {
    if (result.isError === true) throw new SearchError('Desearch rejected the search. Check your API key, balance, and service availability.');
    let data: unknown = result.structuredContent;
    if (!record(data) && Array.isArray(result.content)) {
        try {
            const item = result.content.find(item => record(item) && item.type === 'text' && typeof item.text === 'string');
            data = record(item) && typeof item.text === 'string' ? JSON.parse(item.text) : undefined;
        } catch { /* Do not expose upstream content or credentials in errors. */ }
    }
    if (!record(data) || !Array.isArray(data.results)) throw new SearchError('Desearch returned an unexpected result format.');
    const valid: SearchResult[] = [];
    for (const item of data.results.slice(0,100)) {
        if (!record(item) || typeof item.title !== 'string' || !item.title.trim() || typeof item.url !== 'string') continue;
        try {
            const url = new URL(item.url);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
            valid.push({title:item.title.slice(0,500), url:url.href});
        } catch { /* Invalid links are omitted. */ }
    }
    return valid;
}
export async function search(query: string, key: string, transport: Transport): Promise<SearchResult[]> {
    if (!key.trim()) throw new SearchError('Add your Desearch API key in settings for this session.');
    if (!query.trim()) throw new SearchError('Enter a search query.');
    if (query.length > 2000) throw new SearchError('Keep the query under 2,001 characters.');
    let session: string | undefined;
    let protocol = PROTOCOL;
    async function send(body: Record<string,unknown>, id?: number): Promise<Record<string,unknown>> {
        const headers: Record<string,string> = {'Content-Type':'application/json',Accept:'application/json, text/event-stream','x-api-key':key.trim()};
        if (session) headers['Mcp-Session-Id'] = session;
        if (body.method !== 'initialize') headers['MCP-Protocol-Version'] = protocol;
        let response: HttpResponse;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            response = await Promise.race([transport({url:ENDPOINT,method:'POST',headers,body:JSON.stringify(body)}), new Promise<never>((_,reject) => {timer=setTimeout(() => reject(new SearchError('Search timed out. Try again.')),30000);})]);
        } catch(error) {
            if (error instanceof SearchError) throw error;
            throw new SearchError('Cannot reach Desearch. Check your connection and try again.');
        } finally { clearTimeout(timer); }
        if (response.status === 401 || response.status === 403) throw new SearchError('Desearch rejected your API key. Update it in settings.');
        if (response.status === 429) throw new SearchError('Desearch is rate limited. Wait before trying again.');
        if (response.status < 200 || response.status >= 300) throw new SearchError('Desearch is unavailable. Try again later.');
        if (body.method === 'initialize') session = header(response.headers,'mcp-session-id');
        return id === undefined ? {} : parseRpc(response.text,id);
    }
    const initialized = await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'desearch-obsidian',version:'0.1.0'}}},1);
    if (typeof initialized.protocolVersion !== 'string' || !['2025-03-26','2025-06-18'].includes(initialized.protocolVersion)) throw new SearchError('Desearch uses an unsupported protocol version.');
    protocol = initialized.protocolVersion;
    await send({jsonrpc:'2.0',method:'notifications/initialized'});
    // Sessions are scoped to one search; the deployed service is stateless. Never retry a tools/call automatically.
    return parseResults(await send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'search',arguments:{query:query.trim()}}},2));
}
