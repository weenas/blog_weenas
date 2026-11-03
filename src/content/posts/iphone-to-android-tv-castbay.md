---
title: iPhone 怎么投屏到 Android TV？我做了一个 AirPlay 接收器
description: 家里是 Android TV，却想用 iPhone 投屏？记录一下我为什么做 CastBay，以及怎么在电视上装好、开始投屏。
author: Eason
pubDatetime: 2026-11-03T00:00:00Z
slug: iphone-to-android-tv-castbay
featured: false
draft: false
tags:
  - CastBay
  - Android TV
  - AirPlay
keywords:
  - iPhone 投屏到 Android TV
  - AirPlay 接收器
  - CastBay
  - DLNA
image: https://img.weenas.com/optimized/castbay-android-tv-cover.webp
ogImage: https://img.weenas.com/optimized/castbay-android-tv-cover.webp
---

<img src="https://img.weenas.com/optimized/castbay-android-tv-cover.webp" alt="Sony 电视上的 CastBay 主界面，正在等待投屏连接" width="1600" height="900" />

*Sony 电视上的 CastBay 主界面。手机和电视在同一个网络时，可以从 iPhone 的“屏幕镜像”里选择 CastBay。*

家里有台 Android TV，平时用着挺好。只是偶尔想把 iPhone 上的照片、视频或屏幕放到电视上时，才发现电视没有 AirPlay。

我一开始其实只想做个小工具，在安卓电视上接收并播放 AirPlay 音乐。结果做着做着，越加越多：先加了 DLNA，后来又做了苹果屏幕镜像。再后来，我甚至做了 Windows 和 Linux 桌面客户端，用 CastBay Link 协议把电脑的桌面投到电视上。

后来我干脆把它叫作 CastBay。它装在电视或电视盒子上，让 Android 设备变成一个 AirPlay 接收器。iPhone 不用装额外的 App，直接从控制中心里选电视就行。

<img src="https://img.weenas.com/optimized/castbay-airplay-music-2026.webp" alt="CastBay 在 Sony 电视上接收 AirPlay 音乐，播放网易云音乐歌曲《离别开出花》" width="1920" height="1080" />

*CastBay 接收 iPhone 的 AirPlay 音乐投屏。画面中的歌曲为《离别开出花》，演唱者：就是南方凯，播放来源：网易云音乐。歌曲、歌词和封面归各自权利人所有。*

<!--more-->

## 先把 CastBay 装到电视上

电视或电视盒子需要运行 Android 6.0 或更新版本。手机和电视要连在同一个家庭网络里；访客 Wi-Fi 有时会隔离设备，最好别用。

我觉得最简单的安装方式是直接用电视浏览器：

1. 打开电视上的浏览器，访问 [**castbay.weenas.com/apk**](https://castbay.weenas.com/apk)。
2. 下载并安装 APK。如果系统询问是否允许浏览器安装应用，允许后返回安装即可。
3. 打开 CastBay，停在主界面等手机连接。

如果电视上没有浏览器，也可以把 APK 放进 U 盘，用电视的文件管理器安装；或者从手机把安装包传到电视。具体步骤和不同电视的设置位置写在[安装指南](https://castbay.weenas.com/guide)里。

## 用 iPhone 开始投屏

电视打开 CastBay 后，在 iPhone 上从右上角下滑打开控制中心，点“屏幕镜像”，然后选择列表里的 **CastBay**。

连接后，手机屏幕和声音就会出现在电视上。想结束时，可以在 iPhone 上停止镜像，也可以在电视上按两次返回键。

如果只是想播放某个视频，也可以试试视频 App 播放页面上的 AirPlay 图标。电视会直接播放视频，手机可以继续做别的事。不过不同 App 和视频的支持情况不一样。

## 还有一种投屏方式：DLNA

一些视频和音乐 App 自带的投屏按钮走的是 DLNA。CastBay 也能接收这类投屏，手机和电视同样要在一个网络里。

这和 Android 手机上的“屏幕镜像”不是一回事。比如，Android 版 YouTube 使用 Google Cast，CastBay 目前接收不了；但部分支持 DLNA 的 App 可以把内容投过来。视频清晰度和能不能播放，也要看 App、视频内容和电视本身。

## 有些情况确实不支持

CastBay 支持 AirPlay 和 DLNA，但不支持 Google Cast（Chromecast）或 Miracast。带 DRM 保护的视频可能无法播放。电视型号、系统版本和 App 不同，实际效果也会有差异。

我把已经实机测试过的设备、App 和已知限制整理在[兼容性列表](https://castbay.weenas.com/compatibility)里。列表里没有你的电视也不代表一定不能用，只是我还没在那个型号上验证过。

CastBay 是免费开源软件，源码和各版本安装包都在 [GitHub](https://github.com/weenas/castbay)。如果你试了，欢迎告诉我电视型号、Android 版本，以及你用的是屏幕镜像、AirPlay 还是 App 里的投屏按钮。无论成功还是遇到问题，这些信息都能帮我把兼容情况写得更准确。
