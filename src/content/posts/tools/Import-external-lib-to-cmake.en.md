---
title: Importing External Libraries in CMake
tags:
  - cmake
  - tools
description: How to import external static library in CMake.
keywords:
  - cmake
  - add_library
hide: false
pubDatetime: 2021-03-12
---

Projects sometimes need third-party libraries. With CMake, importing them into a project is very easy.

## Example

Suppose we have an external static library `libexternal.a` and want to use its APIs. We can create a new library `newlib` with the following code:

```c
set(lib_path ${CMAKE_CURRENT_SOURCE_DIR}/libexternal.a)
set(lib newlib)

add_library(${lib} STATIC IMPORTED GLOBAL)
set_property(TARGET ${lib} PROPERTY
             IMPORTED_LOCATION "${lib_path}")

target_include_directories(${lib} INTERFACE .)

target_link_libraries(${TARGET_NAME} ${lib})
```

## Explanation

`add_library` creates a new library. Use the `STATIC` argument for a static library and `SHARED` for a shared library.

`IMPORTED` means the library is used to import an external library, and `GLOBAL` means the new library can be used globally.

`set_property` specifies the path to the external library.

`target_include_directories` specifies the header search path of the new library, so that other modules depending on it can find its headers.

`target_link_libraries` links the library into the target.
