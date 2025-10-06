import { exportCollectionPath, attachments } from "ZoteroFunctions";

export type CiteKey = string;
export type CollectionPath = string;

export interface Reference {
    citekey: CiteKey;
    library: string;
}

export interface ItemAnnotationsData {
    reference: Reference;
    parentUri: string;
    annotations: Object;
    itemData: Object;
}

export type ItemAnnotationsMap = Map<CiteKey, ItemAnnotationsData>

export interface CollectionData {
    path: CollectionPath;
    library: string;
    bibliography: string[];
    data: Map<string, Object>;
    citations?: string[];
    error?: Error;
    annotationsMap: ItemAnnotationsMap
}

export type CollectionAnnotationsMap = Map<CollectionPath, ItemAnnotationsMap>


export async function processCollection(collectionPath:string):Promise<CollectionData>  {

    try {

        const libraryName = collectionPath.split("/")[0];

        let dataJson = await exportCollectionPath(collectionPath, "json");
        dataJson.map(item => item['id'] = item['citation-key'])

        const dataJsonMap:Map<string, Object> = new Map(dataJson.map(item => [item.id, item]));
        const citekeys = dataJson.map(item => item.id);
        const citekeysNotEmpty = citekeys.filter(item => item !== null && item !== undefined && item !== '');
        const citekeysUnique:Set<string> = new Set(citekeysNotEmpty)

        const collData:CollectionData = {'path': collectionPath, 'library': libraryName, 'bibliography': [...citekeysUnique], 'data': dataJsonMap, 'annotationsMap': new Map()};
        
        return collData;

    } catch (e) {
        console.error(e);
        return {'library': null, 'bibliography': [], 'data': [], 'error': e};
    }

};

export async function processCollectionAndCitations(collectionPath:string, fileTextContent:string):Promise<CollectionData>  {

    let refData:CollectionData = {'library': null, 'citations': [], 'bibliography': [], 'data': []};

    try {

        refData = await processCollection(collectionPath);

        const libraryName = refData.library;

        const citekeys = Array.from(refData.data.keys())
        
        const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

        let matches = fileTextContent.match(re)

        let matches_unique;
        
        if (matches){
            const matchesFiltered = matches
                        .map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ))
                        .flat(1)
                        .filter((item) => citekeys.includes(item));

            matches_unique = new Set(matchesFiltered)

        } else {
            matches_unique = new Set([])
        }
      
        refData['citations'] = [...matches_unique];
    
        return refData;

    } catch (e) {
        console.error(e);
        refData['error'] = e;
        return refData;
    }


};

export async function processAttachmentAnnotations(collectionData:CollectionData, bibliographyMode:Boolean=false):Promise<ItemAnnotationsMap> {

    const annotationsMap:ItemAnnotationsMap = new Map();

    const referenceEntries = bibliographyMode ? collectionData.bibliography : collectionData.citations;
    
    if (!referenceEntries){
        return annotationsMap;
    }

    for (const item of referenceEntries) {
        
      const itemData = collectionData.data.get(item);

      const itemAttachmentsAll = await attachments(item, collectionData.library)
      
      //const itemAttachmentsAll = itemData['attachments']
      
      const itemAttachmentsWithPath = itemAttachmentsAll.filter(attach => attach.path != false)

      if (itemAttachmentsWithPath.length){
        const linkAttachment = itemAttachmentsWithPath[0]['open'];

        let linkAnnotations;
        
        if ('annotations' in itemAttachmentsWithPath[0]){
            linkAnnotations = itemAttachmentsWithPath[0]['annotations'];
        }
        else{
            linkAnnotations = [];
        }

        const citekey:CiteKey = item;

        const reference:Reference = {citekey: citekey, library: collectionData.library}

        const data:ItemAnnotationsData = {reference: reference, parentUri: linkAttachment, annotations: linkAnnotations, itemData: itemData};

        annotationsMap.set(citekey, data)
        
      }

    }

    collectionData.annotationsMap = annotationsMap;

    return collectionData.annotationsMap;
    
}

export async function processCollectionAttachmentAnnotations(collectionData:CollectionData):Promise<ItemAnnotationsMap> {

    const annotationsMap:ItemAnnotationsMap = new Map();

    const referenceEntries = collectionData.bibliography;
    
    for (const item of referenceEntries) {
        
      const itemData = collectionData.data.get(item);

      const itemAttachmentsAll = await attachments(item, collectionData.library)
            
      const itemAttachmentsWithPath = itemAttachmentsAll.filter(attach => attach.path != false)

      if (itemAttachmentsWithPath.length){
        const linkAttachment = itemAttachmentsWithPath[0]['open'];

        let linkAnnotations;
        
        if ('annotations' in itemAttachmentsWithPath[0]){
            linkAnnotations = itemAttachmentsWithPath[0]['annotations'];
        }
        else{
            linkAnnotations = [];
        }

        const citekey:CiteKey = item;

        const reference:Reference = {citekey: citekey, library: collectionData.library}

        const data:ItemAnnotationsData = {reference: reference, parentUri: linkAttachment, annotations: linkAnnotations, itemData: itemData};

        annotationsMap.set(citekey, data)
        
      }

    }

    collectionData.annotationsMap = annotationsMap;

    return collectionData.annotationsMap;

}
