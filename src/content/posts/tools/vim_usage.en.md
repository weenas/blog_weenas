---
title: My Vim Configuration
date: 2017-02-03
tags:
  - tools
description: The Swiss Army knife of code editors.
keywords:
  - vim
  - configuration
  - ctags
  - cscope
pubDatetime: 2017-02-03
---

Vim's power needs no introduction — it's one of the most powerful code editors around. Over years of use I've accumulated some configuration, which I'm recording and sharing here.

<!--more-->

## vimrc

When Vim starts it normally loads two config files automatically: `/etc/vimrc` and `~/.vimrc`. The first is the system-wide configuration and the second is per-user. Changing the system-wide file needs root, which you usually don't have on a shared server, so editing the per-user file is the better choice.

Below is my own `~/.vimrc`, covering common settings and key mappings, with comments explaining each part. Some of the formatting settings — such as replacing tabs with spaces and the indent width — are very helpful for teamwork: if everyone on the team uses the same config, the code they write will have a consistent style.

```
set nocompatible
set history=400
filetype on
set shiftwidth=4
set softtabstop=4
set tabstop=4
set smarttab
"set expandtab
set lbr

"Set to auto read when a file is changed from the outside
if exists("&autoread")
set autoread
endif

"Fast saving
nmap <leader>w :w!<cr>

syntax on
set encoding=utf-8

if exists("&cursorline")
set cursorline
endif

"Set 5 lines to the curors - when moving vertical..
set so=5

"Turn on WiLd menu
set wildmenu

"Always show current position
set ruler

"The commandbar is 2 high
set cmdheight=2

"Show line number
set nu

"Change buffer - without saving
set hid

"Set backspace
set backspace=eol,start,indent

"Ignore case when searching
"set ignorecase
set incsearch

"Set magic on
set magic

"show matching bracet
set showmatch

" How long the cursor briefly jumps to the matching bracket, in tenths of a second
set matchtime=2

"Highlight search thing
set hlsearch

"Turn backup off
set nobackup
set nowb

"Enable folding, I find it very useful
if exists("&foldenable")
set fen
endif

if exists("&foldlevel")
set fdl=0
endif

"Auto indent
set ai

"Smart indet
set si

"C-style indenting
set cindent
set smartindent

"Wrap line
set wrap

" Ask for confirmation when handling unsaved or read-only files
set confirm

" Color scheme (use :highlight to see its details)
" A gallery of color schemes:
" http://vimcolorschemetest.googlecode.com/svn/html/index-c.html
"colorscheme murphy
colorscheme desert
"colorscheme darkblue

" Custom status line
set statusline=%F%m%r%h%w[%L][%{&ff}]%y[%p%%][%04l,%04v]
"              | | | | |  |   |      |  |     |    |
"              | | | | |  |   |      |  |     |    +-- current column
"              | | | | |  |   |      |  |     +-- current line
"              | | | | |  |   |      |  +-- cursor position as a percentage
"              | | | | |  |   |      +-- syntax highlighter in use
"              | | | | |  |   +-- file format
"              | | | | |  +-- total number of lines
"              | | | | +-- preview flag
"              | | | +-- help file flag
"              | | +-- read-only flag
"              | +-- modified flag
"              +-- absolute path of the current file


" Show the command being typed
set showcmd

" Automatically cd to the directory of the current file; handy with :sh
"set autochdir


" Only do this part when compiled with support for autocommands.
if has("autocmd")

" For all text files set 'textwidth' to 78 characters.
autocmd FileType text setlocal textwidth=78

" When editing a file, always jump to the last known cursor position.
" Don't do it when the position is invalid or when inside an event handler
" (happens when dropping a file on gvim).
autocmd BufReadPost *
if line("'"") > 0 && line("'"") <= line("$") |
exe "normal g`"" |
endif

endif


" Ctags
map <C-F12> :!ctags -R --c++-kinds=+p --fields=+iaS --extra=+q .<CR>

" Sscope
set cscopequickfix=s-,c-,d-,i-,t-,e-

" Taglist
let Tlist_Show_One_File=1
let Tlist_Exit_OnlyWindow=1
" Use Ctrl+t to open Tlist window.
map <C-t> :TlistToggle<cr>
" Put the function list on the right side of the screen
let Tlist_Use_Right_Window=1

" Don't automatically resize the current Vim window
let Tlist_Inc_Winwidth=0

