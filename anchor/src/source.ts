import { AnchorProvider, IdlAccounts, Program, Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import SwapIDL from '../target/idl/swap.json'
import type { Swap } from '../target/types/swap.ts'
import { AnchorWallet, } from '@solana/wallet-adapter-react'
export { Swap, SwapIDL }

export const CLUSTER_URL = "https://api.devnet.solana.com";
export const SWAP_PROGRAM_ID = new PublicKey(SwapIDL.address);
export const COMMITMENT: AnchorProvider["opts"] = {
  preflightCommitment: "processed",
  commitment: "confirmed"
};

const programId = new PublicKey("GSYCrqvf4xw2mP4DdYbPwKsNiKfnhhTSyv8p7h1SX28R");

export function getProgram(anchorWallet: AnchorWallet | null): Program<Swap> | null {
  if (!anchorWallet) return null;
  const connection = new Connection(CLUSTER_URL, COMMITMENT.preflightCommitment);
  const provider = new AnchorProvider(connection, anchorWallet);
  return new Program(SwapIDL as Idl, provider);
}



export type OfferData = IdlAccounts<Swap>["offer"];
