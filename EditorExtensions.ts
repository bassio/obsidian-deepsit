
import { syntaxTree } from '@codemirror/language';
import {
  Extension,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { SearchCursor } from '@codemirror/search';

import { FrontMatterBibliographyString } from 'FrontMatter';
import { editorEditorField, editorLivePreviewField, getFrontMatterInfo, FrontMatterInfo, parseYaml } from 'obsidian';
import { citationsInText } from 'ReferenceProcessing';
import { bibliography, bibliographySync } from 'ZoteroFunctions';

interface ReferencesDisplayData {
    citeKeys:string[];
    library:string;
    style:string;
    contentType:string;
    references:string;
    posFrom:number;
    posTo:number;
}

const EmptyReferencesDisplayData:ReferencesDisplayData = {
    citeKeys: [],
    library: '',
    style: '',
    contentType: 'text',
    references: '',
    posFrom: -1,
    posTo: -1
}

const asyncReferencesDisplayDataEffect = StateEffect.define<ReferencesDisplayData>();


// Define a custom widget
class ReferencesWidget extends WidgetType {
  data:ReferencesDisplayData

  constructor(data:ReferencesDisplayData) {
    super();
    this.data = data;
  }

  eq(other:ReferencesWidget) {
    return other.data == this.data;
  }

  destroy(dom: HTMLElement){
    dom.remove();
  }

  toDOM(view) {
    
    if (this.data == EmptyReferencesDisplayData) {
        const div = document.createElement("div");
        div.className = "references-widget";
        div.textContent = `::: {#refs}\n:::`;
        return div;
    } else {
        const div = document.createElement("div");
        div.className = "references-widget";
        if (this.data.contentType == 'text'){
          div.textContent = this.data.references;
        } else if (this.data.contentType == 'html'){
          div.innerHTML = this.data.references;
        }
        return div;
    }


  }

}

export const ReferencesStateField = StateField.define<DecorationSet>({
  create: () => {
    return Decoration.none;
  },
  update: (currentValue:DecorationSet, transaction:Transaction) => {

    const isSourceMode = !transaction.state.field(editorLivePreviewField);

    // No decorations if we're in source mode.
    if (isSourceMode) return Decoration.none;

    for (let effect of transaction.effects) {
      
      if (effect.is(asyncReferencesDisplayDataEffect)) {
        
        const builder = new RangeSetBuilder<Decoration>();
        
        const prevStateField = transaction.startState.field(ReferencesStateField);

        if (effect.value == EmptyReferencesDisplayData){

          return Decoration.none
          
        } else {
          
          builder.add(
              effect.value.posFrom,
              effect.value.posTo,
              Decoration.replace({
                  widget: new ReferencesWidget(effect.value),
                  block: true
              })
          )

          return builder.finish();

        }
        

      }

    }
    
    return currentValue; // No relevant effect, return previous state

  },
  provide(field: StateField<DecorationSet>): Extension {
    //return EditorView.decorations.from(field);
    return [EditorView.atomicRanges.of(view => view.state.field(field)),
            EditorView.decorations.from(field),
          ]
  },

});




class ReferencesRendererPlugin implements PluginValue {

  constructor(readonly view: EditorView) {
    const stateFieldValue = view.state.field(ReferencesStateField);
    this.dispatch(view);
  }

  async dispatch(view:EditorView){

    const doc = view.state.doc;

    const currentDocText = doc.toString();


    const cursor = new SearchCursor(doc, `::: {#refs}\n:::\n`, 0);

    const match = cursor.next();

    let refIndex:number;

    if (match.value.from == 0 || match.value.to == 0 || match.done == true){
      refIndex = -1;
    } else {
      //const refIndex =  currentDocText.indexOf(`::: {#refs}\n:::\n`);
      refIndex =  match.value.from;
    }
    
    if (refIndex === -1){
      //hack using setTimeout avoids the "Calls to EditorView.update are not allowed while an update is in progress"
      setTimeout(() => {
        view.dispatch({effects: asyncReferencesDisplayDataEffect.of(EmptyReferencesDisplayData),});
      }, 50);
      
      return
    }

    const fmInfo:FrontMatterInfo = getFrontMatterInfo(currentDocText);
    const currentDocTextNoFrontMatter = doc.sliceString(fmInfo.contentStart);

    const citeKeys:string[] = citationsInText(currentDocTextNoFrontMatter);

    const frontmatterObject = parseYaml(fmInfo.frontmatter);

    const bib:string = frontmatterObject[FrontMatterBibliographyString];
    const library = bib.split('/', 1)[0];
    const style:string = frontmatterObject["csl"];

    const references = await bibliography(citeKeys, library, style, 'text')
    
    const refData:ReferencesDisplayData = {
        citeKeys: citeKeys,
        library: library,
        style: style,
        contentType: 'text',
        references: references,
        posFrom: refIndex,
        posTo: refIndex+15
    };

    view.dispatch({
        effects: asyncReferencesDisplayDataEffect.of(refData),
    });

  }

  async update(update: ViewUpdate) {

    if (update.docChanged) {

        const doc = update.state.doc;

        const currentDocText = doc.toString();

        const cursor = new SearchCursor(doc, `::: {#refs}\n:::\n`, 0);

        const match = cursor.next();

        let refIndex:number;

        if (match.value.from == 0 || match.value.to == 0 || match.done == true){
          refIndex = -1;
        } else {
          //const refIndex =  currentDocText.indexOf(`::: {#refs}\n:::\n`);
          refIndex =  match.value.from;
        }

        
        if (refIndex === -1){
          //hack using setTimeout avoids the "Calls to EditorView.update are not allowed while an update is in progress"
          setTimeout(() => {
            update.view.dispatch({effects: asyncReferencesDisplayDataEffect.of(EmptyReferencesDisplayData),});
          }, 50);
          
          return
        }

        const fmInfo:FrontMatterInfo = getFrontMatterInfo(currentDocText);
        const currentDocTextNoFrontMatter = doc.sliceString(fmInfo.contentStart);

        const citeKeys:string[] = citationsInText(currentDocTextNoFrontMatter);

        const frontmatterObject = parseYaml(fmInfo.frontmatter);

        const bib:string = frontmatterObject[FrontMatterBibliographyString];
        const library = bib.split('/', 1)[0];
        const style:string = frontmatterObject["csl"];

        const references = await bibliography(citeKeys, library, style, 'text')
        
        const refData:ReferencesDisplayData = {
            citeKeys: citeKeys,
            library: library,
            style: style,
            contentType: 'text',
            references: references,
            posFrom: refIndex,
            posTo: refIndex+15
        };

        update.view.dispatch({
            effects: asyncReferencesDisplayDataEffect.of(refData),
        });
    }
  }

  destroy() {

  }
}

export const ReferencesRendererViewPlugin = ViewPlugin.fromClass(ReferencesRendererPlugin)
