import { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "../../anchor/src/source.ts";
import { SWAP_PROGRAM_ID } from "../../anchor/src/source.ts";
import BN from "bn.js";



export async function fetchAllOffersOnChain(anchorWallet: AnchorWallet | null) {
  const program = getProgram(anchorWallet);
  if (!program) return [];

  const offerSize = program.account.offer.size;

  const connection = program.provider.connection;
  if (!connection) {
    console.error("No connection available in the program provider.");
    return [];
  }


  // console.log("offerSize (bytes):", offerSize);
  // console.log("discriminator (base58):", base58.encode(discriminator));
  const rawAccounts = await connection.getProgramAccounts(SWAP_PROGRAM_ID, {
    filters: [{ dataSize: offerSize }],
  });
  // console.log("Raw accounts fetched:", rawAccounts.length);

  const offers: {
    publicKey: string;
    id: number;
    maker: string;
    tokenMintA: string;
    tokenMintB: string;
    amtTokenAOffered: number;
    amtTokenBWanted: number;
    bump: number;
  }[] = [];

  // 3) Iterate and decode each one, skipping failures
  for (const { pubkey, account } of rawAccounts) {
    // console.log("data account:", account.data);
    // console.log("Processing account:", pubkey.toBase58());
    // console.log(program.idl.accounts.map(a => a.name));
    try {
      // decode returns the parsed struct (fields as BN or PublicKey)
      const decoded = program.coder.accounts.decode<{
        id: BN;
        maker: PublicKey;
        tokenMintA: PublicKey;
        tokenMintB: PublicKey;
        amtTokenAOffered: BN;
        amtTokenBWanted: BN;
        bump: number;
      }>("offer", account.data);

      console.log("Decoded offer:", decoded);

      offers.push({
        publicKey: pubkey.toBase58(),
        id: decoded.id.toNumber(),
        maker: decoded.maker.toBase58(),
        tokenMintA: decoded.tokenMintA.toBase58(),
        tokenMintB: decoded.tokenMintB.toBase58(),
        amtTokenAOffered: decoded.amtTokenAOffered.toNumber(),
        amtTokenBWanted: decoded.amtTokenBWanted.toNumber(),
        bump: decoded.bump,
      }
      );
    } catch (e) {
      console.warn("Skipping invalid Offer account:", pubkey.toBase58());
      console.error("Error decoding account:", e);
    }
    // console.log("all the offers", offers);
  }

  return offers;
}

