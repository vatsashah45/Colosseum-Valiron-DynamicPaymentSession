'use client'

import { useState, useCallback, useEffect } from 'react'

interface PhantomProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  signTransaction?<T>(transaction: T): Promise<T>
  signMessage?(message: Uint8Array): Promise<{ signature: Uint8Array }>
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
}

interface WalletState {
  connected: boolean
  address: string | null
  shortAddress: string | null
  connecting: boolean
  error: string | null
}

function getProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as { solana?: PhantomProvider; phantom?: { solana?: PhantomProvider } }
  return win.phantom?.solana || win.solana || null
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    shortAddress: null,
    connecting: false,
    error: null,
  })

  const connect = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      if (typeof window !== 'undefined') {
        window.open('https://phantom.app/download', '_blank', 'noopener,noreferrer')
      }
      setState(prev => ({
        ...prev,
        error: 'Phantom wallet not found. Opening install page...',
      }))
      return
    }

    setState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      const { publicKey } = await provider.connect()
      const addr = publicKey.toString()
      setState({
        connected: true,
        address: addr,
        shortAddress: shortenAddress(addr),
        connecting: false,
        error: null,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        connecting: false,
        error: err instanceof Error ? err.message : 'Failed to connect',
      }))
    }
  }, [])

  const disconnect = useCallback(async () => {
    const provider = getProvider()
    if (provider) {
      try {
        await provider.disconnect()
      } catch {
        // silently ignore disconnect errors
      }
    }
    setState({
      connected: false,
      address: null,
      shortAddress: null,
      connecting: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    // Auto-reconnect if already connected
    if (provider.publicKey) {
      const addr = provider.publicKey.toString()
      setState({
        connected: true,
        address: addr,
        shortAddress: shortenAddress(addr),
        connecting: false,
        error: null,
      })
    }

    const handleDisconnect = () => {
      setState({
        connected: false,
        address: null,
        shortAddress: null,
        connecting: false,
        error: null,
      })
    }

    provider.on('disconnect', handleDisconnect)
    return () => {
      provider.off('disconnect', handleDisconnect)
    }
  }, [])

  const signTransaction = useCallback(async <T>(transaction: T): Promise<T> => {
    const provider = getProvider()
    if (!provider?.signTransaction) {
      throw new Error('Wallet does not support transaction signing')
    }
    return provider.signTransaction(transaction)
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    signTransaction,
    hasPhantom: typeof window !== 'undefined' && !!getProvider(),
  }
}
