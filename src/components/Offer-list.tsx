import { useEffect, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { fetchAllOffersOnChain } from "./offers.tsx";
import { getProgram } from "../../anchor/src/source.ts";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { AnchorProvider } from "@coral-xyz/anchor";
import { ArrowRightLeft, ExternalLink } from "lucide-react";
import CreateSwap from "./Make-offer.tsx";

interface Offer {
  publicKey: string;
  id: number;
  maker: string;
  tokenMintA: string;
  tokenMintB: string;
  amtTokenAOffered: number;
  amtTokenBWanted: number;
  bump: number;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  logoURI?: string;
  decimals: number;
  address: string;
}

const TOKEN_DECIMALS = 6;

// Jupiter Token List API for getting token metadata
const JUPITER_TOKEN_LIST_URL = 'https://token.jup.ag/all';

// Cache for token metadata to avoid repeated API calls
let tokenCache: Map<string, TokenMetadata> = new Map();
let tokenListCache: TokenMetadata[] | null = null;

const fetchTokenMetadata = async (mintAddress: string): Promise<TokenMetadata | null> => {
  try {
    // Check cache first
    if (tokenCache.has(mintAddress)) {
      return tokenCache.get(mintAddress)!;
    }

    // Fetch token list if not cached
    if (!tokenListCache) {
      console.log('Fetching token list from Jupiter...');
      const response = await fetch(JUPITER_TOKEN_LIST_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch token list: ${response.statusText}`);
      }
      tokenListCache = await response.json();

      // Populate cache
      tokenListCache?.forEach(token => {
        tokenCache.set(token.address, token);
      });
    }

    // Find token in the list
    const tokenMetadata = tokenCache.get(mintAddress);

    if (tokenMetadata) {
      console.log(`Found token metadata for ${mintAddress}:`, tokenMetadata);
      return tokenMetadata;
    } else {
      console.log(`No metadata found for mint address: ${mintAddress}`);
      // Return a fallback with the mint address
      return {
        name: 'Unknown Token',
        symbol: mintAddress.slice(0, 6) + '...',
        address: mintAddress,
        decimals: 9, // Default decimals
        logoURI: undefined
      };
    }
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return {
      name: 'Unknown Token',
      symbol: mintAddress.slice(0, 6) + '...',
      address: mintAddress,
      decimals: 9,
      logoURI: undefined
    };
  }
};

// Helper function to get a fallback logo for unknown tokens
const getFallbackTokenLogo = (symbol: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 32; // Match the new icon size
  canvas.height = 32; // Match the new icon size
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const colorIndex = symbol.charCodeAt(0) % colors.length;

    ctx.fillStyle = colors[colorIndex];
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, 2 * Math.PI); // Adjust arc to match new size
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif'; // Adjust font size for smaller logo
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol.charAt(0).toUpperCase(), 16, 16); // Adjust text position
  }

  return canvas.toDataURL();
};

export default function OfferList() {
  const wallet = useAnchorWallet();
  const [offerList, setOfferList] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<Map<string, TokenMetadata>>(new Map());

  const takeSwap = async (offer: Offer) => {
    if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
      console.error("Wallet not connected or invalid");
      return;
    }

    setProcessingOffer(offer.publicKey);
    setShowMatrix(true);

    const program = getProgram(wallet);
    if (!program) {
      console.error("Program not initialized");
      setProcessingOffer(null);
      setShowMatrix(false);
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
        );
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

      setTimeout(() => {
        setShowMatrix(false);
        setProcessingOffer(null);
      }, 2000);

    } catch (error) {
      console.error("Transaction failed:", error);
      setShowMatrix(false);
      setProcessingOffer(null);
    }
  };

  useEffect(() => {
    const loadOffers = async () => {
      if (!wallet) return;
      setIsLoading(true);
      const offers = await fetchAllOffersOnChain(wallet);
      setOfferList(offers);

      // Fetch metadata for all unique tokens
      const uniqueTokens = new Set<string>();
      offers.forEach(offer => {
        uniqueTokens.add(offer.tokenMintA);
        uniqueTokens.add(offer.tokenMintB);
      });

      const metadataMap = new Map<string, TokenMetadata>();
      await Promise.all(
        Array.from(uniqueTokens).map(async (tokenAddress) => {
          const metadata = await fetchTokenMetadata(tokenAddress);
          if (metadata) {
            metadataMap.set(tokenAddress, metadata);
          }
        })
      );

      setTokenMetadata(metadataMap);
      setIsLoading(false);
    };
    loadOffers();
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
          <p className="text-cyan-400 text-lg font-mono mt-4 animate-pulse tracking-wide">
            EXECUTING SWAP...
          </p>
        </div>
      </div>
    </div>
  );

  const renderTokenInfo = (tokenAddress: string, amount: number, label: string, colorClass: string) => {
    const metadata = tokenMetadata.get(tokenAddress);
    const symbol = metadata?.symbol || `${tokenAddress.slice(0, 6)}...`;
    const name = metadata?.name || 'Unknown Token';
    const logoURI = metadata?.logoURI;

    return (
      <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors duration-300">
        <div className="text-center">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-widest block mb-3">
            {label}
          </label>

          {/* Token Logo and Symbol */}
          <div className="flex items-center justify-center mb-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700/50 flex items-center justify-center mr-2 shadow-lg">
              {logoURI ? (
                <img
                  src={logoURI}
                  alt={symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = getFallbackTokenLogo(symbol);
                  }}
                />
              ) : (
                <img
                  src={getFallbackTokenLogo(symbol)}
                  alt={symbol}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="text-left">
              <p className={`${colorClass} font-semibold text-base tracking-wide`}>
                {symbol}
              </p>
              <p className="text-gray-400 text-xs leading-tight max-w-20 truncate">
                {name}
              </p>
            </div>
          </div>

          <p className={`${colorClass} font-bold text-xl mb-2 tracking-wide`}>
            {(amount / 10 ** TOKEN_DECIMALS).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4
            })}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-blue-600/20 animate-pulse"></div>
      </div>

      {/* Matrix animation overlay */}
      {showMatrix && <MatrixRain />}

      <div className="relative z-10 container mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-3 tracking-tight">
            SOLANA SWAP PROTOCOL
          </h1>
          <p className="text-gray-400 text-base md:text-lg tracking-wide font-light">
            Decentralized Token Exchange Network
          </p>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="loading-spinner mb-6"></div>
              <p className="text-cyan-400 text-xl font-medium animate-pulse tracking-wide">
                SCANNING BLOCKCHAIN...
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Create Swap Card - Always first */}
              <CreateSwap />

              {/* Existing Offers */}
              {offerList.length === 0 ? (
                <div className="col-span-full text-center py-16">
                  <p className="text-gray-400 text-lg font-medium tracking-wide">
                    NO ACTIVE SWAPS DETECTED
                  </p>
                  <p className="text-gray-500 mt-2 text-sm">
                    Create the first swap to get started
                  </p>
                </div>
              ) : (
                offerList.map((offer) => (
                  <div
                    key={offer.publicKey}
                    className="swap-card group relative overflow-hidden rounded-xl"
                  >
                    {/* Card background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-black/95 to-gray-900/95 backdrop-blur-sm"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    {/* Border */}
                    <div className="absolute inset-0 border border-gray-700/50 group-hover:border-cyan-500/30 transition-colors duration-500 rounded-xl"></div>

                    <div className="relative p-6">
                      {/* Swap direction indicator */}
                      <div className="flex items-center justify-center mb-6">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                          <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                        </div>
                      </div>

                      {/* Token swap details */}
                      <div className="space-y-4 mb-8">
                        {/* Offering Token */}
                        {renderTokenInfo(offer.tokenMintA, offer.amtTokenAOffered, "Offering", "text-cyan-400")}

                        {/* Arrow */}
                        <div className="flex justify-center">
                          <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center">
                            <ArrowRightLeft className="w-3 h-3 text-blue-400 rotate-90" />
                          </div>
                        </div>

                        {/* Wanting Token */}
                        {renderTokenInfo(offer.tokenMintB, offer.amtTokenBWanted, "Wanting", "text-blue-400")}
                      </div>

                      {/* Action button */}
                      <button
                        onClick={() => takeSwap(offer)}
                        disabled={!wallet?.publicKey || processingOffer === offer.publicKey}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed relative overflow-hidden text-sm tracking-wide"
                      >
                        <span className="relative z-10 flex items-center justify-center">
                          {processingOffer === offer.publicKey ? (
                            <>
                              <div className="loading-spinner-small mr-2"></div>
                              PROCESSING...
                            </>
                          ) : (
                            <>
                              <ArrowRightLeft className="w-4 h-4 mr-2" />
                              EXECUTE SWAP
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transaction result */}
          {txSig && (
            <div className="mt-10 max-w-2xl mx-auto">
              <div className="bg-gradient-to-r from-green-900/30 to-cyan-900/30 border border-green-500/30 rounded-lg p-5">
                <div className="flex items-center mb-3">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse mr-3"></div>
                  <span className="text-green-400 font-medium tracking-wide text-sm">
                    TRANSACTION CONFIRMED
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs font-mono">
                    {txSig.slice(0, 8)}...{txSig.slice(-8)}
                  </span>
                  <a
                    href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors text-xs"
                  >
                    <span className="mr-2 tracking-wide">VIEW</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}