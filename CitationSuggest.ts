import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';

import {FrontMatterBibliographyString} from 'FrontMatter'
import {collectionCitekeysTitles} from 'ZoteroFunctions'

import DeepSitPlugin from 'main';

interface Suggestion {
	query: string;
	startIndex: number;
	label: string;
}


export class CitationSuggest extends EditorSuggest<Suggestion> {
	readonly app: App;
	private plugin: DeepSitPlugin;
	private justCompleted: boolean;
	private zotero_collection: string;

	constructor(app: App, plugin: DeepSitPlugin) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.justCompleted = false;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {

		if (this.justCompleted) {
			this.justCompleted = false;
			return null;
		}


        const triggerPhrase = '@';
        const startPos = this.context?.start || {
			line: cursor.line,
			ch: cursor.ch - triggerPhrase.length,
		};

		const lineToCursor = editor.getRange({line: startPos.line, ch: 0},
											  {line: startPos.line, ch: cursor.ch});

		if (lineToCursor.lastIndexOf("[") == -1) {
			return null;
		} else {
			if (lineToCursor.lastIndexOf("[") < lineToCursor.lastIndexOf("]")){
				return null;
			} else {
				// Do nothing
			};
		}

		const OpenBracketToCursor = lineToCursor.substring(lineToCursor.lastIndexOf("[")+1)

		const precedingChar = editor.getRange({line: startPos.line, ch: cursor.ch - 1},
											  {line: startPos.line, ch: cursor.ch});

		const followingChar = editor.getRange({line: startPos.line, ch: cursor.ch},
											  {line: startPos.line, ch: cursor.ch + 1});


		if (!OpenBracketToCursor.startsWith("@")) {
			return null;
		}

		if ((precedingChar == " ") || (precedingChar == ";")) {
			return null;
		}

		const LastAtSignToCursor = OpenBracketToCursor.substring(OpenBracketToCursor.lastIndexOf("@")+1)

		const LastAtSignLinePos = lineToCursor.lastIndexOf("@");

		const queryStartPos = this.context?.start || {
			line: cursor.line,
			ch: LastAtSignLinePos,
		};

		const noteFile = file;
		const frontMatter = this.app.metadataCache.getFileCache(noteFile)?.frontmatter;

		if (frontMatter){

			this.zotero_collection = frontMatter[FrontMatterBibliographyString]
	
			const query = LastAtSignToCursor;
	
			return {
				start: queryStartPos,
				end: cursor,
				query: query,
				};

		}

    }

	async getSuggestions(context: EditorSuggestContext): Suggestion[] {

		const suggestions = await collectionCitekeysTitles(this.zotero_collection)

        if (suggestions.length) {
            return suggestions.filter(
						(item) => item['id'].startsWith(context.query)
					);
        }

        // catch-all if there are no matches
        return [{ label: context.query }];
    }

	renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
		el.setText('@' + suggestion['id']);
		el.appendChild(document.createElement('br'));
		el.appendText(suggestion['title']);
	}

	selectSuggestion(suggestion: Suggestion, event: KeyboardEvent | MouseEvent): void {

		if (this.context){

			const { editor } = this.context;

			const precedingChar = editor.getRange({line: this.context.start.line, ch: this.context.start.ch - 1},
												  {line: this.context.start.line, ch: this.context.start.ch});
	
			const followingChar = editor.getRange({line: this.context.start.line, ch: this.context.end.ch},
												  {line: this.context.start.line, ch: this.context.end.ch + 1});
	
	
			const suggStr = '@' + suggestion.id ;
	
			let cursorEndPos = null;
	
			if (followingChar == ']'){
				cursorEndPos = this.context.start.ch + suggStr.length + 1
			} else {
				cursorEndPos = this.context.start.ch + suggStr.length
			}
	
			editor.replaceRange(suggStr, this.context.start, {'line': this.context.end.line, 'ch': this.context.end.ch });
	
			editor.setCursor({'line': this.context.start.line, 'ch': cursorEndPos})
	
			this.justCompleted = true;
	
		}

	}

}
