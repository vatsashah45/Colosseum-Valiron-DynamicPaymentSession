import {
  test,
  expect,
  injectMockWallet,
  mockApiRoutes,
  MOCK_AGENT_ID,
  MOCK_WALLET_SHORT,
} from './fixtures'

/** Shared helper: mock /api/health to return ok */
async function mockHealth(page: import('@playwright/test').Page) {
  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
  )
}

/** Shared helper: connect the mock wallet and verify address appears */
async function connectWallet(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /connect/i }).click()
  await expect(page.getByText(MOCK_WALLET_SHORT)).toBeVisible({ timeout: 10_000 })
}

// ─── Page Load & Layout ────────────────────────────────────────────────────

test.describe('Page load', () => {
  test('renders header, hero, gate section, tier table, and footer', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    // Header
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dynamic Payment Channels' })).toBeVisible()

    // Connect wallet button (may show "Connect" or "Install" depending on Phantom)
    await expect(page.getByRole('button', { name: /connect|install/i })).toBeVisible()

    // Hero section
    await expect(page.getByText('Trust-Adaptive Payment Channels for AI Agents')).toBeVisible()
    await expect(page.getByText('Live on Devnet')).toBeVisible()

    // Gate Agent card
    await expect(page.getByText('Gate Agent & Open Channel')).toBeVisible()
    await expect(page.getByPlaceholder('Enter ERC-8004 agent ID')).toBeVisible()

    // Tier table
    await expect(page.getByText('Tier Policy Reference')).toBeVisible()
    await expect(page.locator('table').getByText('AAA', { exact: true }).first()).toBeVisible()

    // How It Works
    await expect(page.getByText('How It Works')).toBeVisible()
    await expect(page.getByText('Trust Evaluation')).toBeVisible()
    await expect(page.getByText('On-Chain Settlement')).toBeVisible()
  })

  test('server status shows "Connected" when health is ok', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 })
  })

  test('server status shows "Connection Lost" when health fails', async ({ page }) => {
    await page.route('**/api/health', (route) =>
      route.fulfill({ status: 503, body: '' })
    )
    await page.goto('/')
    await expect(page.getByText('Connection Lost')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Wallet Connection ─────────────────────────────────────────────────────

test.describe('Wallet connection', () => {
  test('shows connect button when wallet not connected', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /connect phantom|install phantom/i })).toBeVisible()
  })

  test('shows wallet address after connecting', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)
    await page.goto('/')

    await connectWallet(page)

    // Disconnect button should appear
    await expect(page.getByRole('button', { name: /disconnect/i })).toBeVisible()
  })
})

// ─── Gate Agent Flow ───────────────────────────────────────────────────────

