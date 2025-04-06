# NaviThingy

A modern, feature-rich Navidrome client built with Tauri and Svelte.

## NOTE

This project is still in development. Please report any issues you encounter on the GitHub issues page.

## Features

- Stream music from your Navidrome server
- Cross-platform support for Windows, Linux, MacOS, and Android
- Beautiful UI with customizable themes
- Quick search functionality for artists, albums, and songs (Ctrl+K)
- Synced lyrics support via LRCLIB/Embedded lyrics
- Multiple theme options (Catppuccin variants included by default)
- Support for multiple Navidrome servers
- Responsive design for all screen sizes
- Two playback engines: WebAudio for browser-based playback and MPV for advanced features like gapless playback and hardware decoding

## Installation

[![NaviThingy](https://img.shields.io/badge/AVAILABLE_ON_THE_AUR-333232?style=for-the-badge&logo=arch-linux&logoColor=3d67db&labelColor=%23171717)](https://aur.archlinux.org/packages/navithingy-git)


### Desktop:
Download the latest release from the [releases page](https://github.com/vMohammad24/NaviThingy/releases)

### Android:
For Android, you'll need to build it yourself for now. Refer to the [Building from source](#building-from-source) section below for detailed instructions.

## Themes

Additional themes for NaviThingy can be found at:
[ThingyThing Themes Repository](https://github.com/wont-stream/ThingyThing/tree/main/themes)

## Building from source

1. Install the latest version of [Android Studio](https://developer.android.com/studio) and [Android SDK](https://developer.android.com/studio/install).
2. Install the latest version of [Rust](https://www.rust-lang.org/tools/install) and [Tauri](https://tauri.app/v1/guides/getting-started/prerequisites/).
3. Install the latest version of [Node.js](https://nodejs.org/en/download/) and [bun](https://bun.sh/docs/installation).
4. Clone the repository:
```bash
git clone https://github.com/vMohammad24/NaviThingy.git
```
5. Navigate to the project directory:
```bash
cd NaviThingy
```
6. Install the dependencies:
```bash
bun install
```
7. Build the project:
```bash
bun tauri build --target android-arm64
```

## Contributing

Contributions are welcome! Feel free to open a pull request or an issue.
