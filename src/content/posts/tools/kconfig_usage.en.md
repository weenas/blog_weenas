---
title: An Introduction to Kconfig
image: https://photo.weenas.com/8l3G1D.png
date: 2022-06-05
tags:
  - tools
description: Use Kconfig to make a software project configurable — the foundation for modular builds.
keywords:
  - kconfig
  - kconfiglib
pubDatetime: 2022-06-05
---

## Introduction

Kconfig comes from the Linux kernel. It's used to configure the options of a project so that modules (features) can be switched on and off just by editing a config file. In other words, the same source code combined with different config files can produce binaries with different features.

## Kconfig Implementations

Kconfig was originally only usable within the kernel, but thanks to its ease of use it's now widely adopted by large projects including NuttX, buildroot, crosstool-NG, uClibc, OpenWrt and Zephyr. There are currently two mainstream implementations: kconfig-frontends and Kconfiglib.

### kconfig-frontends

kconfig-frontends is the C implementation. It uses the kernel's Kconfig source code, maintained independently of the kernel.
Pros
- Best compatibility

Cons
- Not cross-platform
- Only outputs `.config` by default

### Kconfiglib

Kconfiglib is a library written in Python that supports the entire Kconfig syntax.
Pros
- Cross-platform
- Can output both `.config` and `config.h`

> `.config` and `config.h` contain exactly the same settings; they just use different formats for different consumers.
> `.config` passes the configuration to Makefile or CMake: CONFIG_XXX=100
> `config.h` passes the configuration to the source code: #define CONFIG_XXX 100

## Common Syntax

Official documentation: https://www.kernel.org/doc/html/latest/kbuild/kconfig-language.html

### config

`config` is the most basic Kconfig statement. Each `config` produces a `CONFIG_XXX` setting.

```sh
config XXX
    bool "Enable XXX"
    default y
    help
        Enable XXX module.
```

`config` supports several types; the most common are `bool`, `string`, `int` and `hex`.

### menu

`menu` creates a submenu, and nesting several menus creates a multi-level menu.
`menu` doesn't produce a config setting; it only organizes the structure of the configs.

```sh
menu "2nd Menu"
endmenu
```

> Note: `menu` and `endmenu` must be used in pairs.

### menuconfig

`menuconfig` combines `menu` and `config`: it creates a menu and also produces a config setting.
Unlike `menu`, you can only enter the submenu when this option is enabled. It's typically used for a module and the options inside it.

```sh
menuconfig MENU_XXX
    bool "MENU XXX"
    default y
    help
        Menu XXX
```

### choice

`choice` provides single selection, for when exactly one of several options may be chosen — for example choosing whether the platform is VDK, FPGA or SoC. Using `choice` prevents configuration mistakes.

```sh
choice
    bool "Choice Sample"
    default CHOICE_C
config CHOICE_A
    bool "Choice A"
config CHOICE_B
    bool "Choice B"
config CHOICE_C
    bool "Choice C"
endchoice
```

> Note: `choice` and `endchoice` must be used in pairs.

### if, depends on, select

These are Kconfig's conditional constructs, which let the configuration control dependencies between modules.

```sh
config MODULE_A
    bool "module a"
if MODULE_A
config MODULE_B
    bool "module b"
endif
config MODULE_C
    bool "module c"
    depends on MODULE_A
config MODULE_D
    bool "module d"
    select MODULE_E
config MODULE_E
    bool "module e"
```

### source

`source` includes a lower-level Kconfig file, so during development Kconfig can be organized as a tree, with each module adding its own config options. No matter which Kconfig file a config lives in, all configs are globally visible, so `if`, `depends on` and `select` can reference configs from other modules.

## Example

### Kconfig File

```sh
mainmenu "Sample Project"
config AUTHOR
    string "Author"
    default "Sample"
    help
        Author of this project.
config MAJOR_VER
    int "Major version"
    default 1
    help
        Major version of this project.
config SUB_VER
    int "Sub version"
    default 12
    help
        Sub version of this project.
menu "Config Samples"
config BOOL_XXX
    bool "Enable BOOL XXX"
    default y
    help
    Enable BOOL XXX.
config STRING_XXX
    string "STRING XXX"
    default "string_xxx"
    help
    Set string
config INT_XXX
    int "INT XXX"
    default 100
    help
    Set int
config HEX_XXX
    hex "HEX XXX"
    default 0x100
    help
    set hex
endmenu
menu "Menu Sample"
menu "2nd Menu"
menu "3rd Menu"
menu "4th Menu"
endmenu
endmenu
endmenu
endmenu
menu "Menuconfig Sample"
menuconfig MENU_XXX
    bool "MENU XXX"
    default y
    help
    Menu XXX
if MENU_XXX
config MENU_SUB1_XXX
    bool "MENU SUB1 XXX"
config MENU_SUB2_XXX
    bool "MENU SUB2 XXX"
    default y
endif
endmenu
choice
    bool "Choice Sample"
    default CHOICE_C
config CHOICE_A
    bool "Choice A"
config CHOICE_B
    bool "Choice B"
config CHOICE_C
    bool "Choice C"
endchoice
menu "Condition Sample"
config MODULE_A
    bool "module a"
if MODULE_A
config MODULE_B
    bool "module b"
endif
config MODULE_C
    bool "module c"
    depends on MODULE_A
config MODULE_D
    bool "module d"
    select MODULE_E
config MODULE_E
    bool "module e"
endmenu
```

### Running

Download Kconfiglib: https://github.com/ulfalizer/Kconfiglib

```sh
python Kconfiglib/menuconfig.py Kconfig
```
