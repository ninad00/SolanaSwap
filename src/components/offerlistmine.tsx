import { useEffect, useState,} from "react";
import { useAnchorWallet,  } from "@solana/wallet-adapter-react";
import { fetchAllOffersOnChain } from "./offers.tsx";
import { getProgram } from "../../anchor/src/source.ts";
import {  PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
getAssociatedTokenAddress,
TOKEN_PROGRAM_ID,
ASSOCIATED_TOKEN_PROGRAM_ID,
createAssociatedTokenAccountInstruction,

} from "@solana/spl-token";

import { AnchorProvider } from "@coral-xyz/anchor";

interface Offer {
publicKey: string;
id: number;
maker: string;
tokenMintA: string;
tokenMintB: string;
amtTokenAOffered: number; // raw units (BN.toNumber)
amtTokenBWanted: number;  // raw units (BN.toNumber)
bump: number;
}

const TOKEN_DECIMALS = 6;

export default function OfferList() {
const wallet = useAnchorWallet();
const [OfferList, setOfferList] = useState<Offer[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [txSig, setTxSig] = useState<string | null>(null);

const takeSwap = async (offer: Offer) => {
if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
console.error("Wallet not connected or invalid");
return;
}
const program = getProgram(wallet);
if (!program) {
console.error("Program not initialized");
return;
}
console.log("Taking offer:", offer);
const takerPublicKey = wallet.publicKey;
const tokenMintA = new PublicKey(offer.tokenMintA);
const tokenMintB = new PublicKey(offer.tokenMintB);
const offerPublicKey = new PublicKey(offer.publicKey);
const makerPublicKey = new PublicKey(offer.maker);


const vaultATA = await getAssociatedTokenAddress(
  tokenMintA,
  offerPublicKey,
  true,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);



const makerTokenAccountB = await getAssociatedTokenAddress(
  tokenMintB,
  makerPublicKey,
  false,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
const takerTokenAccountA = await getAssociatedTokenAddress(
  tokenMintA,
  takerPublicKey,
  false,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
const takerTokenAccountB = await getAssociatedTokenAddress(
  tokenMintB,
  takerPublicKey,
  false,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
try {
  const connection = (program.provider as AnchorProvider).connection;

  const takertokenAinfo = await connection.getAccountInfo(takerTokenAccountA);

  if (!takertokenAinfo) {
    const ix = createAssociatedTokenAccountInstruction(
      takerPublicKey,
      takerTokenAccountA,
      takerPublicKey,
      tokenMintA,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = wallet.publicKey;
    const signedTx = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signedTx.serialize());
    setTxSig(sig);
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature: sig,
    });
    console.log("Created associated token account:", sig);
    console.error("Taker Token A account does not exist, creating it...");
  }

  await program.methods.takeOffer().accountsStrict({
    taker: takerPublicKey,
    maker: makerPublicKey,
    tokenMintA: tokenMintA,
    tokenMintB: tokenMintB,
    takerTokenAccountA: takerTokenAccountA,
    takerTokenAccountB: takerTokenAccountB,
    makerTokenAccountB: makerTokenAccountB,
    offer: offerPublicKey,
    vault: vaultATA,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).rpc();
  console.log("Offer accepted successfully");
  setOfferList((prev) => prev.filter((o) => o.publicKey !== offer.publicKey));

} catch (error) {
  console.error("Transaction failed:", error);
  return;
}
};

useEffect(() => {
const loadOffers = async () => {
if (!wallet) return;
setIsLoading(true);
const offers = await fetchAllOffersOnChain(wallet);
setOfferList(offers);
setIsLoading(false);
};
loadOffers();
}, [wallet]);

return (
<div>
<h2>Offers List</h2>
{isLoading ? (<p>Loading..</p>) : OfferList.length === 0 ? (<p>No Offers Found :/</p>) : (
<ul>
{OfferList.map((offer) => (
<li key={offer.publicKey}>
<strong>Offer ID:</strong> {offer.id} <br />
<strong>Maker:</strong> {offer.maker} <br />
<strong>Token A Mint:</strong> {offer.tokenMintA} <br />
<strong>Token B Mint:</strong> {offer.tokenMintB} <br />
<strong>Token A Offered Amount:</strong> {(offer.amtTokenAOffered / 10 ** TOKEN_DECIMALS).toFixed(6)} <br />
<strong>Token B Wanted Amount:</strong> {(offer.amtTokenBWanted / 10 ** TOKEN_DECIMALS).toFixed(6)} <br />
<strong>Bump:</strong> {offer.bump} <br />


          <button
            onClick={() => takeSwap(offer)}
            disabled={!wallet?.publicKey || isLoading}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            {isLoading ? "Creating..." : "Accept Swap"}
          </button>
          {txSig && (
            <p className="mt-4">
              View on Explorer: <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{txSig}</a>
            </p>
          )}
        </li>
      ))}
    </ul>
  )}
</div>
);
}