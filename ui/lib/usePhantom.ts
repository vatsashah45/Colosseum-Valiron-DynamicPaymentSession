"use client";

import { useState, useEffect, useCallback } from "react";

/** Minimal Phantom wallet interface */
interface PhantomProvider {
  isPhantom?: boolean;
  isConnected: boolean;
  publicKey: { toBase58(): string; toBytes(): Uint8Array } | null;
  connect(): Promise<{ publicKey: { toBase58(): string; toBytes(): Uint8Array } }>;
  disconnect(): Promise<void>;
  signTransaction<T>(transaction: T): Promise<T>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantom = (window as any).phantom?.solana;
  if (phantom?.isPhantom) return phantom as PhantomProvider;
  return null;
}

export function usePhantom() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasPhantom, setHasPhantom] = useState(false);

  useEffect(() => {
    const phantom = getPhantom();
    setHasPhantom(!!phantom);
    if (phantom?.isConnected && phantom.publicKey) {
      setPublicKey(phantom.publicKey.toBase58());
      setConnected(true);
    }
  }, []);

  const connect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    const resp = await phantom.connect();
    setPublicKey(resp.publicKey.toBase58());
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    const phantom = getPhantom();
    if (phantom) await phantom.disconnect();
    setPublicKey(null);
    setConnected(false);
  }, []);

  const signTransaction = useCallback(
    async <T,>(tx: T): Promise<T> => {
      const phantom = getPhantom();
      if (!phantom) throw new Error("Phantom not available");
      return phantom.signTransaction(tx);
    },
    [],
  );

  return { publicKey, connected, hasPhantom, connect, disconnect, signTransaction };
}
