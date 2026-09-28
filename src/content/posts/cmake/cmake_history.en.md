---
title: CMake History and Architecture (Chinese Translation Notes)
image: https://cmake.org/wp-content/uploads/2023/08/Cross_Platform_Testing.png
date: 2024-07-06 15:56:43
tags:
  - cmake
  - translate
keywords:
  - cmake
description: Notes on my Chinese translation of the CMake chapter from The Architecture of Open Source Applications — why CMake was built and how it works.
pubDatetime: 2024-07-06
---

The Chinese version of this post is my translation of the **CMake** chapter by Bill Hoffman and Kenneth Martin in [The Architecture of Open Source Applications](https://aosabook.org/en/). English readers should read the original chapter, [CMake](https://aosabook.org/en/v1/cmake.html), directly. This page summarizes what it covers.

## What the Chapter Covers

**History and goals.** In 1999 the US National Library of Medicine hired Kitware to build a better way to configure, build and deploy complex software across platforms, as part of the Insight Segmentation and Registration Toolkit ([ITK](http://www.itk.org/)). Projects at the time kept a configure script and Makefiles for Unix alongside Visual Studio project files for Windows. The authors' earlier attempts at a unified system (VTK's `pcmaker`, TargetJr's `gmake`-based system) forced Windows developers onto the command line. CMake was designed around a few constraints:

- Depend only on a C++ compiler
- Generate native IDE project files, such as Visual Studio's
- Easily build static and shared libraries, executables and plugins
- Run code generators at build time
- Support out-of-source builds
- Introspect the system, autotools-style, so code targets features instead of specific platforms
- Scan C/C++ header dependencies automatically
- Behave consistently on every supported platform

**How it works.** CMake runs in two phases. The *configure* step reads `CMakeCache.txt` and executes the project's `CMakeLists.txt` files, building an in-memory model of targets (`cmTarget` objects held in a tree of `cmMakefile` objects). The *generate* step turns that model into build files for the chosen tool, either IDE projects or Makefiles. Every language command is a `cmCommand` subclass that carries its own documentation. For Makefile builds, CMake tracks dependencies itself in `depend.make`, `flags.make`, `build.make` and `DependInfo.cmake`.

**The wider toolset.** CTest runs regression tests and reports results to CDash. CPack drives native packagers (NSIS, RPM, `.deb`, tarballs). Qt and curses GUIs edit the cache. CMake itself is developed with continuous integration built on the same tools.

**Lessons learned.** Backward compatibility is sacred, which led to the policy system in CMake 2.6. In hindsight, an existing embedded language such as Lua would have been better than a home-grown one. C plugins proved hard to keep compatible. Keeping the exposed API small avoids long-term maintenance costs.

For the full text, see the [original chapter](https://aosabook.org/en/v1/cmake.html). The [Chinese translation](/zh/posts/cmake/cmake_history/) is on this blog.
