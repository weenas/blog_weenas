---
title: Shadowsocks Configuration
date: 2017-12-06 15:56:43
tags:
  - tools
  - vpn
description: Building a stable way around GFW interference with Shadowsocks, including server installation and client setup on each platform.
pubDatetime: 2017-12-06
---

## Introduction

The GFW has been very active lately. First, SSH connections to overseas hosts are frequently interfered with, making them unstable and prone to dropping for no reason. Second, VPNs often fail to connect — whether based on PPTP or L2TP, they are completely unusable, probably because the packets exchanged during connection setup are easy to target. On top of that, China Telecom has recently started blocking port 443 as well, and it looks like it will be blocked long-term just like port 80, so serving HTTP without a custom port is pretty much out of the question.

<!--more-->

## Shadowsocks

Shadowsocks is a very interesting open-source project. Its website has this description:

> If you want to keep a secret, you must also hide it from yourself.

Shadowsocks has good platform support — Windows, Linux, Android, iPhone, and even OpenWRT — and is very convenient to use. It is based on SOCKS5, and SSH can also be tunneled through Shadowsocks, which solves the GFW's interference with SSH at the same time.

### Server

Installing and configuring the Shadowsocks server is very simple. There are no complicated options; a few commands are enough to get it running.

```bash
sudo apt-get update
sudo apt-get install python-pip
sudo pip install shadowsocks

sudo ssserver -p 8388 -k password -m aes-256-cfb -d start
```

### Client

The commands above install and start a server listening on port 8388. Configure the client with the matching port, password and encryption method, and you're done.

Windows Client

Android Client

iOS: SsrConnectPro

### Source Code

https://github.com/shadowsocks
