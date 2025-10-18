
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
import { FrontMatterBibliographyString } from 'FrontMatter';
import { editorEditorField, editorLivePreviewField, getFrontMatterInfo, FrontMatterInfo, parseFrontMatterEntry } from 'obsidian';
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
    
    return currentValue; // No relevant effect, return previous state

  },
  provide(field: StateField<DecorationSet>): Extension {
    return EditorView.decorations.from(field);
  },

});




class ReferencesRendererPlugin implements PluginValue {
  constructor(readonly view: EditorView) {
    const stateFieldValue = view.state.field(ReferencesStateField);
  }

  async update(update: ViewUpdate) {

    if (update.docChanged) {

        const stateFieldValue = update.state.field(ReferencesStateField);

        const doc = update.state.doc;

        const currentDocText = doc.toString();
        
        const refIndex =  currentDocText.indexOf(`::: {#refs}\n:::`);
        
        if (refIndex === -1){
            return;
        }

        const fmInfo:FrontMatterInfo = getFrontMatterInfo(currentDocText);
        const currentDocTextNoFrontMatter = doc.sliceString(fmInfo.contentStart);

        const citeKeys:string[] = citationsInText(currentDocTextNoFrontMatter);

        let frontmatterKeys:string[] = []
        let frontmatterValues:string[] = []

        const tree = syntaxTree(update.state);

        tree.iterate({
            enter(node) {

                const nodeText = doc.sliceString(node.from, node.to);

                if (node.name === "atom_hmd-frontmatter"){
                    frontmatterKeys.push(nodeText);
                }
                if (node.name === "hmd-frontmatter"){
                    frontmatterValues.push(nodeText);
                }
            }
        });

        var frontmatterObject = Object.fromEntries(frontmatterKeys.map((key, index) => [key, frontmatterValues[index]]));

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
    // Cleanup if needed
  }
}

export const ReferencesRendererViewPlugin = ViewPlugin.fromClass(ReferencesRendererPlugin)
