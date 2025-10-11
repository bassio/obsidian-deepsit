
const fs = require('fs');

import { App, ItemView, MarkdownView, WorkspaceLeaf, Modal, Notice, setIcon, normalizePath, TFile } from 'obsidian';

import BibcitePlugin from 'main';

import {FrontMatterBibliographyString} from "FrontMatter"
import { exportItems, exportItemsNonJSON } from 'ZoteroFunctions';
import { ItemAnnotationsData, CollectionData, processCollection, processAttachmentAnnotations, processCollectionAndCitations, processCollectionAttachmentAnnotations, ItemAnnotationsMap, CollectionAnnotationsMap } from "ReferenceProcessing";


export const ReferencesViewType = 'ReferencesView';



export class ReferencesView extends ItemView {
  plugin: BibcitePlugin;
  activeMarkdownLeaf: MarkdownView;
  references: [];
  private _fileCollectionData: Map<string, CollectionData>;
  collectionAnnotationData: CollectionAnnotationsMap;
  loadingSpinnerAsset:string;
  private _activeViewMode:string

  constructor(leaf: WorkspaceLeaf, plugin: BibcitePlugin) {
    super(leaf);
    this.plugin = plugin;
    this._fileCollectionData = new Map()
    this.collectionAnnotationData = new Map()
    this.contentEl.addClass('bibcite-references');
    this.setEmptyView(this.plugin.settings.defaultViewMode == 'bibliography' ? true : false);
    this.addAction("refresh-cw", "Refresh References", () => {
      this.refreshReferences();
    })
    
    const vault = this.plugin.app.vault;
    const adapter = vault.adapter;
    const assetFileName = "spinner.svg";

    const path = require('path')
    const assetPath = normalizePath(path.join(this.plugin.manifest.dir, assetFileName));
    
    this.loadingSpinnerAsset = adapter.getResourcePath(assetPath);
    
  }

  get activeFilePath():string {
    return this.plugin.activeFilePath;
  }

  get activeFileCollectionData():CollectionData | undefined {
    return this._fileCollectionData.get(this.activeFilePath);
  }

	get activeViewMode():string {
    return this._activeViewMode;
  }
  set activeViewMode(v:string) {
    this._activeViewMode = v;
  }

  async setHeader(header: HTMLElement, bibliographyMode=false, annotationsView=false){

    const mode = bibliographyMode ? 'Bibliography' : 'References' 
    const oppositeMode = bibliographyMode ? 'References' : 'Bibliography'
    
    let headerText;

    if (!annotationsView){
      headerText = header.createEl("span", { text: mode, cls: "references-header-text" });
    } else {
      headerText = header.createEl("span", { text: 'Annotations', cls: "references-header-text" });
    }
    
    const refreshButton = header.createEl("button", { text: "Refresh", cls: "refresh-button" , title: "Refresh"});
    setIcon(refreshButton, "refresh-cw");

    const modeButton = header.createEl("button", { text: "Switch References/Bibliography Mode", cls: "mode-button", title: `Switch to ${oppositeMode} mode` });
    setIcon(modeButton, "book-copy");

    const annotationsButton = header.createEl("button", { text: `${mode} Annotations`, cls: "annotations-button", title: `Annotations` });
    setIcon(annotationsButton, "book-open-text");
    annotationsButton.onclick = async (e) => {
      const annotationsMode = this.getAnnotationsViewMode();

      if (annotationsMode == 'modal') {
        const attachmentAnnotationsMap = await processAttachmentAnnotations(this.activeFileCollectionData, bibliographyMode);
        const attachmentAnnotations = Array.from(attachmentAnnotationsMap.values())
        new MultiAnnotationsModal(this.app, attachmentAnnotations).open();  
      }
      else if (annotationsMode == 'viewpane') {
        this.renderAnnotations(bibliographyMode);
      }
    };


    if (!bibliographyMode){
      refreshButton.onclick = async (e) => {
        await this.refreshReferences();
        this.renderReferences();
      }
      modeButton.onclick = (e) => {
        this.renderBibliography();
      }
    } else {
      refreshButton.onclick = async (e) => {
        await this.refreshReferences();
        this.renderBibliography();
        this.refreshAttachmentsAnnotations();
      }
      modeButton.onclick = (e) => {
        this.renderReferences();
      }
    }


  }

  async setViewContent(content: HTMLElement, bibliographyMode=false, annotationsView=false) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    await this.setHeader(header, bibliographyMode, annotationsView);

