# SETUP_2_TERMINAL

```
Meslo Nerd Font successfully installed.

Please restart iTerm2 for the changes to take effect.

  1. Click iTerm2 → Quit iTerm2 or press ⌘ Q.
  2. Open iTerm2.

It's important to restart iTerm2 by following the instructions above. It's not enough to close iTerm2 by clicking on the red circle. You must
click iTerm2 → Quit iTerm2 or press ⌘ Q.
```


`$ brew install fig`

```
Running `brew update --preinstall`...
==> Auto-updated Homebrew!
Updated 3 taps (homebrew/core, homebrew/cask and homebrew/cask-fonts).
==> New Formulae
spirv-headers
==> Updated Formulae
Updated 15 formulae.
==> New Casks
osu
==> Updated Casks
Updated 15 casks.

==> Caveats
Please launch the Fig application to finish setup...

==> Downloading https://versions.withfig.com/fig%20440.dmg
######################################################################## 100.0%
==> Installing Cask fig
==> Moving App 'Fig.app' to '/Applications/Fig.app'
==> Linking Binary 'fig-darwin-universal' to '/usr/local/bin/fig'
🍺  fig was successfully installed!
```

## zinit plugin

* with zinit 

`.zshrc`

```
# Plugin history-search-multi-word loaded with investigating.
zinit load zdharma-continuum/history-search-multi-word

# Two regular plugins loaded without investigating.
zinit light zsh-users/zsh-autosuggestions
zinit light zdharma-continuum/fast-syntax-highlighting

# Snippet
zinit snippet https://gist.githubusercontent.com/hightemp/5071909/raw/
```

## powerlevel10k

* with zinit 

`.zshrc`

```
...
zinit ice depth=1; zinit light romkatv/powerlevel10k

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
...
```


```
Downloading romkatv/powerlevel10k…
⠴ ███████████ OBJ: 100, PACK: 0/92, COMPR: 100%
Note: Compiling: powerlevel10k.zsh-theme… OK.

New config: ~/.p10k.zsh.
Backup of the old config: $TMPDIR/.p10k.zsh.wExgHyt99M.
Backup of ~/.zshrc: $TMPDIR/.zshrc.Hr4hdtdIcU.

See ~/.zshrc changes:

  diff $TMPDIR/.zshrc.Hr4hdtdIcU ~/.zshrc

File feature requests and bug reports at https://github.com/romkatv/powerlevel10k/issues

[powerlevel10k] fetching gitstatusd .. [ok]
```


## key

```
# Keyboard
bindkey -e
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word
```

## bat

`$ brew install bat`

```
Running `brew update --preinstall`...
==> Auto-updated Homebrew!
Updated 2 taps (homebrew/core and homebrew/cask).
==> Updated Formulae
Updated 2 formulae.
==> Updated Casks
Updated 24 casks.

==> Downloading https://ghcr.io/v2/homebrew/core/bat/manifests/0.20.0
######################################################################## 100.0%
==> Downloading https://ghcr.io/v2/homebrew/core/bat/blobs/sha256:9e9b1c64c0bb01
==> Downloading from https://pkg-containers.githubusercontent.com/ghcr1/blobs/sh
######################################################################## 100.0%
==> Pouring bat--0.20.0.monterey.bottle.tar.gz
==> Caveats
zsh completions have been installed to:
  /usr/local/share/zsh/site-functions
==> Summary
🍺  /usr/local/Cellar/bat/0.20.0: 14 files, 4.8MB
==> Running `brew cleanup bat`...
Disable this behaviour by setting HOMEBREW_NO_INSTALL_CLEANUP.
Hide these hints with HOMEBREW_NO_ENV_HINTS (see `man brew`).
```



## direnv

`$ asdf `

`$ asdf plugin add direnv`

`$ direnv setup --shell zsh --version latest`

```
Checking for asdf...
✔️  Found asdf at /usr/local/Cellar/asdf/0.10.0/libexec/bin/asdf
Checking for direnv...
▶ asdf install direnv latest # ...  ∗ Downloading and installing direnv...
The installation was successful!
✔️
▶ env ASDF_DIRENV_VERSION=2.31.0 asdf which direnv # ...  ✔️
✔️  Found direnv at /Users/graykara/.asdf/installs/direnv/2.31.0/bin/direnv
Checking for direnv shell integration...
✍  Modifying /Users/graykara/.zshrc ✔️
✍  Clobbering /Users/graykara/.config/asdf-direnv/zshrc ✔️
Checking for direnv asdf integration...
✍  Clobbering /Users/graykara/.config/direnv/lib/use_asdf.sh ✔️
```

