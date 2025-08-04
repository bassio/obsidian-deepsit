import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

import { CitationSuggest } from "CitationSuggest";
import { ReferencesView, ReferencesViewType } from 'ReferencesView';


interface DeepSitPluginSettings {
	defaultViewMode: string;
	defaultAnnotationsMode: string;
}

const DEFAULT_SETTINGS:DeepSitPluginSettings = {
	defaultViewMode: 'references',
	defaultAnnotationsMode: 'modal'
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

		containerEl.createEl('h2', { text: 'Deep Sit Plugin Settings' });

		new Setting(containerEl)
			.setName('Default Reference List View Mode')
			.setDesc('The default view mode for the References view. Options include "References mode" (default) and "Bibliography mode".')
			.addDropdown((dropdown) => {
				dropdown
				.addOption('references', "References mode")
				.addOption('bibliography', 'Bibliography mode')
				.setValue(this.plugin.settings.defaultViewMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultViewMode = value;
							this.plugin.saveSettings();
			  				})
			});

		new Setting(containerEl)
			.setName('Default Annotations View Mode')
			.setDesc('The default view mode for the Annotations. Options include "Modal" (default) and "View Pane".')
			.addDropdown((dropdown) => {
				dropdown
				.addOption('modal', "Modal")
				.addOption('viewpane', 'View Pane')
				.setValue(this.plugin.settings.defaultAnnotationsMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultAnnotationsMode = value;
							this.plugin.saveSettings();
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
    set activeFilePath(path) {
        if (path != this._activeFilePath){
			this._activeFilePath = path;
			console.log("activeFilePath changed!");

			if (!path){
				console.log("empty path");
				this.view?.setEmptyView();
				return;
			}

			if (this.settings.defaultViewMode == 'references'){
				this.view?.renderReferences();
			} else if (this.settings.defaultViewMode == 'bibliography'){
				this.view?.renderBibliography();
			} else {
				this.view?.renderReferences();
			}
		}
    }

	async onload() {

		console.log("Loading Deep Sit plugin.")

		await this.loadSettings();

		this.registerEditorSuggest(new CitationSuggest(this.app, this));
		
		this.registerView(ReferencesViewType,
						 (leaf: WorkspaceLeaf) => new ReferencesView(leaf, this)
						  );

		this.addCommand({
			id: 'show-references-view',
			name: 'Show References',
			callback: async () => {
				this.initLeaf();
			},
		});


		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf:WorkspaceLeaf) => {
			const activeFile = this.app.workspace.getActiveFile();
			console.log(activeFile);
			console.log(leaf)
			if (!activeFile){
				this.activeFilePath = "";
			} else {
				this.activeFilePath = activeFile.path;
			}
		}));
		
		this.registerEvent(this.app.workspace.on('layout-change', (leaf:WorkspaceLeaf) => {
			const activeFile = this.app.workspace.getActiveFile();
			console.log("layout change");
			if (!activeFile){
				this.activeFilePath = "";
			} else if (activeFile.path != this.activeFilePath) {
				this.activeFilePath = activeFile.path;
			}
		}));
			  
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
		return leaves[0].view as ReferencesView;
	}

	async initLeaf() {
		if (this.app.workspace.getLeavesOfType(ReferencesViewType).length) {
			return;
		};

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: ReferencesViewType,
		});

	}

	revealLeaf() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return;
		this.app.workspace.revealLeaf(leaves[0]);
	}

}
