---
title: CMake如何导入外部库
image: https://img.weenas.com/optimized/blog-cover-cmake-library-20261103.webp
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

在项目中有时会用到第三方的lib库，如果使用CMake可以非常方便的导入到项目中。

## 示例

假如现有一个外部静态库libexternal.a，我们要用到库里的接口，可以采用下列代码新建一个newlib：

```c
set(lib_path ${CMAKE_CURRENT_SOURCE_DIR}/libexternal.a)
set(lib newlib)

add_library(${lib} STATIC IMPORTED GLOBAL)
set_property(TARGET ${lib} PROPERTY
             IMPORTED_LOCATION "${lib_path}")

target_include_directories(${lib} INTERFACE .)

target_link_libraries(${TARGET_NAME} ${lib})
```

## 释义

`add_library`接口建立一个新库，如果是静态库使用`STATIC`参数，动态库则使用`SHARED`参数。

`IMPORTED`代码这个库是用于导入外部库，`GLOBAL`代表这个新建的库可以被全局使用。

`set_property`指定了外部库的路径。

`target_include_directories`用于指定新库包含的头文件路径，当其它模块依赖此库是可以找到这里的头文件。

`target_link_libraries`用于把此库链接到目标文件。
