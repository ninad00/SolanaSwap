import { useState, useEffect } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { getProgram } from "../../anchor/src/source.ts";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Plus, ArrowRightLeft, ExternalLink } from "lucide-react";

export default function CreateSwap() {
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
  const [showMatrix, setShowMatrix] = useState(false);

  function handletokenAinput(event: React.ChangeEvent<HTMLInputElement>) {
    setTokenMintA(event.target.value);
  }
  
  function handletokenBinput(event: React.ChangeEvent<HTMLInputElement>) {
    setTokenMintB(event.target.value);
  }

  useEffect(() => {
    // Placeholder for fetching counter from the chain if needed
  }, [wallet]);

  const MatrixRain = () => (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <div className="matrix-bg">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="matrix-column"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          >
            {Array.from({ length: 20 }).map((_, j) => (
              <span key={j} className="matrix-char">
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p className="text-cyan-400 text-xl font-mono mt-4 animate-pulse">
            CREATING SWAP...
          </p>
        </div>
      </div>
    </div>
  );

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
      setShowMatrix(true);
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

      // Reset form
      setTokenMintA("");
      setTokenMintB("");
      setTokenAOfferedAmount(new BN(0));
      setTokenBWantedAmount(new BN(0));

      setTimeout(() => {
        setShowMatrix(false);
        setIsLoading(false);
      }, 2000);

    } catch (error) {
      console.error("Transaction failed:", error);
      setShowMatrix(false);
      setIsLoading(false);
    }
  };

  return (
    <>
      {showMatrix && <MatrixRain />}
      <div className="swap-card group relative overflow-hidden">
        {/* Card background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-900/90 backdrop-blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Border */}
        <div className="absolute inset-0 border-2 border-gray-700 group-hover:border-green-500/50 transition-colors duration-500"></div>
        
        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-center justify-center mb-8">
            <Plus className="w-6 h-6 text-green-400 mr-3" />
            <h3 className="text-xl font-bold text-green-400 font-mono tracking-wider">
              CREATE SWAP
            </h3>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Offering Token */}
            <div className="bg-gray-900/50 p-6 rounded border-2 border-gray-700">
              <label className="text-gray-400 text-sm font-mono uppercase tracking-wider block mb-3">
                Token Offering
              </label>
              <input
                type="text"
                value={tokenMintA}
                placeholder="Token Mint Address"
                onChange={handletokenAinput}
                className="w-full bg-black/50 border border-gray-600 rounded px-4 py-3 text-cyan-400 font-mono text-sm focus:border-cyan-500 focus:outline-none transition-colors"
              />
              <input
                type="number"
                step="0.000001"
                min="0"
                value={tokenAOfferedAmount.div(new BN(10 ** 6)).toString()}
                placeholder="Amount"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!isNaN(Number(val)) && val !== "" && Number(val) >= 0) {
                    const rawAmount = new BN(Math.floor(Number(val) * 10 ** 6));
                    setTokenAOfferedAmount(rawAmount);
                  }
                }}
                className="w-full bg-black/50 border border-gray-600 rounded px-4 py-3 text-cyan-400 font-mono text-sm focus:border-cyan-500 focus:outline-none transition-colors mt-3"
              />
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-400 rotate-90" />
              </div>
            </div>

            {/* Wanting Token */}
            <div className="bg-gray-900/50 p-6 rounded border-2 border-gray-700">
              <label className="text-gray-400 text-sm font-mono uppercase tracking-wider block mb-3">
                Token Wanting
              </label>
              <input
                type="text"
                value={tokenMintB}
                placeholder="Token Mint Address"
                onChange={handletokenBinput}
                className="w-full bg-black/50 border border-gray-600 rounded px-4 py-3 text-blue-400 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
              />
              <input
                type="number"
                step="0.000001"
                min="0"
                value={tokenBWantedAmount.div(new BN(10 ** 6)).toString()}
                placeholder="Amount"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!isNaN(Number(val)) && val !== "" && Number(val) >= 0) {
                    const rawAmount = new BN(Math.floor(Number(val) * 10 ** 6));
                    setTokenBWantedAmount(rawAmount);
                  }
                }}
                className="w-full bg-black/50 border border-gray-600 rounded px-4 py-3 text-blue-400 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors mt-3"
              />
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={onClick}
            disabled={!wallet?.publicKey || isLoading}
            className="create-button w-full mt-8 relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center">
              {isLoading ? (
                <>
                  <div className="loading-spinner-small mr-2"></div>
                  CREATING...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  CREATE SWAP
                </>
              )}
            </span>
          </button>

          {/* Transaction result */}
          {txSig && (
            <div className="mt-6 bg-gradient-to-r from-green-900/20 to-cyan-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                <span className="text-green-400 font-mono text-sm font-semibold">
                  SWAP CREATED
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-xs">
                  {txSig.slice(0, 8)}...{txSig.slice(-8)}
                </span>
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span className="mr-1 font-mono text-xs">VIEW</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}