    if (!content) {
      await this.setEmptyView();
    } else {
      this.contentEl.append(content);
    }
  }

  async setErrorView(error) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});
    const headerText = header.createEl("span", { text: "References", cls: "references-header-text" });
    const refreshButton = header.createEl("button", { text: "Refresh", cls: "refresh-button" });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.onclick = async (e) => {
      await this.refreshReferences();
      this.renderReferences();
    }

    if (error.message == 'net::ERR_CONNECTION_REFUSED'){
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'Unable to connect to Zotero. Is Zotero running?',
      });
    } else {
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: error.message,
      });
    }
  }

  async setEmptyView(bibliographyMode=false) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    await this.setHeader(header, bibliographyMode);

    if (!bibliographyMode){
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'No citations found in the current document.',
      });
    } else {
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'No bibliography entries found for the current document.',
      });
    }

  }

  async setLoadingView() {

    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    await this.setHeader(header, false);

    const emptyDiv = containerDiv.createDiv({
      cls: 'pane-empty',
      text: containerDiv.createEl("img", { attr: { src: this.loadingSpinnerAsset }})
    });


  }

  getDefaultReferencesViewMode() {
    return this.plugin.settings.defaultViewMode;
  }
  getAnnotationsViewMode() {
    return this.plugin.settings.defaultAnnotationsMode;
  }

  getViewType() {
    return ReferencesViewType;
  }

  getDisplayText() {
    return 'References';
  }

  getIcon() {
    return 'graduation-cap';
  }

  async refresh(){

    await this.refreshReferences();
    await this.refreshAttachmentsAnnotations();

  }

  async refreshReferences() {

    let refs;

		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile) {

			try {

				const fileContent = await this.plugin.app.vault.cachedRead(activeFile);
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
		    const frontMatter = cache.frontmatter;

        if (!frontMatter || !Object.hasOwn(frontMatter, FrontMatterBibliographyString)){
          const refs:CollectionData = {library: null, citations: [], bibliography: [], data: []};
          return refs;
        }
        
        const collectionPath = frontMatter[FrontMatterBibliographyString];

        let collectionDataForFile:CollectionData

        collectionDataForFile = await processCollectionAndCitations(collectionPath, fileContent);

        this._fileCollectionData.set(activeFile.path, collectionDataForFile);

        return collectionDataForFile;

			} catch (e) {
				console.error(e);
				refs = {'library': null, 'citations': [], 'bibliography': [], 'data': [], 'error': e};
        return refs;
			}

		};

	};

  async exportReferences(format:string='yaml'){
    const jsonExport = await exportItems(this.activeFileCollectionData?.citations, this.activeFileCollectionData?.library, 'json');    

    const file = this.plugin.app.workspace.getActiveFile();

    if (file){
      this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter.references = jsonExport;
      });
    }

    return jsonExport;
    
  }

  async processReferences() {

    let refs;

		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile) {

			try {

        let collectionDataForFile:CollectionData | undefined

        collectionDataForFile = this._fileCollectionData.get(activeFile.path)

        if (collectionDataForFile){
          return collectionDataForFile;
        }

				const fileContent = await this.plugin.app.vault.cachedRead(activeFile);
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
		    const frontMatter = cache.frontmatter;

        if (!frontMatter || !Object.hasOwn(frontMatter, FrontMatterBibliographyString)){
          const refs:CollectionData = {library: null, citations: [], bibliography: [], data: []};
          return refs;
        }
        
        const collectionPath = frontMatter[FrontMatterBibliographyString];

        collectionDataForFile = await processCollectionAndCitations(collectionPath, fileContent);

        this._fileCollectionData.set(activeFile.path, collectionDataForFile)

        return collectionDataForFile;

			} catch (e) {
				console.error(e);
				refs = {'library': null, 'citations': [], 'bibliography': [], 'data': [], 'error': e};
        return refs;
			}

		} else {
			refs = {'library': null, 'citations': [], 'bibliography': [], 'data': [], };
      return refs;

		};

	};

  async renderReferences() {

    this.setLoadingView();

    const refs = await this.processReferences();
    
    if (!refs.citations || refs.citations.length ==0){
      if ('error' in refs) {
        this.setErrorView(refs.error);
      } else {
        await this.setEmptyView();
      };
      return
    }

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');
    
    let itemsDiv:string = ``;

    for (const item of refs.citations) {

      const itemData = refs.data.get(item);

      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']

      let issueDate;

      try{

        if ('date-parts' in itemData['issued']){
          issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : '';
        } else if ('literal' in itemData['issued']){
          issueDate = itemData['issued']['literal'].split(" ")[0];
        }
        
      }
      catch {
        issueDate = "____";
      }


      itemsDiv += `<div class='reference-div'>
                    <div class="reference-citekey" data-citekey="${itemData['id']}">@${itemData['id']}</div>
                    <div class="reference-title"><a data-citekey="${itemData['id']}" href='#0'>${itemData['title']}</a></div>
                    <div class="reference-journal">${journal} ${issueDate}</div>
                  </div>`;
      
    }
  
    const itemsDivNode = new DOMParser().parseFromString(itemsDiv, 'text/html');
    Array.from(itemsDivNode.body.children).forEach(element => {
      containerDiv.appendChild(element);
    });  

    this.setViewContent(containerDiv, false); // bibliographyMode=false

    this.renderAttachments(refs, 'references');

  };

  async renderBibliography() {

    this.setLoadingView();

    const refs = await this.processReferences();
    
    if (!refs.bibliography || refs.bibliography.length ==0){
      if ('error' in refs) {
        await this.setErrorView(refs.error);
      } else {
        await this.setEmptyView(true);
      };
      return
    }

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');
    
    let itemsDiv:string = ``;

    for (const item of refs.bibliography) {

      const itemData = refs.data.get(item);

      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']

      let issueDate;

      try{

        if ('date-parts' in itemData['issued']){
          issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : '';
        } else if ('literal' in itemData['issued']){
          issueDate = itemData['issued']['literal'].split(" ")[0];
        }
        
      }
      catch {
        issueDate = "____";
      }


      itemsDiv += `<div class='reference-div'>
                    <div class="reference-citekey" data-citekey="${itemData['id']}">@${itemData['id']}</div>
                    <div class="reference-title"><a data-citekey="${itemData['id']}" href='#0'>${itemData['title']}</a></div>
                    <div class="reference-journal">${journal} ${issueDate}</div>
                  </div>`;

    }
  
    const itemsDivNode = new DOMParser().parseFromString(itemsDiv, 'text/html');
    Array.from(itemsDivNode.body.children).forEach(element => {
      containerDiv.appendChild(element);
    });

    this.setViewContent(containerDiv, true); // bibliographyMode=true

    this.renderAttachments(refs, 'bibliography');
  
  }

  async renderAnnotations(bibliographyMode) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('annotations-leaf-div');

    const attachmentAnnotationsMap = await processAttachmentAnnotations(this.activeFileCollectionData, bibliographyMode);
    const attachmentAnnotations = Array.from(attachmentAnnotationsMap.values())

    const fragment = new MultiAnnotationsModal(this.app, attachmentAnnotations).processContent();

    containerDiv.appendChild(fragment);

    this.setViewContent(containerDiv, !bibliographyMode, true);
    
  };

  async refreshAttachmentsAnnotations():Promise<ItemAnnotationsMap> {

    let itemAnnotations:ItemAnnotationsMap | undefined;
    
    const collectionData = this.activeFileCollectionData;

    if (collectionData){
      itemAnnotations = await processCollectionAttachmentAnnotations(collectionData)
      this.collectionAnnotationData.set(collectionData.path, itemAnnotations)
      return itemAnnotations;
    }
    else {
      return new Map() //empty
    }

  }

  async processAttachmentsAnnotations(collectionData:CollectionData):Promise<ItemAnnotationsMap> {

    let itemAnnotations:ItemAnnotationsMap | undefined;
    
    itemAnnotations = this.collectionAnnotationData.get(collectionData.path);

    if (!itemAnnotations){
      itemAnnotations = await processCollectionAttachmentAnnotations(collectionData)
      this.collectionAnnotationData.set(collectionData.path, itemAnnotations)
    }

    return itemAnnotations;

  }

  async renderAttachments(collectionData:CollectionData, bibliographyModeString:String) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');

    let referenceEntries;
    let bibliographyMode;

    if (bibliographyModeString == 'references'){
      referenceEntries = collectionData.citations;
      bibliographyMode = false;
    } else {
      referenceEntries = collectionData.bibliography;
      bibliographyMode = true;
    }

    const itemAnnotations:ItemAnnotationsMap = await this.processAttachmentsAnnotations(collectionData);

    for (const [citekey, annotationsData] of itemAnnotations) {

      const linkDomElement = this.contentEl.querySelector(`.reference-div .reference-title a[data-citekey='${annotationsData.reference.citekey}']`);
      linkDomElement?.setAttribute('href', annotationsData.parentUri);

      if (annotationsData.annotations.length){


        const citeKeyDomElement = this.contentEl.querySelector(`.reference-div .reference-citekey[data-citekey='${annotationsData.reference.citekey}']`);

        let annotationsIcon = document.createElement("span");
        annotationsIcon.addClass("annotations-icon");
        annotationsIcon.setAttribute("title", "Review Annotations");
        setIcon(annotationsIcon, "book-open-text");
        annotationsIcon.onclick = (e) => {
          new AnnotationsModal(this.app, annotationsData).open();
        };
        
        citeKeyDomElement?.appendChild(annotationsIcon);
        
      }

    }

  };

}


