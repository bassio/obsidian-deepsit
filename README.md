# Deep Sit plugin for Obsidian


## Deep Sit

Deep Sit is an Obsidian plugin that allows you to easily cite and refer to the literature stored in your Reference Manager Library (Zotero) during your note-taking. This integration enhances the use of Obsidian as a focused study and research tool.

## Requirements

- Zotero (version 7). (https://www.zotero.org/download/)
- Zotero's Better BibTeX plugin. (https://retorque.re/zotero-better-bibtex/index.html)
- Note: Zotero, with Better BibTeX installed, must be running while you are using this plugin.

## Manually installing the plugin

    (Instructions from https://github.com/obsidianmd/obsidian-sample-plugin)
    
    Copy over main.js, styles.css, manifest.json to your vault VaultFolder/.obsidian/plugins/your-plugin-id/.

## Use case

This plugin's would fit optimally within your research workflow, if you operate using the following assumptions:
- You use zotero as your main reference manager.
- You have a large zotero library with potentially many hundreds of pdf articles, and you use zotero for in-pdf annotations/highlights.
- You aim to write your own study and/or research notes / articles (e.g. a "Zettelkasten" or a "Second Brain" system, or alternatively exam study curriculum)
- You would have wished to keep your notes and study and/or research writings within Zotero as well for optimal integration, but unfortunately you find that you need a more powerful and flexible tool for your note-taking (i.e. Obsidian).
- You want to be able to, in your notes, to easily and quickly reference / cite the relevant literature.
- You want to be able to easily review or peek into your highlighted or annotated source references.

## Features

### Citation features

- Tie a markdown note to a "Zotero collection" of references using the "bib" keyword in the yaml frontmatter.
- In-text citations using the gold-standard "[@reference]" pandoc citation syntax. See https://pandoc.org/demo/example33/8.20-citation-syntax.html#citation-syntax
- Automatic reference selection pop-up dropbox for easy citations.

### Reference list features

- Keep track of your cited references, in an *ordered* Reference List, easily visible on the right side of your workspace (References mode).
- A "Refresh button" to allow you to refresh your References list as you add new / delete citations within your markdown or for when you add new items to Zotero.
- The "Bibliography mode" allows you to alternatively list all the References in the accompanying Zotero collection for quick reference.
- Choose a default of References View Mode versus Bibliography View Mode (via Plugin Settings).
- Automatic highlighting of references with pdf attachments and One-click jump to the pdf in your Zotero Library.   

### Annotation features

- Easily keep track of which references in your Bibliography has annotations.
- Efficient "Multi-annotation" feature: View all annotations for all pdf files within a Zotero collection in one view pane.
- Review Annotations within a pop-up modal or within the plugin view pane. (via Plugin Settings)
- Icons for quick-jump to the annotation in Zotero and for quick-copy the appropriately-referenced annotation to clipboard.
- Annotations view also includes Zotero "area" pdf annotations viewed as in-line pictures.

## Screenshots

- Cite as you write

![Citing](/screenshots/citing.png)

- References 

![References](/screenshots/references.png)

- Bibliography mode

![Bibliography](/screenshots/bibliography.png)

- Multi-file Annotations view pane

![Annotations](/screenshots/annotations.png)


## Usage

