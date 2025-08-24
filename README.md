# DISCLAIMER
This repository is a fan-operated fork, if you wish to go to the official repository, [click here](https://github.com/TriliumNext/Trilium).

This repository serves as a fork that primarily removes AI integration from trilium, however i do work on some QoL changes and hope to, in the future, expand on the trilium client.

Aside from our changes, all credits go to the upstream repository, ill eventually update the readmes to include better credits lists, for now you can use the change notes to see added content.


# Trilium Notes

![GitHub Sponsors](https://img.shields.io/github/sponsors/eliandoran) ![LiberaPay patrons](https://img.shields.io/liberapay/patrons/ElianDoran)  
![Docker Pulls](https://img.shields.io/docker/pulls/triliumnext/trilium)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/triliumnext/trilium/total)  
[![RelativeCI](https://badges.relative-ci.com/badges/Di5q7dz9daNDZ9UXi0Bp?branch=develop)](https://app.relative-ci.com/projects/Di5q7dz9daNDZ9UXi0Bp) [![Translation status](https://hosted.weblate.org/widget/trilium/svg-badge.svg)](https://hosted.weblate.org/engage/trilium/)

[English](./README.md) | [Chinese (Simplified)](./docs/README-ZH_CN.md) | [Chinese (Traditional)](./docs/README-ZH_TW.md) | [Russian](./docs/README.ru.md) | [Japanese](./docs/README.ja.md) | [Italian](./docs/README.it.md) | [Spanish](./docs/README.es.md)

Trilium Notes is a free and open-source, cross-platform hierarchical note taking application with focus on building large personal knowledge bases.

See [screenshots](https://triliumnext.github.io/Docs/Wiki/screenshot-tour) for quick overview:

<a href="https://triliumnext.github.io/Docs/Wiki/screenshot-tour"><img src="./docs/app.png" alt="Trilium Screenshot" width="1000"></a>

## 🎁 Features

* Notes can be arranged into arbitrarily deep tree. Single note can be placed into multiple places in the tree (see [cloning](https://triliumnext.github.io/Docs/Wiki/cloning-notes))
* Rich WYSIWYG note editor including e.g. tables, images and [math](https://triliumnext.github.io/Docs/Wiki/text-notes) with markdown [autoformat](https://triliumnext.github.io/Docs/Wiki/text-notes#autoformat)
* Support for editing [notes with source code](https://triliumnext.github.io/Docs/Wiki/code-notes), including syntax highlighting
* Fast and easy [navigation between notes](https://triliumnext.github.io/Docs/Wiki/note-navigation), full text search and [note hoisting](https://triliumnext.github.io/Docs/Wiki/note-hoisting)
* Seamless [note versioning](https://triliumnext.github.io/Docs/Wiki/note-revisions)
* Note [attributes](https://triliumnext.github.io/Docs/Wiki/attributes) can be used for note organization, querying and advanced [scripting](https://triliumnext.github.io/Docs/Wiki/scripts)
* UI available in English, German, Spanish, French, Romanian, and Chinese (simplified and traditional)
* Direct [OpenID and TOTP integration](./docs/User%20Guide/User%20Guide/Installation%20%26%20Setup/Server%20Installation/Multi-Factor%20Authentication.md) for more secure login
* [Synchronization](https://triliumnext.github.io/Docs/Wiki/synchronization) with self-hosted sync server
  * there's a [3rd party service for hosting synchronisation server](https://trilium.cc/paid-hosting)
* [Sharing](https://triliumnext.github.io/Docs/Wiki/sharing) (publishing) notes to public internet
* Strong [note encryption](https://triliumnext.github.io/Docs/Wiki/protected-notes) with per-note granularity
* Sketching diagrams, based on [Excalidraw](https://excalidraw.com/) (note type "canvas")
* [Relation maps](https://triliumnext.github.io/Docs/Wiki/relation-map) and [link maps](https://triliumnext.github.io/Docs/Wiki/link-map) for visualizing notes and their relations
* Mind maps, based on [Mind Elixir](https://docs.mind-elixir.com/)
* [Geo maps](./docs/User%20Guide/User%20Guide/Note%20Types/Geo%20Map.md) with location pins and GPX tracks
* [Scripting](https://triliumnext.github.io/Docs/Wiki/scripts) - see [Advanced showcases](https://triliumnext.github.io/Docs/Wiki/advanced-showcases)
* [REST API](https://triliumnext.github.io/Docs/Wiki/etapi) for automation
* Scales well in both usability and performance upwards of 100 000 notes
* Touch optimized [mobile frontend](https://triliumnext.github.io/Docs/Wiki/mobile-frontend) for smartphones and tablets
* Built-in [dark theme](https://triliumnext.github.io/Docs/Wiki/themes), support for user themes
* [Evernote](https://triliumnext.github.io/Docs/Wiki/evernote-import) and [Markdown import & export](https://triliumnext.github.io/Docs/Wiki/markdown)
* [Web Clipper](https://triliumnext.github.io/Docs/Wiki/web-clipper) for easy saving of web content
* Customizable UI (sidebar buttons, user-defined widgets, ...)
* [Metrics](./docs/User%20Guide/User%20Guide/Advanced%20Usage/Metrics.md), along with a [Grafana Dashboard](./docs/User%20Guide/User%20Guide/Advanced%20Usage/Metrics/grafana-dashboard.json)

✨ Check out the following third-party resources/communities for more TriliumNext related goodies:

- [awesome-trilium](https://github.com/Nriver/awesome-trilium) for 3rd party themes, scripts, plugins and more.
- [TriliumRocks!](https://trilium.rocks/) for tutorials, guides, and much more.

## ❓Why TriliumNext?

The original Trilium developer ([Zadam](https://github.com/zadam)) has graciously given the Trilium repository to the community project which resides at https://github.com/TriliumNext

### ⬆️Migrating from Zadam/Trilium?

There are no special migration steps to migrate from a zadam/Trilium instance to a TriliumNext/Trilium instance. Simply [install TriliumNext/Trilium](#-installation) as usual and it will use your existing database.

Versions up to and including [v0.90.4](https://github.com/TriliumNext/Trilium/releases/tag/v0.90.4) are compatible with the latest zadam/trilium version of [v0.63.7](https://github.com/zadam/trilium/releases/tag/v0.63.7). Any later versions of TriliumNext/Trilium have their sync versions incremented which prevents direct migration.

## 📖 Documentation

We're currently in the progress of moving the documentation to in-app (hit the `F1` key within Trilium). As a result, there may be some missing parts until we've completed the migration. If you'd prefer to navigate through the documentation within GitHub, you can navigate the [User Guide](./docs/User%20Guide/User%20Guide/) documentation. 

Below are some quick links for your convenience to navigate the documentation:
- [Server installation](./docs/User%20Guide/User%20Guide/Installation%20&%20Setup/Server%20Installation.md)
  - [Docker installation](./docs/User%20Guide/User%20Guide/Installation%20&%20Setup/Server%20Installation/1.%20Installing%20the%20server/Using%20Docker.md)
- [Upgrading TriliumNext](./docs/User%20Guide/User%20Guide/Installation%20%26%20Setup/Upgrading%20TriliumNext.md)
- [Concepts and Features - Note](./docs/User%20Guide/User%20Guide/Basic%20Concepts%20and%20Features/Notes.md)
- [Patterns of personal knowledge base](https://triliumnext.github.io/Docs/Wiki/patterns-of-personal-knowledge)

Until we finish reorganizing the documentation, you may also want to [browse the old documentation](https://triliumnext.github.io/Docs).

## 💬 Discuss with us

Feel free to join our official conversations. We would love to hear what features, suggestions, or issues you may have!

- [Matrix](https://matrix.to/#/#triliumnext:matrix.org) (For synchronous discussions.)
  - The `General` Matrix room is also bridged to [XMPP](xmpp:discuss@trilium.thisgreat.party?join)
- [Github Discussions](https://github.com/TriliumNext/Trilium/discussions) (For asynchronous discussions.)
- [Github Issues](https://github.com/TriliumNext/Trilium/issues) (For bug reports and feature requests.)

## 🏗 Installation

### Windows / MacOS

Download the binary release for your platform from the [latest release page](https://github.com/TriliumNext/Trilium/releases/latest), unzip the package and run the `trilium` executable.

### Linux

If your distribution is listed in the table below, use your distribution's package.

[![Packaging status](https://repology.org/badge/vertical-allrepos/triliumnext.svg)](https://repology.org/project/triliumnext/versions)

You may also download the binary release for your platform from the [latest release page](https://github.com/TriliumNext/Trilium/releases/latest), unzip the package and run the `trilium` executable.

TriliumNext is also provided as a Flatpak, but not yet published on FlatHub.

### Browser (any OS)

If you use a server installation (see below), you can directly access the web interface (which is almost identical to the desktop app).

Currently only the latest versions of Chrome & Firefox are supported (and tested).

### Mobile

To use TriliumNext on a mobile device, you can use a mobile web browser to access the mobile interface of a server installation (see below).

See issue https://github.com/TriliumNext/Trilium/issues/4962 for more information on mobile app support.

If you prefer a native Android app, you can use [TriliumDroid](https://apt.izzysoft.de/fdroid/index/apk/eu.fliegendewurst.triliumdroid).
Report bugs and missing features at [their repository](https://github.com/FliegendeWurst/TriliumDroid).
Note: It is best to disable automatic updates on your server installation (see below) when using TriliumDroid since the sync version must match between Trilium and TriliumDroid.

### Server

To install TriliumNext on your own server (including via Docker from [Dockerhub](https://hub.docker.com/r/triliumnext/trilium)) follow [the server installation docs](https://triliumnext.github.io/Docs/Wiki/server-installation).


## 💻 Contribute

### Translations

If you are a native speaker, help us translate Trilium by heading over to our [Weblate page](https://hosted.weblate.org/engage/trilium/).

Here's the language coverage we have so far:

[![Translation status](https://hosted.weblate.org/widget/trilium/multi-auto.svg)](https://hosted.weblate.org/engage/trilium/)

### Code

Download the repository, install dependencies using `pnpm` and then run the server (available at http://localhost:8080):
```shell
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium
pnpm install
pnpm run server:start
```

### Documentation

Download the repository, install dependencies using `pnpm` and then run the environment required to edit the documentation:
```shell
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium
pnpm install
pnpm nx run edit-docs:edit-docs
```

### Building the Executable
Download the repository, install dependencies using `pnpm` and then build the desktop app for Windows:
```shell
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium
pnpm install
pnpm nx --project=desktop electron-forge:make -- --arch=x64 --platform=win32
```

For more details, see the [development docs](https://github.com/TriliumNext/Trilium/tree/main/docs/Developer%20Guide/Developer%20Guide).

### Developer Documentation

Please view the [documentation guide](https://github.com/TriliumNext/Trilium/blob/main/docs/Developer%20Guide/Developer%20Guide/Environment%20Setup.md) for details. If you have more questions, feel free to reach out via the links described in the "Discuss with us" section above.

## 👏 Shoutouts

* [CKEditor 5](https://github.com/ckeditor/ckeditor5) - best WYSIWYG editor on the market, very interactive and listening team
* [FancyTree](https://github.com/mar10/fancytree) - very feature rich tree library without real competition. Trilium Notes would not be the same without it.
* [CodeMirror](https://github.com/codemirror/CodeMirror) - code editor with support for huge amount of languages
* [jsPlumb](https://github.com/jsplumb/jsplumb) - visual connectivity library without competition. Used in [relation maps](https://triliumnext.github.io/Docs/Wiki/relation-map.html) and [link maps](https://triliumnext.github.io/Docs/Wiki/note-map.html#link-map)

## 🤝 Support

Support for the TriliumNext organization will be possible in the near future. For now, you can:
- Support continued development on TriliumNext by supporting our developers: [eliandoran](https://github.com/sponsors/eliandoran) (See the [repository insights]([developers]([url](https://github.com/TriliumNext/trilium/graphs/contributors))) for a full list)
- Show a token of gratitude to the original Trilium developer ([zadam](https://github.com/sponsors/zadam)) via [PayPal](https://paypal.me/za4am) or Bitcoin (bitcoin:bc1qv3svjn40v89mnkre5vyvs2xw6y8phaltl385d2).


## 🔑 License

Copyright 2017-2025 zadam, Elian Doran, and other contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