export class AnnotationsModal extends Modal {
  private _citekey: string;
  private _parentUri: string;
  private _annotations: Object;

  constructor(app: App, private annotationData: ItemAnnotationsData) {
    super(app);
    this._citekey = annotationData.reference.citekey;
    this._parentUri = annotationData.parentUri;
    this._annotations = annotationData.annotations;
    this._data = annotationData.itemData;
  }

  onOpen() {
    this.renderContent();
  }

  onClose() {
    this.contentEl.empty();
  }

  onSelectReference = (citekey: string) => {
    this.contentEl.empty();
    this.renderContent();
  };

  processContent() {
    const citekey = this._citekey;
    const itemData = this._data;
    const fragment = document.createDocumentFragment();

    fragment.createEl("div", { text: `Annotations of @${citekey}`, cls: 'item-annotations-header' });
    fragment.createEl("div", { text: `${itemData.title}`, cls: 'item-annotations-header-item-title'  });

    for (const annotation of this._annotations) {
      this.renderAnnotation(fragment, annotation);
    }

    return fragment;

  }

  renderContent() {
    
    const fragment = document.createDocumentFragment();

    const containerDiv = fragment.createEl('div');
    containerDiv.classList.add('annotations-div');
    
    const contentFragment = this.processContent();
    
    containerDiv.appendChild(contentFragment)

    this.contentEl.appendChild(fragment);
  
  }

