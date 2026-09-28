---
title: Chezmoi 使用简介
image:
date: 2026-09-17
tags:
  - chezmoi
  - tools
  - dotfile
description: 好用的dotfile管理工具
keywords:
pubDatetime: 2026-09-17
---
## 前言

随着SSH无密码登录方式的普及，我们需要管理的私钥和公钥越来越多，再加上我们经常在不同的工作电脑或服务器之间切换，如何同步这些密钥文件是个问题。以前为了简单省事，我一般是把这些密钥文件提交到一个git仓库，这样在不同的机器之间可以很方便的进行同步，但这样的管理方式安全风险比较大。即使是私有仓库也不安全，云端 Git 托管平台（如 GitHub、GitLab）的账号可能被撞库，或者因 Token 泄露导致私有仓库暴露。一旦私钥泄漏，攻击者就能直接登录你的所有服务器，即使你后续在 Git 中删除了私钥，它依然残留在 `.git` 的历史提交记录中，随时可以被恢复。

偶然在网上发现了一个开源项目`Chezmoi`，他同样也是采用git的方式管理，但是可以对密钥的敏感信息进行加密后存储避免各种信息泄露。
## Chezmoi 优势

chezmoi 是目前最优雅、最安全的跨平台 Dotfiles（配置文件）管理工具。它的核心逻辑是：在本地维护一个隐藏的源目录（`~/.local/share/chezmoi`），利用 Git 进行版本控制，经过加密与模板渲染后，再把最终文件“应用”到你的实际主目录（`~`）中。

- 采用git管理，方便在多个机器之间进行数据同步
- 支持对敏感内容进行加密后存储
- 支持从密码管理器比如bitwarden，1Password中摘取私钥填入本地
- 支持根据不同操作系统对配置文件进行定制
## Chezmoi 简单用法

### 安装
- MacOS: 
`brew install chezmoi`
- Linux: 
```bash
sh -c "$(curl -fsLS https://get.chezmoi.io)"
```

### 初始化

```bash
chezmoi init
```
只需要一条命令即可在目录`.local/share/chezmoi/`创建git仓库，对于熟悉git的同学来说，后续的操作非常简单。

### 添加文件

1. 将需要的文件添加到chezmoi仓库
```bash
chezmoi add ~/.bashrc
```
这条命令chezmoi将`.bashrc`复制到`.local/share/chezmoi/`目录并改名为`dot_bashrc`

### 提交
这时可以通过git命令将修改提供到远程仓库

```bash
chezmoi cd            # 进入源仓库目录.local/share/chezmoi/
git remote add origin git@github.com:yourname/chezmoi.git
git add .
git commit -m "update dotfiles"
git push -u origin main
```

### 修改文件

修改文件有两种方式

第一种方式：
- 直接修改`~/.bashrc`
- 修改后再执行 `chezmoi add ~/.bashrc`将修改同步到git仓库
- 执行git提交
第二种方式：
- 使用`chezmoi edit ~/.bashrc`修改git仓库的`dot_bashrc`文件
- 通过`chezmoi diff`确认修改是否正确，不正确继续使用`chezmoi edit`命令修改
- 确认无误后使用`chezmoi apply -v`命令将修改应用到真实的`~/.bashrc`文件
- 执行git提交

不管采用哪种方式，我们都需要知道这里存在真实文件的git仓库的镜像文件，以及修改了一个之后怎么同步到另一个文件

### 从其他设备同步

如果已经存在chezmoi仓库，我们在一个新设备上要同步这些配置，只需要在init命令后添加git仓库地址，这一条命令就可以把git仓库下载到本地，并把git仓库里的文件复制到真实路径

```bash
chezmoi init --apply git@github.com:yourname/chezmoi.git
```

### 更新

当我们在某个设备对配置文件修改过，并提交到git仓库，其他设备也只需要一条命令即可同步git仓库，并把修改后的文件更新到真实路径

```bash
chezmoi update
```

## 管理敏感文件

前面介绍的方法只能用于明文管理普通文件，对于比如私钥这类敏感内容直接上传到git仓库会导致信息泄露，可能还会影响和私钥相关的所有文件安全，chezmoi原生支持对敏感文件进行对称或非对称加密，把加密后的内容上传到git仓库，其他设备同步git仓库后再进行解密。当然，这里的加密也会存在密钥，这个密钥需要单独保存，相当于我们使用一个带锁的抽屉管理着其他所有的钥匙，安全性和便捷性都有所提高。

### 生成密钥

在对SSH私钥加密前需要提前准备好chezmoi的密钥，一般采用age非对称加密

```bash
age-keygen -o ~/.config/chezmoi/key.txt
```
该命令会生成一对公钥和私钥

### 配置密钥

将生成好的密钥配置到chezmoi才能生效，配置命令为`chezmoi edit-config`

```toml
encryption = "age"
[age]
    identity = "~/.config/chezmoi/key.txt"
    recipient = "public_key..."
```

### 加密文件

和添加普通文件类似，只需增加`--encrypt`参数表示该文件需要加密存放，chezmoi会自动对该文件加密后再存入git仓库，后续的git管理命令都是相同的
```bash
chezmoi add --encrypt ~/.ssh/id_rsa
```
通过文件名也能看出该文件已经过加密
```bash
~/.local/share/chezmoi/dot_ssh/encrypted_private_id_rsa.age
```

### 解密文件

如果chezmoi仓库存在加密文件，其他设备也需要配置age密钥才能解密这些文件
- 把私钥`key.txt`复制到该设备
- 通过`chezmoi edit-config`配置相同的toml配置文件

完成这两步后，后面的chezmoi加解密操作都是无感自动完成的，非常方便。