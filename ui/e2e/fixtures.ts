import { test as base, type Page } from '@playwright/test'

/**
 * Shared mock data for e2e tests.
 * These intercept /api/* routes so tests don't need a real backend.
 */

export const MOCK_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
export const MOCK_WALLET_SHORT = '7xKX...gAsU'
export const MOCK_AGENT_ID = '8365'
export const MOCK_SESSION_ID = 'sess_abc123def456'
export const MOCK_ESCROW = 'EscrowAddr1111111111111111111111111111111'
export const MOCK_DEPOSIT_SIG = '5KtP2MFgih...mockTxSignature'

export const MOCK_PREFLIGHT = {
  agentId: MOCK_AGENT_ID,
  tier: 'AA',
  score: 850,
  riskLevel: 'Low',
  creditLine: '50000000',
  creditLineReadable: '$50.00',
  maxRequests: 50,
  durationSeconds: 2700,
  escrowAddress: MOCK_ESCROW,
}

export const MOCK_OPEN_CHANNEL = {
  sessionId: MOCK_SESSION_ID,
  agentId: MOCK_AGENT_ID,
  tier: 'AA',
  score: 850,
  riskLevel: 'Low',
  creditLine: '50000000',
  creditLineReadable: '$50.00',
  maxRequests: 50,
  expiresAt: new Date(Date.now() + 2700 * 1000).toISOString(),
  durationSeconds: 2700,
  depositConfirmed: true,
  depositSignature: MOCK_DEPOSIT_SIG,
  escrowAddress: MOCK_ESCROW,
}

export const MOCK_CHANNEL_STATUS = {
  sessionId: MOCK_SESSION_ID,
  agentId: MOCK_AGENT_ID,
  tier: 'AA',
  creditLine: '50000000',
  creditLineReadable: '$50.00',
  consumed: '0',
  consumedReadable: '$0.00',
  remaining: '50000000',
  remainingReadable: '$50.00',
  requestCount: 0,
  maxRequests: 50,
  expiresAt: new Date(Date.now() + 2700 * 1000).toISOString(),
  secondsRemaining: 2700,
  active: true,
  settled: false,
}

export const MOCK_CONSUME = {
  requestId: 'req_001',
  cost: '500000',
  costReadable: '$0.50',
  session: {
    consumed: '500000',
    consumedReadable: '$0.50',
    remaining: '49500000',
    remainingReadable: '$49.50',
    requestCount: 1,
    maxRequests: 50,
    secondsRemaining: 2690,
  },
}

export const MOCK_SETTLE = {
  sessionId: MOCK_SESSION_ID,
  settled: true,
  totalConsumed: '500000',
  totalConsumedReadable: '$0.50',
  requestsServed: 1,
  unusedCredit: '49500000',
  unusedCreditReadable: '$49.50',
  refundAmount: '49500000',
  refundReadable: '$49.50',
  refundSignature: '4yMock...RefundSig1234567890abcdef',
}

/**
 * Inject a mock Phantom wallet into the page's window object.
 */
export async function injectMockWallet(page: Page) {
  await page.addInitScript((walletAddress) => {
    const mockPublicKey = {
      toString: () => walletAddress,
      toBase58: () => walletAddress,
    }

    const mockProvider = {
      isPhantom: true,
      publicKey: null as typeof mockPublicKey | null,
      async connect() {
        mockProvider.publicKey = mockPublicKey
        return { publicKey: mockPublicKey }
      },
      async disconnect() {
        mockProvider.publicKey = null
      },
      async signTransaction<T>(tx: T): Promise<T> {
        return tx
      },
      async signMessage(message: Uint8Array) {
        return { signature: new Uint8Array(64) }
      },
      _listeners: {} as Record<string, Array<(...args: unknown[]) => void>>,
      on(event: string, handler: (...args: unknown[]) => void) {
        if (!mockProvider._listeners[event]) mockProvider._listeners[event] = []
        mockProvider._listeners[event].push(handler)
      },
      off(event: string, handler: (...args: unknown[]) => void) {
        if (mockProvider._listeners[event]) {
          mockProvider._listeners[event] = mockProvider._listeners[event].filter((h) => h !== handler)
        }
      },
    }

    Object.defineProperty(window, 'phantom', {
      value: { solana: mockProvider },
      writable: false,
    })
    Object.defineProperty(window, 'solana', {
      value: mockProvider,
      writable: false,
    })
  }, MOCK_WALLET)
}

/**
 * Set up API route mocks for health + preflight + open + status + consume + settle.
 */
export async function mockApiRoutes(page: Page) {
  // Health
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'dynamic-payment-channels', escrowAddress: MOCK_ESCROW }),
    })
  )

  // Preflight
  await page.route(`**/api/channel/preflight/${MOCK_AGENT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PREFLIGHT),
    })
  )

  // Open channel
  await page.route(`**/api/channel/open/${MOCK_AGENT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_OPEN_CHANNEL),
    })
  )

  // Channel status
  await page.route(`**/api/channel/status/${MOCK_SESSION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CHANNEL_STATUS),
    })
  )

  // Consume
  await page.route(`**/api/channel/consume/${MOCK_SESSION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONSUME),
    })
  )

  // Settle
  await page.route(`**/api/channel/settle/${MOCK_SESSION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SETTLE),
    })
  )
}

/** Extended test fixture with wallet + API mocks pre-injected. */
export const test = base.extend<{ withMocks: void }>({
  withMocks: [async ({ page }, use) => {
    await injectMockWallet(page)
    await mockApiRoutes(page)
    await use()
  }, { auto: false }],
})

export { expect } from '@playwright/test'