test.describe('Gate agent flow', () => {
  test('gate button is disabled when input is empty', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)
    await page.goto('/')
    await connectWallet(page)

    const gateButton = page.getByRole('button', { name: /gate agent|check trust/i })
    await expect(gateButton).toBeDisabled()
  })

  test('shows wallet_required error when no wallet connected', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill(MOCK_AGENT_ID)
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    await expect(page.getByText('Wallet Not Connected')).toBeVisible({ timeout: 5_000 })
  })

  test('preflight triggers checking trust state', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)

    // Delay the preflight response so we can observe the loading state
    const LOADING_STATE_DELAY_MS = 200
    await page.route(`**/api/channel/preflight/**`, async (route) => {
      await new Promise((r) => setTimeout(r, LOADING_STATE_DELAY_MS))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agentId: MOCK_AGENT_ID,
          tier: 'AA',
          score: 850,
          riskLevel: 'Low',
          creditLine: '50000000',
          creditLineReadable: '$50.00',
          maxRequests: 50,
          durationSeconds: 2700,
          escrowAddress: 'EscrowAddr1111111111111111111111111111111',
        }),
      })
    })

    await page.goto('/')
    await connectWallet(page)

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill(MOCK_AGENT_ID)
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    // Should show loading state
    await expect(page.getByText('Checking trust...')).toBeVisible({ timeout: 5_000 })
  })

  test('shows agent_rejected error for untrusted agents', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)

    await page.route('**/api/channel/preflight/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'agent_rejected',
          message: 'Agent does not meet minimum trust threshold.',
          score: 30,
          tier: 'B',
          riskLevel: 'Critical',
        }),
      })
    )

    await page.goto('/')
    await connectWallet(page)

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill('bad-agent')
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    await expect(page.getByText('Agent Not Eligible')).toBeVisible({ timeout: 10_000 })
    // Verify the score is shown in the error panel
    await expect(page.getByText('Score:').locator('..').getByText('30')).toBeVisible()
  })

  test('shows escrow_not_configured error', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)

    await page.route('**/api/channel/preflight/**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'escrow_not_configured',
          message: 'Escrow wallet is not configured on the server.',
        }),
      })
    )

    await page.goto('/')
    await connectWallet(page)

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill(MOCK_AGENT_ID)
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    await expect(page.getByText('Escrow Not Configured')).toBeVisible({ timeout: 10_000 })
  })

  test('shows gate_unavailable error when trust service is down', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)

    await page.route('**/api/channel/preflight/**', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'gate_unavailable',
          message: 'Could not reach Valiron trust service.',
        }),
      })
    )

    await page.goto('/')
    await connectWallet(page)

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill(MOCK_AGENT_ID)
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    await expect(page.getByText('Trust Service Unavailable')).toBeVisible({ timeout: 10_000 })
  })

  test('shows insufficient_balance error', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)

    await page.route('**/api/channel/preflight/**', (route) =>
      route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'insufficient_balance',
          message: 'Wallet does not have enough USDC.',
          tier: 'AA',
          score: 850,
        }),
      })
    )

    await page.goto('/')
    await connectWallet(page)

    await page.getByPlaceholder('Enter ERC-8004 agent ID').fill(MOCK_AGENT_ID)
    await page.getByRole('button', { name: /gate agent|check trust/i }).click()

    await expect(page.getByText('Wallet Balance Too Low')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Tier Table ────────────────────────────────────────────────────────────

test.describe('Tier table', () => {
  test('renders all six tiers', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    const tiers = ['AAA', 'AA', 'A', 'BAA', 'BA', 'B']
    for (const tier of tiers) {
      await expect(page.locator('table').getByText(tier, { exact: true }).first()).toBeVisible()
    }
  })

  test('shows credit amounts for all tiers', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    await expect(page.getByText('$100.00')).toBeVisible()
    await expect(page.getByText('$50.00').first()).toBeVisible()
    await expect(page.getByText('$25.00')).toBeVisible()
    await expect(page.getByText('$10.00')).toBeVisible()
    await expect(page.getByText('$5.00')).toBeVisible()
    await expect(page.getByText('$2.00')).toBeVisible()
  })

  test('shows tier grades', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    await expect(page.getByText('Prime')).toBeVisible()
    await expect(page.getByText('High Grade')).toBeVisible()
    await expect(page.getByText('Highly Speculative')).toBeVisible()
  })
})

// ─── Consume & Settle ──────────────────────────────────────────────────────

test.describe('Consume & Settle', () => {
  test('consume section is hidden before a channel is opened', async ({ page }) => {
    await injectMockWallet(page)
    await mockHealth(page)
    await page.goto('/')

    await expect(page.getByText('Consume & Settle')).not.toBeVisible()
    await expect(page.getByText('Gate Agent & Open Channel')).toBeVisible()
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('skip-to-content link is present', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached()
  })

  test('main landmark is present', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('agent input has accessible label', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByLabel('Agent ID')).toBeVisible()
  })

  test('tier table has caption for screen readers', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    const caption = page.locator('caption')
    await expect(caption).toBeAttached()
    await expect(caption).toContainText('Trust tier policies')
  })

  test('header navigation has aria-label', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: /main/i })).toBeVisible()
  })
})

// ─── External Links ────────────────────────────────────────────────────────

test.describe('External links', () => {
  test('8004 registry link is present and correct', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    const link = page.getByRole('link', { name: /8004\.qnt\.sh/i }).first()
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', 'https://8004.qnt.sh')
    await expect(link).toHaveAttribute('target', '_blank')
  })

  test('Valiron docs link is present and correct', async ({ page }) => {
    await mockHealth(page)
    await page.goto('/')

    const link = page.getByRole('link', { name: /valiron docs/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', 'https://www.valiron.co/docs')
    await expect(link).toHaveAttribute('target', '_blank')
  })
})
