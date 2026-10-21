export function createSheetClient({url, token, fetchImpl = fetch} = {}) {
    if (!url && !token) return null;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url || '') ||
        typeof token !== 'string' || token.length < 8 || token.length > 200) throw new Error('INVALID_SHEET_CONFIG');
    const call = async payload => {
        const signal = AbortSignal.timeout(15000);
        let response = await fetchImpl(url, {method: 'POST', redirect: 'manual', signal,
            headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token, ...payload})});
        // ContentService 的一次性回應網址只以 GET 取得；共享密鑰不跟轉址傳送。
        if ([301, 302, 303].includes(response.status)) {
            const location = new URL(response.headers.get('location'), url);
            if (location.protocol !== 'https:' || location.hostname !== 'script.googleusercontent.com' ||
                location.username || location.password) throw new Error('INVALID_SHEET_REDIRECT');
            response = await fetchImpl(location.href, {method: 'GET', redirect: 'error', signal});
        }
        if (!response.ok) throw new Error('SHEET_HTTP_ERROR');
        const body = await response.text();
        if (body.length > 16000000) throw new Error('SHEET_RESPONSE_TOO_LARGE');
        let result;
        try { result = JSON.parse(body); } catch { throw new Error('SHEET_INVALID_RESPONSE'); }
        if (result?.ok !== true) throw new Error('SHEET_REJECTED');
        return result;
    };
    return {append: async record => {
        const result = await call({action: 'append', record});
        if (result.id !== record.id) throw new Error('SHEET_WRONG_RECEIPT');
    }, read: async offset => {
        const result = await call({action: 'read', offset});
        if (!Array.isArray(result.records) || result.records.length > 100 ||
            !Number.isSafeInteger(result.nextOffset) || result.nextOffset < offset || typeof result.more !== 'boolean' ||
            (result.more && result.nextOffset <= offset)) throw new Error('SHEET_INVALID_RESPONSE');
        return result;
    }};
}