" Auto-fold the function lists of files not being edited, to save screen space
let Tlist_File_Fold_Auto_Close=1
```

## Ctags

Ctags is an external tool that extracts the symbols in your source code into a `tags` file. When Vim starts, it reads the `tags` file from the current directory by default.

Installing Ctags is simple. On Ubuntu:

```bash
sudo apt-get install ctags
```

Generate the `tags` file in the root of the source tree:

```bash
ctags -R *
```

Usage:

In Vim's normal mode, put the cursor on a symbol — a variable, function or macro. Press `<Ctrl + ]>` to jump straight to its definition, and `<Ctrl + o>` to go back to where you were. Jumps can be nested.

Tip:

The generated tags don't change when the source files change, so after editing, the line numbers recorded in `tags` become inaccurate and the file needs updating. Doing it the old way means quitting Vim, running ctags, then reopening Vim to continue editing — very tedious. A simple fix is to define a key mapping, so you can refresh the tags from inside Vim with a single keystroke.

The mapping is already included in the config file above:

```
map <C-F12> :!ctags -R --c++-kinds=+p --fields=+iaS --extra=+q .<CR>
```

## Taglist

Taglist lists all the symbols in the current source file in a separate pane, and you can jump straight to a definition from that list — much like some IDEs on Windows.

Setup:

Download the latest taglist, unzip it, and copy the `plugin` directory into `~/.vim/` (create the directory first if it doesn't exist). That's all there is to installing it. Then use these commands in Vim:

:TlistOpen       open the Taglist window
:TlistClose      close the Taglist window
:TlistToggle     toggle between open and closed
Mind the capitalization. Typing these commands is tedious and error-prone, so a key mapping is more convenient:

```
map <C-t> :TlistToggle<cr>
```
This lets Ctrl+t open and close the taglist.

In the taglist window (switch between Vim windows with `<Ctrl - w + w>`), you can use these commands:

```
<CR>          jump to where the tag under the cursor is defined (same as double-clicking it)
o             show the tag under the cursor in a new window
<Space>       show the prototype of the tag under the cursor
u             update the tags in the taglist window
s             change the sort order, toggling between by name and by order of appearance
x             enlarge or shrink the taglist window, handy for long tag names
+             open a fold, same as zo
-             close a fold, same as zc
*             open all folds, same as zR
=             close all folds, same as zM
[[            jump to the previous file
]]            jump to the next file
q             close the taglist window
<F1>          show help
```

## Cscope

Cscope is similar to Ctags — both are tools for quickly finding and navigating code — but Cscope is more convenient and faster for large projects.

Installation:

```bash
sudo apt-get install cscope
```

Like ctags, cscope needs an index first. I usually add a shell function: put the following in `~/.bashrc`, and you can run `buildref` on the command line to generate the index quickly.

```bash
buildref()
{
	find -name "*.[chsS]" -o -name "*.cpp" -o -name "*.java" > cscope.files
		cscope -bkq
}
```

Cscope's commands are also fairly complex, and it only shows its real power with key mappings. Save the following as `cscope_maps.vim` in `~/.vim/plugin` and Cscope becomes easy to use.

```bash
if has("cscope")
" use both cscope and ctag for 'ctrl-]', ':ta', and 'vim -t'
set cscopetag

" check cscope for definition of a symbol before checking ctags: set to 1
" if you want the reverse search order.
set csto=0

" add any cscope database in current directory
if filereadable("cscope.out")
cs add cscope.out
" else add the database pointed to by environment variable
elseif $CSCOPE_DB != ""
cs add $CSCOPE_DB
endif

" show msg when any other cscope db added
set cscopeverbose

" The following maps all invoke one of the following cscope search types:
"
" 's' symbol: find all references to the token under cursor
" 'g' global: find global definition(s) of the token under cursor
" 'c' calls: find all calls to the function name under cursor
" 't' text: find all instances of the text under cursor
" 'e' egrep: egrep search for the word under cursor
" 'f' file: open the filename under cursor
" 'i' includes: find files that include the filename under cursor
" 'd' called: find functions that function under cursor calls
nmap <C->s :cs find s <C-R>=expand("<cword>")<CR><CR>
nmap <C->g :cs find g <C-R>=expand("<cword>")<CR><CR>
nmap <C->c :cs find c <C-R>=expand("<cword>")<CR><CR>
nmap <C->t :cs find t <C-R>=expand("<cword>")<CR><CR>
nmap <C->e :cs find e <C-R>=expand("<cword>")<CR><CR>
nmap <C->f :cs find f <C-R>=expand("<cfile>")<CR><CR>
nmap <C->i :cs find i ^<C-R>=expand("<cfile>")<CR>$<CR>
nmap <C->d :cs find d <C-R>=expand("<cword>")<CR><CR>

endif
```

`<C - >s` means pressing Ctrl and the key together, releasing them, then pressing `s`; it finds all occurrences of the symbol under the cursor. By default the cursor jumps to the first match, and the total number of matches is shown at the bottom. To see the full list, enter `:cw` and Vim opens a window showing the cscope results. Move the cursor up and down the list and press Enter to jump to the selected symbol.

The command to move the cursor between Vim windows is `<C - w>w`. It's a frequently used command that saves you from reaching for the mouse to switch windows.
