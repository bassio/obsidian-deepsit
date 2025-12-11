import { App, Plugin, PluginSettingTab, requireApiVersion, Setting, TFile, WorkspaceLeaf } from 'obsidian';


import { CitationSuggest } from "CitationSuggest";
import { ReferencesView, ReferencesViewType } from 'ReferencesView';
import { FrontMatterBibliographyString } from 'FrontMatter';
import {ReferencesRendererViewPlugin, ReferencesStateField} from 'EditorExtensions'

interface DeepSitPluginSettings {
	defaultViewMode: string;
	defaultAnnotationsMode: string;
}

const DEFAULT_SETTINGS:DeepSitPluginSettings = {
	defaultViewMode: 'references',
	defaultAnnotationsMode: 'viewpane'
}


class DeepSitSettingTab extends PluginSettingTab {
	plugin: DeepSitPlugin;

	constructor(app: App, plugin: DeepSitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		const referencesViewModeDesc = `The default view mode for the References view. Options include "References mode" (default) and "Bibliography mode".`;

		new Setting(containerEl)
			.setName('References: default view mode')
			.setDesc(`${referencesViewModeDesc}`)
			.addDropdown((dropdown) => {
				dropdown
				.addOption('references', "References mode")
				.addOption('bibliography', 'Bibliography mode')
				.setValue(this.plugin.settings.defaultViewMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultViewMode = value;
							await this.plugin.saveSettings();
			  				})
			});
		
		const annotationsViewModeDesc = `The default view mode for the Annotations. Options include "Modal" (default) and "View pane".`;

		new Setting(containerEl)
			.setName('Annotations: default view mode')
			.setDesc(`${annotationsViewModeDesc}`)
			.addDropdown((dropdown) => {
				dropdown
				.addOption('viewpane', 'View pane')
				.addOption('modal', "Modal")
				.setValue(this.plugin.settings.defaultAnnotationsMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultAnnotationsMode = value;
							await this.plugin.saveSettings();
							})
			});
			  
	}
	
}


export default class DeepSitPlugin extends Plugin {
	settings: DeepSitPluginSettings;
	_activeFilePath: string;

	get activeFilePath() {
        return this._activeFilePath;
    }
    async setActiveFilePath(path) {
        if (path != this._activeFilePath){
			this._activeFilePath = path;

			if (!path){
				this.view?.setEmptyView();
				return;
			}

			if (this.settings.defaultViewMode == 'references'){
				await this.view?.renderReferences();
			} else if (this.settings.defaultViewMode == 'bibliography'){
				await this.view?.renderBibliography();
			} else {
				await this.view?.renderReferences();
			}

		}
    }

	async onload() {

		await this.loadSettings();

		this.registerEditorSuggest(new CitationSuggest(this.app, this));
		
		this.registerView(ReferencesViewType,
						 (leaf: WorkspaceLeaf) => new ReferencesView(leaf, this)
						  );
		
		/*
		Removed below

		Comment from @Zachatoo:  This command should also reveal the leaf if it exists, to match how other Obsidian commands work.
		
		this.addCommand({
			id: 'show-references-view',
			name: 'Show references',
			callback: async () => {
				await this.initLeaf();
			},
		});

		*/

		this.registerEvent(this.app.workspace.on('file-open', async (file:TFile|null) => {
			
			//const activeFile = this.app.workspace.getActiveFile();
			
			if (!file){
				await this.setActiveFilePath("");
			} else {
				await this.setActiveFilePath(file.path);
			}

		}));

		this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
			menu.addItem(item => {
							item.setTitle('Referencing');
							item.setIcon('graduation-cap');

							const submenu = item.setSubmenu();

							submenu.addItem(subitem => {
								subitem.setTitle('Insert citation')
								.setIcon('brackets')
								.onClick(() => {
									editor.replaceSelection(`[@]`);
									const currentCursor = editor.getCursor()
									editor.setCursor({line: currentCursor.line, ch: currentCursor.ch - 1});
								});
							});

							submenu.addItem(subitem => {
								subitem.setTitle('Insert references')
								.setIcon('library-big')
								.onClick(() => editor.replaceSelection(`::: {#refs}\n:::\n`));
							});

						});
						
		}));

		this.registerEditorExtension([ReferencesStateField, ReferencesRendererViewPlugin]);
		
		this.registerMarkdownPostProcessor(async (element, context) => {
			
			if (element.className == 'el-p'){
				
				if (element.textContent == `::: {#refs}\n:::`){

					let leaves = this.app.workspace.getLeavesOfType('ReferencesView');

					for (let leaf of leaves) {
						if (requireApiVersion('1.7.2')) {
							await leaf.loadIfDeferred(); // Ensure view is fully loaded
						}
						// perform modifications here...
						if (leaf.view instanceof ReferencesView) {
							let view = leaf.view; // You now have your CustomView
							const refs = await view.processReferences();
							const library = context.frontmatter[FrontMatterBibliographyString].split('/', 1)[0];
							let style = context.frontmatter['csl'];
							if (!style){
								style = "vancouver";
							}
							const biblio:string = await view.generateBibliography(refs.citations, library, style, 'text')
							element.innerText = biblio;
							element.className = "deepsit-references-reading";
						}

					}
					
				}
			}

    	});


		this.addSettingTab(new DeepSitSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.initLeaf();

		});

	}

	onunload() {
		this.app.workspace.getLeavesOfType(ReferencesViewType)
		.forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	get view() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return null;

		if (leaves[0].view instanceof ReferencesView) {
			return leaves[0].view;
		}
	}

	async initLeaf() {
		if (this.app.workspace.getLeavesOfType(ReferencesViewType).length) {
			return;
		};

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: ReferencesViewType,
		});

	}

	async revealLeaf() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return;
		await this.app.workspace.revealLeaf(leaves[0]);
	}

}

