---
title: Getting Started with Chezmoi
image:
date: 2026-09-17
tags:
  - chezmoi
  - tools
  - dotfile
description: A handy dotfile manager
keywords:
pubDatetime: 2026-09-17
---
## Preface

As passwordless SSH login has become common, we have more and more private and public keys to manage. Add to that the frequent switching between work computers and servers, and syncing these key files becomes a problem. To keep things simple, I used to commit my key files to a Git repository so they were easy to sync between machines — but that approach carries a big security risk. Even a private repository isn't safe: accounts on cloud Git hosts (such as GitHub or GitLab) can be compromised through credential stuffing, or a leaked token can expose private repositories. Once a private key leaks, an attacker can log in to all your servers directly. Even if you later delete the key from Git, it still lingers in the `.git` history and can be recovered at any time.

By chance I came across an open-source project called `Chezmoi`. It is also Git-based, but it can encrypt sensitive content such as keys before storing it, preventing all kinds of leaks.
## Why Chezmoi

chezmoi is currently the most elegant and secure cross-platform dotfiles manager. Its core idea: it maintains a hidden source directory locally (`~/.local/share/chezmoi`) under Git version control, and after encryption and template rendering it "applies" the final files to your actual home directory (`~`).

- Git-based, so data is easy to sync across machines
- Sensitive content can be stored encrypted
- Can pull secrets from password managers such as Bitwarden or 1Password and write them locally
- Config files can be customized per operating system
## Basic Usage

### Installation
- macOS:
`brew install chezmoi`
- Linux:
```bash
sh -c "$(curl -fsLS https://get.chezmoi.io)"
```

### Initialization

```bash
chezmoi init
```
A single command creates a Git repository in `.local/share/chezmoi/`. If you're familiar with Git, everything after this is very simple.

### Adding Files

1. Add the files you need to the chezmoi repository
```bash
chezmoi add ~/.bashrc
```
With this command, chezmoi copies `.bashrc` into `.local/share/chezmoi/` and renames it to `dot_bashrc`.

### Committing
Now you can push the changes to a remote repository with Git:

```bash
chezmoi cd            # enter the source directory .local/share/chezmoi/
git remote add origin git@github.com:yourname/chezmoi.git
git add .
git commit -m "update dotfiles"
git push -u origin main
```

### Editing Files

There are two ways to edit files.

Option one:
- Edit `~/.bashrc` directly
- Then run `chezmoi add ~/.bashrc` to sync the change into the Git repository
- Commit with Git
Option two:
- Use `chezmoi edit ~/.bashrc` to edit `dot_bashrc` in the Git repository
- Check the change with `chezmoi diff`; if it's not right, keep editing with `chezmoi edit`
- Once it looks right, run `chezmoi apply -v` to apply the change to the real `~/.bashrc`
- Commit with Git

Either way, keep in mind that the Git repository holds a mirror of each real file, and know how a change to one gets synced to the other.

### Syncing from Another Device

If a chezmoi repository already exists and you want the same configuration on a new device, just add the repository URL to the `init` command. This one command downloads the repository and copies its files to their real paths:

```bash
chezmoi init --apply git@github.com:yourname/chezmoi.git
```

### Updating

When you've changed config files on one device and pushed them to the repository, other devices need just one command to sync the repository and update the real files:

```bash
chezmoi update
```

## Managing Sensitive Files

The approach above only manages ordinary files in plain text. Uploading sensitive content such as private keys directly to a Git repository would leak it and could compromise everything that key protects. chezmoi natively supports symmetric or asymmetric encryption of sensitive files: the encrypted content is pushed to the repository, and other devices decrypt it after syncing. Of course, this encryption has a key of its own, which must be kept separately — like using one locked drawer to hold all your other keys, improving both security and convenience.

### Generating a Key

Before encrypting SSH private keys, prepare a key for chezmoi. age asymmetric encryption is the usual choice:

```bash
age-keygen -o ~/.config/chezmoi/key.txt
```
This command generates a public/private key pair.

### Configuring the Key

The key takes effect only after you add it to chezmoi's configuration, using `chezmoi edit-config`:

```toml
encryption = "age"
[age]
    identity = "~/.config/chezmoi/key.txt"
    recipient = "public_key..."
```

### Encrypting Files

Just like adding an ordinary file, add the `--encrypt` flag to indicate the file should be stored encrypted. chezmoi encrypts it automatically before storing it in the repository, and all later Git commands stay the same:
```bash
chezmoi add --encrypt ~/.ssh/id_rsa
```
You can tell from the file name that it has been encrypted:
```bash
~/.local/share/chezmoi/dot_ssh/encrypted_private_id_rsa.age
```

### Decrypting Files

If the chezmoi repository contains encrypted files, other devices also need the age key to decrypt them:
- Copy the private key `key.txt` to the device
- Configure the same TOML settings with `chezmoi edit-config`

After these two steps, all later chezmoi encryption and decryption happens transparently and automatically — very convenient.
