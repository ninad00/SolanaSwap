# 🪙 SolanaSwap

SolanaSwap is a decentralized token swapping platform built on the [Solana blockchain](https://solana.com). It enables peer-to-peer swaps between two SPL tokens using custom smart contracts developed with [Anchor](https://book.anchor-lang.com/).

---

![WhatsApp Image 2025-06-12 at 01 06 20_ac10034d](https://github.com/user-attachments/assets/24700f1d-3716-457a-9149-b55810ee79f5)


## ✨ Features

- Swap any two SPL tokens directly
- Permissionless: anyone can create or take offers
- Program Derived Address (PDA) based escrow
- Fully on-chain offer lifecycle (create, list, cancel, accept)
- React-based frontend with wallet integration

---

## 📦 Tech Stack

| Layer | Tech |
|------|------|
| Smart Contract | [Anchor](https://github.com/coral-xyz/anchor) |
| Frontend | React + TypeScript |
| Wallet | `@solana/wallet-adapter` |
| Token Handling | `@solana/spl-token` |
| Network | Devnet / Mainnet |

---

## ⚙️ How it Works

### 1. **Create Offer**
- A user (maker) deposits Token A into a PDA-controlled escrow.
- Metadata includes: Token A offered, Token B wanted, amounts, bump.

### 2. **Take Offer**
- A taker sends Token B to the maker.
- Program releases Token A from escrow to the taker.

### 3. **Cancel Offer**
- Maker can cancel an active offer, reclaiming their Token A.

---

## 📁 Project Structure

```text
SolanaSwap/
├── anchor/               # Anchor program (smart contract)
│   ├── programs/
│   ├── src/
│   └── tests/
├── app/                  # React frontend
│   ├── components/
│   ├── pages/
│   └── hooks/
└── README.md


---

## 🚀 Local Development

### Prerequisites
- Node.js
- Solana CLI (`solana`)
- Anchor CLI (`anchor`)
- Yarn or npm

### 1. Clone the repo

```bash
git clone https://github.com/ninad00/SolanaSwap.git
cd SolanaSwap


