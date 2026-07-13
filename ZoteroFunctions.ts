import {requestUrl, RequestUrlParam} from 'obsidian';

const defaultHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'obsidian/zotero',
    'Accept': 'application/json',
    'Connection': 'keep-alive',
};

const baseOptions = {
    url: 'http://localhost:23119/better-bibtex/json-rpc',
    hostname: 'localhost',
    port: 23119,
    path: '/better-bibtex/json-rpc',
    method: 'POST',
    contentType: 'application/json',
    headers: defaultHeaders
};

async function makeJsonRpcHttpRequest(options:typeof baseOptions, dataStr:string) {
    const body = {'body': dataStr}
    const requestOptions = Object.assign({ ...options }, body)
    const req = await requestUrl(requestOptions);
    const reqJson = req.json;
    if (reqJson['result'][0] == '200' && reqJson['result'][1] == 'text/plain'){
        const resultStr = reqJson.result[2];
	    const resultJson = JSON.parse(resultStr);
        return resultJson
    } else if ('jsonrpc' in reqJson && req.status == 200){
        const resultJson = reqJson['result'];
        return resultJson
    };
}


async function makeHttpRequest(options, data) {
    const body = {'body': data}
    const requestOptions = Object.assign({ ...options }, body)
    const req = await requestUrl(requestOptions);
    return req.text;
}


export async function locateCollection(collectionPath:string) {
    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "user.groups",
        params: [true]
    };

    const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

    const plist = collectionPath.split("/");
    const lib = plist[0];
    const after = plist.slice(1);

    const libNames = result.map(l => l.name);
    const libIds = result.map(l => l.id);

    const matchedLib = result[libNames.indexOf(lib)];
    const matchedLibId = libIds[libNames.indexOf(lib)];

    const allCollections = matchedLib.collections;
    const allCollectionsDict = {};
    allCollections.forEach(c => {
        allCollectionsDict[c.key] = { ...c, children: [] };
    });

    const topCollections = allCollections.filter(c => !c.parentCollection);
    const topCollectionsDict = {};
    topCollections.forEach(c => {
        topCollectionsDict[c.key] = { ...c, children: [] };
    });

    const nonTopCollections = matchedLib.collections.filter(c => c.parentCollection !== false);

    for (const coll of nonTopCollections) {
        if (coll.parentCollection in topCollectionsDict) {
            topCollectionsDict[coll.parentCollection].children.push(coll);
        }
    }

    const matchedTopCollection = topCollections.find(c => c.name === after[0]);
    const matchedTopCollectionKey = matchedTopCollection.key;


    let children = Object.values(allCollectionsDict).filter(c => c.parentCollection === matchedTopCollectionKey);
    let matchedChildCollectionKey = matchedTopCollectionKey;
      
    for (const cname of after.slice(1)) {
        if (matchedChildCollectionKey) {
            children = Object.values(allCollectionsDict).filter(c => c.parentCollection === matchedChildCollectionKey);

            children.forEach(() => {
        	    matchedChildCollectionKey = children.find(obj => { return obj.name === cname})?.key;
            });

        } else {
            return { libraryId: null, collectionId: null };
        }

    }

    return { libraryId: matchedLibId, collectionId: matchedChildCollectionKey };

}


export async function exportCollection(collectionId:string, libraryId:string, bibFormat:string = 'betterbibtex') {

	const url_path = `/better-bibtex/collection?/${libraryId}/${collectionId}.${bibFormat}`;

    const url = `http://127.0.0.1:23119/better-bibtex/collection?/${libraryId}/${collectionId}.${bibFormat}&exportNotes=true`;
    
    console.log(url)

	const options: RequestUrlParam = {
        url: url,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
            'Zotero-Allowed-Request': '1'
			},
	};

    try { 
        
        const response = await requestUrl(options)

        if (typeof response.text === 'string') {
            try {
                return JSON.parse(response.text);
            } catch {
                return response.text; // Return the raw text if it's not json (e.g. a BibTeX file string)
            }
        }
        
        return response.json;

    }
    catch (error) {
        if (error.message === 'Request failed, status 404'){
            throw Error("Unable to find Zotero collection.")
        }
        throw error;
    }


}

export async function bibliography(citeKeys:string[], library:string='', style:string, contentType:string='text', quickCopy:boolean=false) {
    
    const format = {
                    contentType: contentType, // can be 'html'
                    locale: '',
                    id: style,
                    quickCopy: quickCopy,
                    }

    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "item.bibliography",
        params: [citeKeys, format, library]
    };

    const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

    return result;

}


export async function exportItems(citeKeys:string[], libraryID:string, translator:string="json") {

    try { 
        
        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.export",
            params: [citeKeys, translator, libraryID]
        };
    
        let result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));
        
        if (typeof(result) === 'string') {
            result = JSON.parse(result);
        } else {
            /* result = result; */ // no changes
        };

        return result;

    }
    catch (error) {
        console.error('Error:', error);
        throw error;
    }
        
}

export async function exportItemsNonJSON(citeKeys:string[], libraryID:string, translator:string="yaml") {

    try { 
        
        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.export",
            params: [citeKeys, translator, libraryID]
        };
    
        let result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));
        
        return result;

    }
    catch (error) {
        console.error('Error:', error);
        throw error;
    }
        
}

export async function attachments(citeKey:string, library:string) {
    try {

        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.attachments",
            params: [citeKey, library]
        };

        const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

        return result;
	
    } catch (error) {
        console.error(`Error generating attachments for citation key: ${citeKey}`)
        throw error;
    }

}

export async function pandocFilter(citekeys:string[], asCSL:boolean, libraryID:string, style, locale){

    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "item.pandoc_filter",
        params: [citekeys, asCSL, libraryID, style]
    };

    const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

    return result;

}


export async function exportCollectionPath(collectionPath:string, bibFormat = 'betterbibtex') {

    const coll = await locateCollection(collectionPath)
    const exported_collection = await exportCollection(coll.collectionId, coll.libraryId, bibFormat);
    return exported_collection;

}


export async function collectionCitekeys(collectionPath:string) {

    const resultJson = await exportCollectionPath(collectionPath, "json");
    return resultJson.map(item => item.id);

}


export async function collectionCitekeysTitles(collectionPath:string) {

    const resultJson = await exportCollectionPath(collectionPath, "json");
    const result_keys_title = resultJson.map(item => {return {'id': item.id, 'title': item.title} });
    return result_keys_title;

}