  renderEmptyContent(fragment: DocumentFragment) {
    fragment.createEl("p", "There are no annotations associated with this reference.");
  }

  renderAnnotation(fragment: DocumentFragment, annotation: Object){
    const annotationDiv = fragment.createDiv({cls: ["annotation-div", `annotation-${annotation.annotationType}`] });

    if (annotation['annotationType'] == 'highlight'){
      const annotationSpan = annotationDiv.createEl("span", {text: annotation.annotationText});

      annotationSpan.title = annotation['annotationComment'] //tooltip

      const highlightColour = `${annotation['annotationColor']}`.slice(1); //remove the initial '#' in the hex colour
      annotationSpan.className = `highlight-${highlightColour}`;

      const annotationUri = this._parentUri + `?annotation=${annotation['key']}`
      let linkButton = annotationDiv.createEl("a", {cls: "annotation-link-icon", title: "Open in Zotero"});
      linkButton.href = annotationUri;
      setIcon(linkButton, "external-link");
      let copyButton = annotationDiv.createEl("a", {cls: "annotation-copy-icon", title: "Copy to clipboard"});
      setIcon(copyButton, "clipboard-copy");
      copyButton.onclick = (e) => {
        navigator.clipboard.writeText(`${annotation['annotationText']}[@${this._citekey}]\n[Link](${annotationUri})\n`);
        new Notice('Annotation copied to clipboard!', 1000);
        this.close();
      }

    }
    else if (annotation.annotationType == 'image'){
      const annotationImage = annotationDiv.createEl("img", {cls: "annotation-img"});
      const pth = annotation.annotationImagePath;
      const _img = "data:image/png;base64," + fs.readFileSync(pth).toString('base64');
      annotationImage.src = _img;
      const annotationSpan = annotationDiv.createEl("span", {text: annotation.annotationComment});
      let linkButton = annotationSpan.createEl("a", {cls: "annotation-link-icon", title: "Open in Zotero"});
      const annotationUri = this._parentUri + `?annotation=${annotation.key}`
      linkButton.href = annotationUri;
      setIcon(linkButton, "external-link");
      
    }
  }
}


export class MultiAnnotationsModal extends Modal {
  private _data: ItemAnnotationsData[];

  constructor(app: App, private annotationData: ItemAnnotationsData[]) {
    super(app);
    this._data = annotationData.filter((item:ItemAnnotationsData) => item.annotations.length); //only these that have annotations
  }

  onOpen() {
    this.renderContent();
  }

  onClose() {
    this.contentEl.empty();
  }

  onSelectReference = (citekey: string) => {
    this.contentEl.empty();
    this.renderContent();
  };

  getCitekeys() {
    const citekeys = this._data.map((item) => item['citekey']);
    return citekeys;
  }
  
  processContent() {
    const fragment = document.createDocumentFragment();

    const containerDiv = fragment.createEl('div');
    containerDiv.classList.add('annotations-div');

    for (const data of this._data) {
      const modal = new AnnotationsModal(this.app, data);
      const annotationFragment = modal.processContent();
      containerDiv.appendChild(annotationFragment)
    }
    
    return fragment;

  }

  renderContent() {
    const fragment = this.processContent();
    this.contentEl.appendChild(fragment);
  }

  private renderEmptyContent(fragment: DocumentFragment) {
    fragment.createEl("p", "No annotations found for this set of references.");
  }

}