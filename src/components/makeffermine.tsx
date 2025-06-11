import { useState, useEffect } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { getProgram } from "../../anchor/src/source.ts";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

export default function MakeOffer() {
function randomInt(min: number, max: number): number {
return Math.floor(Math.random() * (max - min + 1)) + min;
}
const randomId = randomInt(10, 999999);
const wallet = useAnchorWallet();
const { connection } = useConnection();

const [isLoading, setIsLoading] = useState(false);
const [txSig, setTxSig] = useState<string | null>(null);
const [counter, setCounter] = useState(new BN(randomId));
const [tokenMintA, setTokenMintA] = useState("");
const [tokenMintB, setTokenMintB] = useState("");
const [tokenAOfferedAmount, setTokenAOfferedAmount] = useState(new BN(0));
const [tokenBWantedAmount, setTokenBWantedAmount] = useState(new BN(0));

function handletokenAinput(event: React.ChangeEvent<HTMLInputElement>) {
setTokenMintA(event.target.value);
}
function handletokenBinput(event: React.ChangeEvent<HTMLInputElement>) {
setTokenMintB(event.target.value);
}

useEffect(() => {
// Placeholder for fetching counter from the chain if needed
// e.g., getCounter(wallet.publicKey) then setCounter(new BN(fetchedValue));
}, [wallet]);

const onClick = async () => {
if (!wallet) return;


try {
  const program = getProgram(wallet);
  if (!program) return;

  const mintA = new PublicKey(tokenMintA);
  const mintB = new PublicKey(tokenMintB);

  if (!PublicKey.isOnCurve(mintA) || !PublicKey.isOnCurve(mintB)) {
    throw new Error("Invalid mint addresses.");
  }

  if (tokenAOfferedAmount.lte(new BN(0)) || tokenBWantedAmount.lte(new BN(0))) {
    throw new Error("Token amounts must be greater than zero.");
  }

  const [offerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), wallet.publicKey.toBuffer(), counter.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const makerTokenAccountA = await getAssociatedTokenAddress(mintA, wallet.publicKey);
  const vaultAccountA = await getAssociatedTokenAddress(mintA, offerPDA, true);

  setIsLoading(true);
  setTxSig(null);

  const transaction = await program.methods.makeOffer(counter, tokenAOfferedAmount, tokenBWantedAmount).accountsStrict({
    maker: wallet.publicKey,
    tokenMintA: mintA,
    tokenMintB: mintB,
    makerTokenAccountA: makerTokenAccountA,
    offer: offerPDA,
    vault: vaultAccountA,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }).transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;

  const signedTx = await wallet.signTransaction(transaction);
  const sig = await connection.sendRawTransaction(signedTx.serialize());

  await connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature: sig,
  });

  setCounter(counter.add(new BN(1)));
  setTxSig(sig);
} catch (error) {
  console.error("Transaction failed:", error);
} finally {
  setIsLoading(false);
}
};

return (
<div className="Create card p-4">
<h2 className="text-2xl font-semibold mb-4">Make Offer</h2>


  <input
    type="text"
    value={tokenMintA}
    placeholder="Token Mint A (Offered)"
    onChange={handletokenAinput}
    className="mb-2 p-2 border w-full"
  />

  <input
    type="text"
    value={tokenMintB}
    placeholder="Token Mint B (Wanted)"
    onChange={handletokenBinput}
    className="mb-2 p-2 border w-full"
  />

  <input
    type="number"
    step="0.000001"
    min="0"
    value={tokenAOfferedAmount.div(new BN(10 ** 6)).toString()}
    placeholder="Amount Offered"
    onChange={(e) => {
      const val = e.target.value;
      if (!isNaN(Number(val)) && val !== "" && Number(val) >= 0) {
        const rawAmount = new BN(Math.floor(Number(val) * 10 ** 6));
        setTokenAOfferedAmount(rawAmount);
      }
    }}
    className="mb-2 p-2 border w-full"
  />

  <input
    type="number"
    step="0.000001"
    min="0"
    value={tokenBWantedAmount.div(new BN(10 ** 6)).toString()}
    placeholder="Amount Wanted"
    onChange={(e) => {
      const val = e.target.value;
      if (!isNaN(Number(val)) && val !== "" && Number(val) >= 0) {
        const rawAmount = new BN(Math.floor(Number(val) * 10 ** 6));
        setTokenBWantedAmount(rawAmount);
      }
    }}
    className="mb-4 p-2 border w-full"
  />

  <button
    onClick={onClick}
    disabled={!wallet?.publicKey || isLoading}
    className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
  >
    {isLoading ? "Creating..." : "Create Swap"}
  </button>

  {txSig && (
    <p className="mt-4">
      View on Explorer: <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{txSig}</a>
    </p>
  )}
</div>
);
}